package job

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/cairn-reader/cairn/internal/domain"
	"github.com/cairn-reader/cairn/internal/event"
	feedcore "github.com/cairn-reader/cairn/internal/feed"
	"github.com/cairn-reader/cairn/internal/storage"
)

type ProgressFunc func(current, total int)
type Handler func(ctx context.Context, job domain.Job, progress ProgressFunc) error

type Manager struct {
	db       *sql.DB
	hub      *event.Hub
	logger   *slog.Logger
	workers  int
	handlers map[string]Handler
	queue    chan domain.Job
	start    sync.Once
	cancelMu sync.Mutex
	cancels  map[string]context.CancelFunc
}

func NewManager(db *sql.DB, hub *event.Hub, logger *slog.Logger, workers int) *Manager {
	if workers < 1 {
		workers = 4
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &Manager{
		db: db, hub: hub, logger: logger, workers: workers,
		handlers: make(map[string]Handler), queue: make(chan domain.Job, workers),
		cancels: make(map[string]context.CancelFunc),
	}
}

func (m *Manager) Cancel(ctx context.Context, jobID string) (domain.Job, error) {
	cancelled, err := storage.CancelJob(ctx, m.db, jobID)
	if err != nil {
		return domain.Job{}, err
	}
	m.cancelMu.Lock()
	cancel := m.cancels[jobID]
	m.cancelMu.Unlock()
	if cancel != nil {
		cancel()
	}
	m.publish("job.cancelled", cancelled)
	return cancelled, nil
}

func (m *Manager) Register(kind string, handler Handler) {
	m.handlers[kind] = handler
}

func (m *Manager) Start(ctx context.Context) error {
	if err := storage.RecoverRunningJobs(ctx, m.db); err != nil {
		return err
	}
	m.start.Do(func() {
		for range m.workers {
			go m.worker(ctx)
		}
		go m.dispatch(ctx)
	})
	return nil
}

func (m *Manager) Enqueue(ctx context.Context, kind string, payload any) (domain.Job, error) {
	job, err := storage.CreateJob(ctx, m.db, kind, payload, time.Now().UTC())
	if err == nil {
		m.publish("job.queued", job)
	}
	return job, err
}

func (m *Manager) EnqueueFeedRefresh(ctx context.Context, feedID string) (domain.Job, error) {
	pending, err := storage.HasPendingFeedRefresh(ctx, m.db, feedID)
	if err != nil {
		return domain.Job{}, err
	}
	if pending {
		return domain.Job{}, errors.New("feed refresh is already queued")
	}
	return m.Enqueue(ctx, "feed.refresh", map[string]string{"feed_id": feedID})
}

func (m *Manager) EnqueueAccountSync(ctx context.Context, accountID string) (domain.Job, error) {
	pending, err := storage.HasPendingAccountSync(ctx, m.db, accountID)
	if err != nil {
		return domain.Job{}, err
	}
	if pending {
		return domain.Job{}, errors.New("account sync is already queued")
	}
	return m.Enqueue(ctx, "sync.account", map[string]string{"account_id": accountID})
}

func (m *Manager) StartFeedScheduler(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = time.Minute
	}
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		m.scheduleDueFeeds(ctx)
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				m.scheduleDueFeeds(ctx)
			}
		}
	}()
}

func (m *Manager) StartSyncScheduler(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = time.Minute
	}
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		m.scheduleDueSyncAccounts(ctx)
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				m.scheduleDueSyncAccounts(ctx)
			}
		}
	}()
}

func DecodePayload(job domain.Job, target any) error {
	if err := json.Unmarshal([]byte(job.PayloadJSON), target); err != nil {
		return fmt.Errorf("decode %s job payload: %w", job.Kind, err)
	}
	return nil
}

func (m *Manager) dispatch(ctx context.Context) {
	ticker := time.NewTicker(350 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			job, err := storage.ClaimNextJob(ctx, m.db)
			if err != nil {
				if !errors.Is(err, context.Canceled) {
					m.logger.ErrorContext(ctx, "claim background job", "error", err)
				}
				continue
			}
			if job == nil {
				continue
			}
			select {
			case m.queue <- *job:
			case <-ctx.Done():
				return
			}
		}
	}
}

func (m *Manager) worker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case current := <-m.queue:
			m.execute(ctx, current)
		}
	}
}

