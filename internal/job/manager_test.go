package job

import (
	"context"
	"io"
	"log/slog"
	"path/filepath"
	"testing"
	"time"

	"github.com/cairn-reader/cairn/internal/domain"
	"github.com/cairn-reader/cairn/internal/event"
	"github.com/cairn-reader/cairn/internal/storage"
)

func TestManagerCancelsRunningJob(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	db, err := storage.Open(ctx, filepath.Join(t.TempDir(), "cairn.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	manager := NewManager(db, event.NewHub(), slog.New(slog.NewTextHandler(io.Discard, nil)), 1)
	started := make(chan struct{})
	stopped := make(chan struct{})
	manager.Register("test.blocking", func(ctx context.Context, _ domain.Job, _ ProgressFunc) error {
		close(started)
		<-ctx.Done()
		close(stopped)
		return ctx.Err()
	})
	if err := manager.Start(ctx); err != nil {
		t.Fatal(err)
	}
	queued, err := manager.Enqueue(ctx, "test.blocking", map[string]string{"test": "cancel"})
	if err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("job did not start")
	}
	cancelled, err := manager.Cancel(ctx, queued.ID)
	if err != nil {
		t.Fatal(err)
	}
	if cancelled.State != "cancelled" {
		t.Fatalf("unexpected cancelled state: %+v", cancelled)
	}
	select {
	case <-stopped:
	case <-time.After(time.Second):
		t.Fatal("running handler did not receive cancellation")
	}
	deadline := time.Now().Add(time.Second)
	for {
		var result string
		err := db.QueryRowContext(ctx, `SELECT COALESCE(result, '') FROM job_attempts
			WHERE job_id = ? ORDER BY attempt DESC LIMIT 1`, queued.ID).Scan(&result)
		if err == nil && result == "cancelled" {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("cancelled attempt not recorded: result=%q err=%v", result, err)
		}
		time.Sleep(20 * time.Millisecond)
	}
}
