package syncadapter

import (
	"context"
	"net/url"
	"sort"
	"strconv"
	"strings"
)

type feverAdapter struct{ baseClient }

func (a *feverAdapter) Pull(ctx context.Context, cursor string) (Delta, error) {
	query := url.Values{"api": {"1"}, "feeds": {"1"}, "items": {"1"}, "unread_item_ids": {"1"}, "saved_item_ids": {"1"}}
	response, err := a.form(ctx, "", query, url.Values{"api_key": {a.credentials.APIKey}})
	if err != nil {
		return Delta{}, err
	}
	var result struct {
		API   int `json:"api_version"`
		Auth  int `json:"auth"`
		Feeds map[string]struct {
			ID      int64  `json:"id"`
			Title   string `json:"title"`
			URL     string `json:"url"`
			SiteURL string `json:"site_url"`
		} `json:"feeds"`
		UnreadIDs string `json:"unread_item_ids"`
		SavedIDs  string `json:"saved_item_ids"`
		Items     []struct {
			ID     int64  `json:"id"`
			FeedID int64  `json:"feed_id"`
			URL    string `json:"url"`
		} `json:"items"`
	}
	if err := decodeJSONResponse(response, &result); err != nil {
		return Delta{}, err
	}
	if result.Auth != 1 {
		return Delta{}, &Error{Code: "authentication_error", Err: ErrAuthentication}
	}
	delta := Delta{Cursor: cursor, Subscriptions: make([]Subscription, 0, len(result.Feeds))}
	feedKeys := make([]string, 0, len(result.Feeds))
	for key := range result.Feeds {
		feedKeys = append(feedKeys, key)
	}
	sort.Strings(feedKeys)
	for _, key := range feedKeys {
		item := result.Feeds[key]
		delta.Subscriptions = append(delta.Subscriptions, Subscription{RemoteID: strconv.FormatInt(item.ID, 10), Title: item.Title, FeedURL: item.URL})
	}
	states := make(map[string]ItemState)
	for _, id := range commaIDs(result.UnreadIDs) {
		states[id] = ItemState{RemoteID: id, Read: boolPointer(false)}
		if parseInt64(id) > parseInt64(delta.Cursor) {
			delta.Cursor = id
		}
	}
	for _, id := range commaIDs(result.SavedIDs) {
		state := states[id]
		state.RemoteID = id
		state.Starred = boolPointer(true)
		states[id] = state
	}
	for _, item := range result.Items {
		key := strconv.FormatInt(item.ID, 10)
		state, exists := states[key]
		if !exists {
			continue
		}
		state.FeedRemoteID = strconv.FormatInt(item.FeedID, 10)
		state.CanonicalURL = item.URL
		states[key] = state
	}
	for _, state := range states {
		delta.States = append(delta.States, state)
	}
	return delta, nil
}

func (a *feverAdapter) Push(ctx context.Context, states []ItemState) error {
	for _, state := range states {
		if state.Read != nil {
			as := "unread"
			if *state.Read {
				as = "read"
			}
			response, err := a.form(ctx, "", url.Values{"api": {"1"}, "mark": {"item"}, "as": {as}, "id": {state.RemoteID}}, url.Values{"api_key": {a.credentials.APIKey}})
			if err != nil {
				return err
			}
			response.Body.Close()
		}
		if state.Starred != nil {
			as := "unsaved"
			if *state.Starred {
				as = "saved"
			}
			response, err := a.form(ctx, "", url.Values{"api": {"1"}, "mark": {"item"}, "as": {as}, "id": {state.RemoteID}}, url.Values{"api_key": {a.credentials.APIKey}})
			if err != nil {
				return err
			}
			response.Body.Close()
		}
	}
	return nil
}

func commaIDs(value string) []string {
	result := make([]string, 0)
	for _, item := range strings.Split(value, ",") {
		if item = strings.TrimSpace(item); item != "" {
			result = append(result, item)
		}
	}
	return result
}