func (m *Manager) execute(ctx context.Context, current domain.Job) {
	jobCtx, cancel := context.WithCancel(ctx)
	m.cancelMu.Lock()
	m.cancels[current.ID] = cancel
	m.cancelMu.Unlock()
	defer func() {
		cancel()
		m.cancelMu.Lock()
		delete(m.cancels, current.ID)
		m.cancelMu.Unlock()
	}()
	m.publish("job.started", current)
	attemptID, attemptErr := storage.BeginJobAttempt(jobCtx, m.db, current.ID)
	if attemptErr != nil {
		m.logger.WarnContext(ctx, "record job attempt", "job_id", current.ID, "error", attemptErr)
	}
	handler, exists := m.handlers[current.Kind]
	if !exists {
		m.fail(ctx, current, attemptID, "unsupported_job", "No handler is registered for this job kind")
		return
	}
	progress := func(completed, total int) {
		if err := storage.UpdateJobProgress(jobCtx, m.db, current.ID, completed, total); err != nil {
			m.logger.WarnContext(ctx, "update job progress", "job_id", current.ID, "error", err)
			return
		}
		m.publish("job.progress", map[string]any{"id": current.ID, "current": completed, "total": total})
	}
	if err := handler(jobCtx, current, progress); err != nil {
		if stored, getErr := storage.GetJob(context.Background(), m.db, current.ID); getErr == nil && stored.State == "cancelled" {
			if attemptID != "" {
				_ = storage.FinishJobAttempt(context.Background(), m.db, attemptID, "cancelled", "cancelled", "Cancelled by user")
			}
			return
		}
		code := jobErrorCode(err)
		m.fail(jobCtx, current, attemptID, code, err.Error())
		return
	}
	if attemptID != "" {
		_ = storage.FinishJobAttempt(ctx, m.db, attemptID, "succeeded", "", "")
	}
	if err := storage.CompleteJob(ctx, m.db, current.ID); err != nil {
		m.logger.ErrorContext(ctx, "complete job", "job_id", current.ID, "error", err)
		return
	}
	if completed, err := storage.GetJob(ctx, m.db, current.ID); err == nil {
		m.publish("job.succeeded", completed)
	}
}

func (m *Manager) fail(ctx context.Context, current domain.Job, attemptID, code, message string) {
	if attemptID != "" {
		_ = storage.FinishJobAttempt(ctx, m.db, attemptID, "failed", code, message)
	}
	if err := storage.FailJob(ctx, m.db, current.ID, code, message); err != nil {
		m.logger.ErrorContext(ctx, "fail job", "job_id", current.ID, "error", err)
		return
	}
	if failed, err := storage.GetJob(ctx, m.db, current.ID); err == nil {
		m.publish("job.failed", failed)
	}
}

func (m *Manager) scheduleDueFeeds(ctx context.Context) {
	feeds, err := storage.ListDueFeeds(ctx, m.db, 100)
	if err != nil {
		m.logger.ErrorContext(ctx, "list due feeds", "error", err)
		return
	}
	for _, stored := range feeds {
		if _, err := m.EnqueueFeedRefresh(ctx, stored.ID); err != nil && err.Error() != "feed refresh is already queued" {
			m.logger.WarnContext(ctx, "schedule feed refresh", "feed_id", stored.ID, "error", err)
		}
	}
}

func (m *Manager) scheduleDueSyncAccounts(ctx context.Context) {
	accounts, err := storage.ListDueSyncAccounts(ctx, m.db, 100)
	if err != nil {
		m.logger.ErrorContext(ctx, "list due sync accounts", "error", err)
		return
	}
	for _, account := range accounts {
		if _, err := m.EnqueueAccountSync(ctx, account.ID); err != nil && err.Error() != "account sync is already queued" {
			m.logger.WarnContext(ctx, "schedule account sync", "account_id", account.ID, "error", err)
		}
	}
}

func jobErrorCode(err error) string {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return "cancelled"
	}
	var fetchError *feedcore.FetchError
	if errors.As(err, &fetchError) {
		return fetchError.Code
	}
	return "job_failed"
}

func (m *Manager) publish(eventType string, value any) {
	if m.hub != nil {
		m.hub.Publish(eventType, value)
	}
}
