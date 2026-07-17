package syncadapter

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

type feedbinAdapter struct{ baseClient }

func (a *feedbinAdapter) Pull(ctx context.Context, cursor string) (Delta, error) {
	response, err := a.request(ctx, http.MethodGet, "v2/subscriptions.json", nil, nil)
	if err != nil {
		return Delta{}, err
	}
	var subscriptions []struct {
		ID      int64  `json:"id"`
		Title   string `json:"title"`
		FeedURL string `json:"feed_url"`
	}
	if err := decodeJSONResponse(response, &subscriptions); err != nil {
		return Delta{}, err
	}
	unreadResponse, err := a.request(ctx, http.MethodGet, "v2/unread_entries.json", nil, nil)
	if err != nil {
		return Delta{}, err
	}
	var unread []int64
	if err := decodeJSONResponse(unreadResponse, &unread); err != nil {
		return Delta{}, err
	}
	starredResponse, err := a.request(ctx, http.MethodGet, "v2/starred_entries.json", nil, nil)
	if err != nil {
		return Delta{}, err
	}
	var starred []int64
	if err := decodeJSONResponse(starredResponse, &starred); err != nil {
		return Delta{}, err
	}
	delta := Delta{Cursor: cursor, Subscriptions: make([]Subscription, 0, len(subscriptions))}
	for _, item := range subscriptions {
		delta.Subscriptions = append(delta.Subscriptions, Subscription{RemoteID: strconv.FormatInt(item.ID, 10), Title: item.Title, FeedURL: item.FeedURL})
	}
	states := make(map[string]ItemState)
	for _, id := range unread {
		key := strconv.FormatInt(id, 10)
		states[key] = ItemState{RemoteID: key, Read: boolPointer(false)}
		if id > parseInt64(delta.Cursor) {
			delta.Cursor = key
		}
	}
	for _, id := range starred {
		key := strconv.FormatInt(id, 10)
		state := states[key]
		state.RemoteID = key
		state.Starred = boolPointer(true)
		states[key] = state
		if id > parseInt64(delta.Cursor) {
			delta.Cursor = key
		}
	}
	if len(states) > 0 {
		ids := make([]string, 0, len(states))
		for id := range states {
			ids = append(ids, id)
		}
		detailsResponse, err := a.request(ctx, http.MethodGet, "v2/entries.json", url.Values{"ids": {strings.Join(ids, ",")}}, nil)
		if err != nil {
			return Delta{}, err
		}
		var details []struct {
			ID     int64  `json:"id"`
			FeedID int64  `json:"feed_id"`
			URL    string `json:"url"`
		}
		if err := decodeJSONResponse(detailsResponse, &details); err != nil {
			return Delta{}, err
		}
		for _, item := range details {
			key := strconv.FormatInt(item.ID, 10)
			state, exists := states[key]
			if !exists {
				continue
			}
			state.FeedRemoteID = strconv.FormatInt(item.FeedID, 10)
			state.CanonicalURL = item.URL
			states[key] = state
		}
	}
	for _, state := range states {
		delta.States = append(delta.States, state)
	}
	return delta, nil
}

func (a *feedbinAdapter) Push(ctx context.Context, states []ItemState) error {
	for _, state := range states {
		id, err := strconv.ParseInt(state.RemoteID, 10, 64)
		if err != nil {
			return err
		}
		if state.Read != nil {
			method := http.MethodPost
			if *state.Read {
				method = http.MethodDelete
			}
			response, err := a.request(ctx, method, "v2/unread_entries.json", nil, map[string]any{"unread_entries": []int64{id}})
			if err != nil {
				return fmt.Errorf("push Feedbin read state: %w", err)
			}
			response.Body.Close()
		}
		if state.Starred != nil {
			method := http.MethodPost
			if !*state.Starred {
				method = http.MethodDelete
			}
			response, err := a.request(ctx, method, "v2/starred_entries.json", nil, map[string]any{"starred_entries": []int64{id}})
			if err != nil {
				return fmt.Errorf("push Feedbin starred state: %w", err)
			}
			response.Body.Close()
		}
	}
	return nil
}
