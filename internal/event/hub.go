package event

import (
	"encoding/json"
	"sync"
	"sync/atomic"
	"time"
)

type Event struct {
	ID   uint64          `json:"id"`
	Type string          `json:"type"`
	Time time.Time       `json:"time"`
	Data json.RawMessage `json:"data"`
}

type Hub struct {
	mu          sync.RWMutex
	subscribers map[chan Event]struct{}
	nextID      atomic.Uint64
}

func NewHub() *Hub {
	return &Hub{subscribers: make(map[chan Event]struct{})}
}

func (h *Hub) Subscribe() (<-chan Event, func()) {
	channel := make(chan Event, 32)
	h.mu.Lock()
	h.subscribers[channel] = struct{}{}
	h.mu.Unlock()
	return channel, func() {
		h.mu.Lock()
		if _, exists := h.subscribers[channel]; exists {
			delete(h.subscribers, channel)
			close(channel)
		}
		h.mu.Unlock()
	}
}

func (h *Hub) Publish(eventType string, value any) {
	data, err := json.Marshal(value)
	if err != nil {
		return
	}
	event := Event{
		ID:   h.nextID.Add(1),
		Type: eventType,
		Time: time.Now().UTC(),
		Data: data,
	}

	h.mu.RLock()
	defer h.mu.RUnlock()
	for subscriber := range h.subscribers {
		select {
		case subscriber <- event:
		default:
			// Slow clients receive the next state snapshot after reconnecting.
		}
	}
}
