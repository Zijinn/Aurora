package service

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Zijinn/Aurora/internal/domain"
	feedcore "github.com/Zijinn/Aurora/internal/feed"
	"github.com/Zijinn/Aurora/internal/secretbox"
	"github.com/Zijinn/Aurora/internal/storage"
	"github.com/Zijinn/Aurora/internal/syncadapter"
	"github.com/google/uuid"
)

var supportedSyncProviders = map[string]string{
	"freshrss":       "FreshRSS",
	"google_reader":  "Google Reader compatible",
	"miniflux":       "Miniflux",
	"fever":          "Fever",
	"feedbin":        "Feedbin",
	"nextcloud_news": "Nextcloud News",
	"webdav":         "WebDAV",
	"icloud":         "iCloud Drive",
}

type SyncAccountInput struct {
	Provider            string
	Name                string
	Endpoint            string
	Credentials         syncadapter.Credentials
	Enabled             *bool
	AllowPrivateNetwork bool
	SyncIntervalMinutes int
}

type SyncAccountUpdate struct {
	Name                *string
	Endpoint            *string
	Credentials         *syncadapter.Credentials
	Enabled             *bool
	AllowPrivateNetwork *bool
	SyncIntervalMinutes *int
}

type SyncResult struct {
	PushedStates        int    `json:"pushed_states"`
	PulledStates        int    `json:"pulled_states"`
	MappedSubscriptions int    `json:"mapped_subscriptions"`
	SkippedRemoteStates int    `json:"skipped_remote_states"`
	Action              string `json:"action,omitempty"`
	LocalFingerprint    string `json:"local_fingerprint,omitempty"`
	RemoteFingerprint   string `json:"remote_fingerprint,omitempty"`
}

type SyncProgressFunc func(current, total int)
type syncClientFactory func(allowPrivate bool) *http.Client

type SyncService struct {
	db            *sql.DB
	feeds         *FeedService
	box           *secretbox.Box
	clientFactory syncClientFactory
}

func NewSyncService(db *sql.DB, feeds *FeedService, box *secretbox.Box) *SyncService {
	return newSyncService(db, feeds, box, func(allowPrivate bool) *http.Client {
		policy := feedcore.DefaultURLPolicy()
		policy.AllowPrivate = allowPrivate
		return syncadapter.SecureHTTPClient(policy)
	})
}

func newSyncService(db *sql.DB, feeds *FeedService, box *secretbox.Box, factory syncClientFactory) *SyncService {
	return &SyncService{db: db, feeds: feeds, box: box, clientFactory: factory}
}

func SupportedSyncProviders() map[string]string {
	items := make(map[string]string, len(supportedSyncProviders))
	for key, value := range supportedSyncProviders {
		items[key] = value
	}
	return items
}

func (s *SyncService) ListAccounts(ctx context.Context) ([]domain.SyncAccount, error) {
	return storage.ListSyncAccounts(ctx, s.db, domain.DefaultProfileID)
}

func (s *SyncService) CreateAccount(ctx context.Context, input SyncAccountInput) (domain.SyncAccount, error) {
	provider, name, endpoint, interval, err := validateSyncAccount(input.Provider, input.Name, input.Endpoint, input.SyncIntervalMinutes, input.Credentials)
	if err != nil {
		return domain.SyncAccount{}, err
	}
	if s.box == nil {
		return domain.SyncAccount{}, errors.New("credential encryption is not configured")
	}
	accountID := uuid.NewString()
	encrypted, err := s.encryptCredentials(accountID, input.Credentials)
	if err != nil {
		return domain.SyncAccount{}, err
	}
	enabled := true
	if input.Enabled != nil {
		enabled = *input.Enabled
	}
	return storage.CreateSyncAccount(ctx, s.db, storage.CreateSyncAccountParams{
		ID: accountID, ProfileID: domain.DefaultProfileID, Provider: provider, Name: name,
		Endpoint: endpoint, EncryptedCredentials: encrypted, Enabled: enabled,
		AllowPrivateNetwork: input.AllowPrivateNetwork, SyncIntervalMinutes: interval,
	})
}

