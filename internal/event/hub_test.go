package event

import (
	"testing"
	"time"
)

func TestHubPublishesToSubscribers(t *testing.T) {
	hub := NewHub()
	channel, unsubscribe := hub.Subscribe()
	defer unsubscribe()

	hub.Publish("feed.updated", map[string]string{"id": "feed-1"})
	select {
	case event := <-channel:
		if event.Type != "feed.updated" || event.ID == 0 {
			t.Fatalf("unexpected event: %+v", event)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for event")
	}
}
