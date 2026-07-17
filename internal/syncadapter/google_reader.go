package syncadapter

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

type googleReaderAdapter struct{ baseClient }

func (a *googleReaderAdapter) Pull(ctx context.Context, cursor string) (Delta, error) {
	response, err := a.request(ctx, http.MethodGet, "reader/api/0/subscription/list", url.Values{"output": {"json"}}, nil)
	if err != nil {
		return Delta{}, err
	}
	var subscriptions struct {
		Subscriptions []struct {
			ID         string `json:"id"`
			Title      string `json:"title"`
			Categories []struct {
				Label string `json:"label"`
			} `json:"categories"`
		} `json:"subscriptions"`
	}
	if err := decodeJSONResponse(response, &subscriptions); err != nil {
		return Delta{}, err
	}
	delta := Delta{Subscriptions: make([]Subscription, 0, len(subscriptions.Subscriptions))}
	for _, item := range subscriptions.Subscriptions {
		folder := ""
		if len(item.Categories) > 0 {
			folder = item.Categories[0].Label
		}
		delta.Subscriptions = append(delta.Subscriptions, Subscription{
			RemoteID: item.ID, FeedURL: strings.TrimPrefix(item.ID, "feed/"), Title: item.Title, Folder: folder,
		})
	}
	unread, unreadCursor, err := a.pullIDs(ctx, "user/-/state/com.google/reading-list", "user/-/state/com.google/read", cursor)
	if err != nil {
		return Delta{}, err
	}
	starred, starredCursor, err := a.pullIDs(ctx, "user/-/state/com.google/starred", "", cursor)
	if err != nil {
		return Delta{}, err
	}
	states := make(map[string]ItemState)
	for _, id := range unread {
		states[id] = ItemState{RemoteID: id, Read: boolPointer(false)}
	}
	for _, id := range starred {
		state := states[id]
		state.RemoteID = id
		state.Starred = boolPointer(true)
		states[id] = state
	}
	if err := a.enrichStates(ctx, states); err != nil {
		return Delta{}, err
	}
	for _, state := range states {
		delta.States = append(delta.States, state)
	}
	delta.Cursor = unreadCursor
	if starredCursor > delta.Cursor {
		delta.Cursor = starredCursor
	}
	return delta, nil
}

func (a *googleReaderAdapter) enrichStates(ctx context.Context, states map[string]ItemState) error {
	if len(states) == 0 {
		return nil
	}
	query := url.Values{"output": {"json"}}
	for id := range states {
		query.Add("i", id)
	}
	response, err := a.request(ctx, http.MethodGet, "reader/api/0/stream/items/contents", query, nil)
	if err != nil {
		return err
	}
	var result struct {
		Items []struct {
			ID        string `json:"id"`
			Timestamp string `json:"timestampUsec"`
			Alternate []struct {
				Href string `json:"href"`
			} `json:"alternate"`
			Origin struct {
				StreamID string `json:"streamId"`
			} `json:"origin"`
		} `json:"items"`
	}
	if err := decodeJSONResponse(response, &result); err != nil {
		return err
	}
	for _, item := range result.Items {
		state, exists := states[item.ID]
		if !exists {
			continue
		}
		state.GUID = item.ID
		state.FeedRemoteID = item.Origin.StreamID
		state.RemoteUpdated = item.Timestamp
		if len(item.Alternate) > 0 {
			state.CanonicalURL = item.Alternate[0].Href
		}
		states[item.ID] = state
	}
	return nil
}

func (a *googleReaderAdapter) pullIDs(ctx context.Context, stream, exclude, cursor string) ([]string, string, error) {
	query := url.Values{"output": {"json"}, "s": {stream}, "n": {"10000"}}
	if exclude != "" {
		query.Set("xt", exclude)
	}
	if cursor != "" {
		query.Set("ot", cursor)
	}
	response, err := a.request(ctx, http.MethodGet, "reader/api/0/stream/items/ids", query, nil)
	if err != nil {
		return nil, "", err
	}
	var result struct {
		ItemRefs []struct {
			ID        string `json:"id"`
			Timestamp string `json:"timestampUsec"`
		} `json:"itemRefs"`
	}
	if err := decodeJSONResponse(response, &result); err != nil {
		return nil, "", err
	}
	ids := make([]string, 0, len(result.ItemRefs))
	latest := cursor
	for _, item := range result.ItemRefs {
		ids = append(ids, item.ID)
		if item.Timestamp > latest {
			latest = item.Timestamp
		}
	}
	return ids, latest, nil
}

func (a *googleReaderAdapter) Push(ctx context.Context, states []ItemState) error {
	for _, state := range states {
		values := url.Values{"i": {state.RemoteID}, "async": {"true"}}
		if state.Read != nil {
			key := "r"
			if *state.Read {
				key = "a"
			}
			values.Add(key, "user/-/state/com.google/read")
		}
		if state.Starred != nil {
			key := "r"
			if *state.Starred {
				key = "a"
			}
			values.Add(key, "user/-/state/com.google/starred")
		}
		response, err := a.form(ctx, "reader/api/0/edit-tag", nil, values)
		if err != nil {
			return fmt.Errorf("push Google Reader state %s: %w", state.RemoteID, err)
		}
		response.Body.Close()
	}
	return nil
}