func (s *SyncService) UpdateAccount(ctx context.Context, accountID string, input SyncAccountUpdate) (domain.SyncAccount, error) {
	record, err := storage.GetSyncAccountRecord(ctx, s.db, domain.DefaultProfileID, accountID)
	if err != nil {
		return domain.SyncAccount{}, err
	}
	credentials, err := s.decryptCredentials(record)
	if err != nil {
		return domain.SyncAccount{}, err
	}
	if input.Credentials != nil {
		credentials = *input.Credentials
	}
	name := record.Account.Name
	if input.Name != nil {
		name = *input.Name
	}
	endpoint := record.Account.Endpoint
	if input.Endpoint != nil {
		endpoint = *input.Endpoint
	}
	interval := record.Account.SyncIntervalMinutes
	if input.SyncIntervalMinutes != nil {
		interval = *input.SyncIntervalMinutes
	}
	_, name, endpoint, interval, err = validateSyncAccount(record.Account.Provider, name, endpoint, interval, credentials)
	if err != nil {
		return domain.SyncAccount{}, err
	}
	patch := storage.SyncAccountPatch{
		Name: input.Name, Endpoint: input.Endpoint, Enabled: input.Enabled,
		AllowPrivateNetwork: input.AllowPrivateNetwork, SyncIntervalMinutes: input.SyncIntervalMinutes,
	}
	if input.Name != nil {
		patch.Name = &name
	}
	if input.Endpoint != nil {
		patch.Endpoint = &endpoint
	}
	if input.Credentials != nil {
		patch.EncryptedCredentials, err = s.encryptCredentials(accountID, credentials)
		if err != nil {
			return domain.SyncAccount{}, err
		}
		patch.SetEncryptedCredentials = true
	}
	return storage.UpdateSyncAccount(ctx, s.db, domain.DefaultProfileID, accountID, patch)
}

func (s *SyncService) DeleteAccount(ctx context.Context, accountID string) error {
	return storage.DeleteSyncAccount(ctx, s.db, domain.DefaultProfileID, accountID)
}

func (s *SyncService) Run(ctx context.Context, accountID string, progress SyncProgressFunc, requestedMode ...string) (result SyncResult, returnedErr error) {
	record, err := storage.GetSyncAccountRecord(ctx, s.db, domain.DefaultProfileID, accountID)
	if err != nil {
		return result, err
	}
	if !record.Account.Enabled {
		return result, errors.New("sync account is disabled")
	}
	startedAt := time.Now().UTC()
	if err := storage.MarkSyncStarted(ctx, s.db, accountID, startedAt); err != nil {
		return result, err
	}
	defer func() {
		if returnedErr == nil {
			return
		}
		code := syncadapter.ErrorCode(returnedErr)
		retryAt := startedAt.Add(time.Duration(record.Account.SyncIntervalMinutes) * time.Minute)
		if syncadapter.Retryable(returnedErr) {
			retryAt = startedAt.Add(5 * time.Minute)
		}
		_ = storage.FailSync(context.Background(), s.db, accountID, code, returnedErr.Error(), retryAt)
	}()

	credentials, err := s.decryptCredentials(record)
	if err != nil {
		return result, err
	}
	if isLibrarySyncProvider(record.Account.Provider) {
		mode := "auto"
		if len(requestedMode) > 0 && strings.TrimSpace(requestedMode[0]) != "" {
			mode = strings.ToLower(strings.TrimSpace(requestedMode[0]))
		}
		return s.runLibrarySync(ctx, record, credentials, mode, progress, startedAt)
	}
	adapter, err := syncadapter.New(record.Account.Provider, record.Account.Endpoint, credentials, s.clientFactory(record.Account.AllowPrivateNetwork))
	if err != nil {
		return result, err
	}
	if progress != nil {
		progress(0, 4)
	}
	if record.Account.LastSyncAt != nil {
		changes, err := storage.ListSyncStateChanges(ctx, s.db, accountID, *record.Account.LastSyncAt)
		if err != nil {
			return result, err
		}
		states := make([]syncadapter.ItemState, 0, len(changes))
		for _, change := range changes {
			read, starred := change.Read, change.Starred
			states = append(states, syncadapter.ItemState{RemoteID: change.RemoteID, Read: &read, Starred: &starred})
		}
		if len(states) > 0 {
			if err := adapter.Push(ctx, states); err != nil {
				return result, err
			}
		}
		result.PushedStates = len(states)
	}
	if progress != nil {
		progress(1, 4)
	}
	delta, err := adapter.Pull(ctx, decodeSyncCursor(record.Cursor))
	if err != nil {
		return result, err
	}
	if progress != nil {
		progress(2, 4)
	}
	for _, subscription := range delta.Subscriptions {
		mapped, mapErr := s.reconcileSubscription(ctx, accountID, subscription)
		if mapErr != nil {
			return result, mapErr
		}
		if mapped {
			result.MappedSubscriptions++
		}
	}
	for _, state := range delta.States {
		applied, applyErr := s.applyRemoteState(ctx, record.Account, delta.Cursor, state)
		if applyErr != nil {
			return result, applyErr
		}
		if applied {
			result.PulledStates++
		} else {
			result.SkippedRemoteStates++
		}
	}
	if progress != nil {
		progress(3, 4)
	}
	cursorBody, err := json.Marshal(map[string]string{"cursor": delta.Cursor})
	if err != nil {
		return result, err
	}
	if err := storage.CompleteSync(ctx, s.db, accountID, string(cursorBody), startedAt); err != nil {
		return result, err
	}
	if progress != nil {
		progress(4, 4)
	}
	return result, nil
}

