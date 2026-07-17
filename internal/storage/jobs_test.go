package storage

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

func TestJobLifecycleAndRecovery(t *testing.T) {
	ctx := context.Background()
	db, err := Open(ctx, filepath.Join(t.TempDir(), "cairn.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	created, err := CreateJob(ctx, db, "test", map[string]string{"value": "one"}, time.Now().UTC())
	if err != nil {
		t.Fatal(err)
	}
	claimed, err := ClaimNextJob(ctx, db)
	if err != nil || claimed == nil || claimed.ID != created.ID || claimed.State != "running" {
		t.Fatalf("unexpected claimed job: %+v, %v", claimed, err)
	}
	if err := UpdateJobProgress(ctx, db, claimed.ID, 1, 2); err != nil {
		t.Fatal(err)
	}
	if err := RecoverRunningJobs(ctx, db); err != nil {
		t.Fatal(err)
	}
	recovered, err := GetJob(ctx, db, claimed.ID)
	if err != nil || recovered.State != "queued" || recovered.StartedAt != nil {
		t.Fatalf("unexpected recovered job: %+v, %v", recovered, err)
	}
	claimed, err = ClaimNextJob(ctx, db)
	if err != nil || claimed == nil {
		t.Fatalf("reclaim job: %+v, %v", claimed, err)
	}
	attemptID, err := BeginJobAttempt(ctx, db, claimed.ID)
	if err != nil || attemptID == "" {
		t.Fatalf("begin attempt: %s, %v", attemptID, err)
	}
	if err := FinishJobAttempt(ctx, db, attemptID, "succeeded", "", ""); err != nil {
		t.Fatal(err)
	}
	if err := CompleteJob(ctx, db, claimed.ID); err != nil {
		t.Fatal(err)
	}
	completed, err := GetJob(ctx, db, claimed.ID)
	if err != nil || completed.State != "succeeded" || completed.FinishedAt == nil {
		t.Fatalf("unexpected completed job: %+v, %v", completed, err)
	}
}