func (s *SyncService) reconcileSubscription(ctx context.Context, accountID string, remote syncadapter.Subscription) (bool, error) {
	canonicalURL, err := feedcore.NormalizeURL(remote.FeedURL)
	if err != nil {
		return false, fmt.Errorf("normalize remote subscription %q: %w", remote.Title, err)
	}
	stored, err := storage.FindFeedByCanonicalURL(ctx, s.db, domain.DefaultProfileID, canonicalURL)
	var folderID *string
	if strings.TrimSpace(remote.Folder) != "" {
		folder, folderErr := storage.EnsureFolder(ctx, s.db, domain.DefaultProfileID, nil, strings.TrimSpace(remote.Folder))
		if folderErr != nil {
			return false, folderErr
		}
		folderID = &folder.ID
	}
	if errors.Is(err, storage.ErrNotFound) {
		stored, err = s.feeds.AddFeed(ctx, AddFeedInput{URL: remote.FeedURL, FolderID: folderID, TitleOverride: stringPointer(remote.Title)})
	} else if err == nil && folderID != nil {
		_, err = storage.UpdateSubscription(ctx, s.db, domain.DefaultProfileID, stored.ID, domain.SubscriptionPatch{SetFolderID: true, FolderID: folderID})
	}
	if err != nil {
		return false, err
	}
	if err := storage.UpsertSyncMapping(ctx, s.db, accountID, "feed", stored.ID, remote.RemoteID); err != nil {
		return false, err
	}
	return true, nil
}

func (s *SyncService) applyRemoteState(ctx context.Context, account domain.SyncAccount, cursor string, remote syncadapter.ItemState) (bool, error) {
	canonicalURL := ""
	if strings.TrimSpace(remote.CanonicalURL) != "" {
		if normalized, err := feedcore.NormalizeURL(remote.CanonicalURL); err == nil {
			canonicalURL = normalized
		}
	}
	entryID, err := storage.FindEntryForSync(ctx, s.db, account.ID, remote.RemoteID, remote.FeedRemoteID, remote.GUID, canonicalURL)
	if errors.Is(err, storage.ErrNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if account.LastSyncAt != nil {
		changed, err := storage.EntryStateChangedAfter(ctx, s.db, domain.DefaultProfileID, entryID, *account.LastSyncAt)
		if err != nil {
			return false, err
		}
		if changed {
			return false, nil
		}
	}
	if err := storage.UpsertSyncMapping(ctx, s.db, account.ID, "entry", entryID, remote.RemoteID); err != nil {
		return false, err
	}
	if remote.Read == nil && remote.Starred == nil {
		return true, nil
	}
	mutationID := syncMutationID(account.ID, cursor, remote)
	_, err = storage.UpdateEntryState(ctx, s.db, domain.DefaultProfileID, entryID, domain.EntryStatePatch{
		MutationID: mutationID, IsRead: remote.Read, IsStarred: remote.Starred,
	})
	return err == nil, err
}

func (s *SyncService) encryptCredentials(accountID string, credentials syncadapter.Credentials) ([]byte, error) {
	body, err := json.Marshal(credentials)
	if err != nil {
		return nil, fmt.Errorf("encode sync credentials: %w", err)
	}
	encrypted, err := s.box.Seal(body, syncAssociatedData(accountID))
	if err != nil {
		return nil, fmt.Errorf("encrypt sync credentials: %w", err)
	}
	return encrypted, nil
}

func (s *SyncService) decryptCredentials(record storage.SyncAccountRecord) (syncadapter.Credentials, error) {
	if s.box == nil {
		return syncadapter.Credentials{}, errors.New("credential encryption is not configured")
	}
	body, err := s.box.Open(record.EncryptedCredentials, syncAssociatedData(record.Account.ID))
	if err != nil {
		return syncadapter.Credentials{}, fmt.Errorf("decrypt sync credentials: %w", err)
	}
	var credentials syncadapter.Credentials
	if err := json.Unmarshal(body, &credentials); err != nil {
		return syncadapter.Credentials{}, fmt.Errorf("decode sync credentials: %w", err)
	}
	return credentials, nil
}

func validateSyncAccount(provider, name, endpoint string, interval int, credentials syncadapter.Credentials) (string, string, string, int, error) {
	provider = strings.ToLower(strings.TrimSpace(provider))
	label, supported := supportedSyncProviders[provider]
	if !supported {
		return "", "", "", 0, fmt.Errorf("unsupported sync provider %q", provider)
	}
	name = strings.TrimSpace(name)
	if name == "" {
		name = label
	}
	if len(name) > 120 {
		return "", "", "", 0, errors.New("sync account name is too long")
	}
	if isLibrarySyncProvider(provider) {
		endpoint, err := normalizeLibrarySyncEndpoint(provider, endpoint)
		if err != nil {
			return "", "", "", 0, err
		}
		if interval == 0 {
			interval = 30
		}
		if interval < 5 || interval > 10080 {
			return "", "", "", 0, errors.New("sync interval must be between 5 and 10080 minutes")
		}
		return provider, name, endpoint, interval, nil
	}
	endpoint = strings.TrimRight(strings.TrimSpace(endpoint), "/")
	parsed, err := url.Parse(endpoint)
	if err != nil || parsed.Host == "" || parsed.User != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "", "", "", 0, errors.New("sync endpoint must be an HTTP or HTTPS URL without embedded credentials")
	}
	if interval == 0 {
		interval = 30
	}
	if interval < 5 || interval > 10080 {
		return "", "", "", 0, errors.New("sync interval must be between 5 and 10080 minutes")
	}
	if provider == "fever" {
		if strings.TrimSpace(credentials.APIKey) == "" {
			return "", "", "", 0, errors.New("Fever API key is required")
		}
	} else if strings.TrimSpace(credentials.Token) == "" && strings.TrimSpace(credentials.Username) == "" {
		return "", "", "", 0, errors.New("a token or username is required")
	}
	return provider, name, endpoint, interval, nil
}

func syncAssociatedData(accountID string) []byte {
	return []byte("cairn:sync-account:" + accountID)
}

func decodeSyncCursor(raw string) string {
	var value struct {
		Cursor string `json:"cursor"`
	}
	if json.Unmarshal([]byte(raw), &value) == nil {
		return value.Cursor
	}
	return ""
}

func syncMutationID(accountID, cursor string, state syncadapter.ItemState) string {
	body := fmt.Sprintf("%s\x00%s\x00%s\x00%s\x00%s\x00%s", accountID, cursor, state.RemoteID, optionalBoolToken(state.Read), optionalBoolToken(state.Starred), state.RemoteUpdated)
	digest := sha256.Sum256([]byte(body))
	return "sync-" + hex.EncodeToString(digest[:])
}

func optionalBoolToken(value *bool) string {
	if value == nil {
		return "unset"
	}
	if *value {
		return "true"
	}
	return "false"
}
