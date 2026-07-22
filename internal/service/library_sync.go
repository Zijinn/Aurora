package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/Zijinn/Aurora/internal/storage"
	"github.com/Zijinn/Aurora/internal/syncadapter"
)

const maxLibrarySnapshotBytes int64 = 128 << 20

type librarySyncCursor struct {
	LocalFingerprint  string `json:"local_fingerprint"`
	RemoteFingerprint string `json:"remote_fingerprint"`
}

func isLibrarySyncProvider(provider string) bool {
	return provider == "webdav" || provider == "icloud"
}

func (s *SyncService) runLibrarySync(
	ctx context.Context,
	record storage.SyncAccountRecord,
	credentials syncadapter.Credentials,
	mode string,
	progress SyncProgressFunc,
	startedAt time.Time,
) (SyncResult, error) {
	if mode != "auto" && mode != "push" && mode != "pull" {
		return SyncResult{}, errors.New("library sync mode must be auto, push, or pull")
	}
	if progress != nil {
		progress(0, 3)
	}
	local, err := storage.ExportLibrarySnapshot(ctx, s.db)
	if err != nil {
		return SyncResult{}, err
	}
	localHash, err := storage.LibrarySnapshotFingerprint(local)
	if err != nil {
		return SyncResult{}, err
	}
	remote, remoteExists, err := s.readRemoteSnapshot(ctx, record, credentials)
	if err != nil {
		return SyncResult{}, err
	}
	remoteHash := ""
	if remoteExists {
		remoteHash, err = storage.LibrarySnapshotFingerprint(remote)
		if err != nil {
			return SyncResult{}, err
		}
	}
	if progress != nil {
		progress(1, 3)
	}

	cursor := decodeLibrarySyncCursor(record.Cursor)
	action := mode
	if mode == "auto" {
		action, err = chooseLibrarySyncAction(local, localHash, remoteExists, remoteHash, cursor)
		if err != nil {
			return SyncResult{Action: "conflict", LocalFingerprint: localHash, RemoteFingerprint: remoteHash}, err
		}
	}

	switch action {
	case "push":
		if err := s.writeRemoteSnapshot(ctx, record, credentials, local); err != nil {
			return SyncResult{}, err
		}
		remoteHash = localHash
	case "pull":
		if !remoteExists {
			return SyncResult{}, &syncadapter.Error{Code: "remote_missing", Err: errors.New("the remote Aurora snapshot does not exist")}
		}
		if err := storage.RestoreLibrarySnapshot(ctx, s.db, remote); err != nil {
			return SyncResult{}, err
		}
		localHash = remoteHash
	case "noop":
	default:
		return SyncResult{}, fmt.Errorf("unsupported library sync action %q", action)
	}
	if progress != nil {
		progress(2, 3)
	}
	cursorBody, err := json.Marshal(librarySyncCursor{LocalFingerprint: localHash, RemoteFingerprint: remoteHash})
	if err != nil {
		return SyncResult{}, err
	}
	if err := storage.CompleteSync(ctx, s.db, record.Account.ID, string(cursorBody), startedAt); err != nil {
		return SyncResult{}, err
	}
	if progress != nil {
		progress(3, 3)
	}
	return SyncResult{Action: action, LocalFingerprint: localHash, RemoteFingerprint: remoteHash}, nil
}

func chooseLibrarySyncAction(local storage.BackupDocument, localHash string, remoteExists bool, remoteHash string, cursor librarySyncCursor) (string, error) {
	if !remoteExists {
		return "push", nil
	}
	if localHash == remoteHash {
		return "noop", nil
	}
	if cursor.LocalFingerprint == "" && cursor.RemoteFingerprint == "" {
		if storage.LibrarySnapshotIsEmpty(local) {
			return "pull", nil
		}
		return "", &syncadapter.Error{Code: "conflict", Err: errors.New("both the local library and remote snapshot contain different data; choose upload or restore")}
	}
	localChanged := localHash != cursor.LocalFingerprint
	remoteChanged := remoteHash != cursor.RemoteFingerprint
	switch {
	case localChanged && !remoteChanged:
		return "push", nil
	case !localChanged && remoteChanged:
		return "pull", nil
	case !localChanged && !remoteChanged:
		return "noop", nil
	default:
		return "", &syncadapter.Error{Code: "conflict", Err: errors.New("the local library and remote snapshot changed independently; choose which copy to keep")}
	}
}

func (s *SyncService) readRemoteSnapshot(ctx context.Context, record storage.SyncAccountRecord, credentials syncadapter.Credentials) (storage.BackupDocument, bool, error) {
	var body []byte
	if record.Account.Provider == "icloud" {
		var err error
		body, err = os.ReadFile(record.Account.Endpoint)
		if errors.Is(err, os.ErrNotExist) {
			return storage.BackupDocument{}, false, nil
		}
		if err != nil {
			return storage.BackupDocument{}, false, fmt.Errorf("read iCloud snapshot: %w", err)
		}
		if int64(len(body)) > maxLibrarySnapshotBytes {
			return storage.BackupDocument{}, false, errors.New("iCloud snapshot is too large")
		}
	} else {
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, record.Account.Endpoint, nil)
		if err != nil {
			return storage.BackupDocument{}, false, err
		}
		request.Header.Set("Accept", "application/json")
		authorizeLibrarySyncRequest(request, credentials)
		response, err := s.clientFactory(record.Account.AllowPrivateNetwork).Do(request)
		if err != nil {
			return storage.BackupDocument{}, false, &syncadapter.Error{Code: "network_error", Retryable: !errors.Is(err, context.Canceled), Err: err}
		}
		defer response.Body.Close()
		if response.StatusCode == http.StatusNotFound {
			return storage.BackupDocument{}, false, nil
		}
		if response.StatusCode < 200 || response.StatusCode >= 300 {
			return storage.BackupDocument{}, false, webDAVStatusError(response.StatusCode)
		}
		body, err = io.ReadAll(io.LimitReader(response.Body, maxLibrarySnapshotBytes+1))
		if err != nil {
			return storage.BackupDocument{}, false, err
		}
		if int64(len(body)) > maxLibrarySnapshotBytes {
			return storage.BackupDocument{}, false, errors.New("WebDAV snapshot is too large")
		}
	}
	var document storage.BackupDocument
	if err := json.Unmarshal(body, &document); err != nil {
		return storage.BackupDocument{}, false, fmt.Errorf("decode remote Aurora snapshot: %w", err)
	}
	if document.Format != storage.LibrarySnapshotFormat || document.Version != 1 {
		return storage.BackupDocument{}, false, errors.New("remote file is not an Aurora library snapshot")
	}
	return document, true, nil
}

func (s *SyncService) writeRemoteSnapshot(ctx context.Context, record storage.SyncAccountRecord, credentials syncadapter.Credentials, document storage.BackupDocument) error {
	body, err := json.Marshal(document)
	if err != nil {
		return fmt.Errorf("encode Aurora snapshot: %w", err)
	}
	if int64(len(body)) > maxLibrarySnapshotBytes {
		return errors.New("Aurora snapshot is too large to synchronize")
	}
	if record.Account.Provider == "icloud" {
		if err := os.MkdirAll(filepath.Dir(record.Account.Endpoint), 0o700); err != nil {
			return fmt.Errorf("create iCloud snapshot directory: %w", err)
		}
		temporary, err := os.CreateTemp(filepath.Dir(record.Account.Endpoint), ".aurora-sync-*.tmp")
		if err != nil {
			return fmt.Errorf("create iCloud snapshot: %w", err)
		}
		temporaryName := temporary.Name()
		defer os.Remove(temporaryName)
		if err := temporary.Chmod(0o600); err != nil {
			temporary.Close()
			return fmt.Errorf("secure iCloud snapshot: %w", err)
		}
		if _, err := temporary.Write(body); err != nil {
			temporary.Close()
			return fmt.Errorf("write iCloud snapshot: %w", err)
		}
		closeErr := temporary.Close()
		if closeErr != nil {
			return fmt.Errorf("close iCloud snapshot: %w", closeErr)
		}
		if err := os.Rename(temporaryName, record.Account.Endpoint); err != nil {
			return fmt.Errorf("replace iCloud snapshot: %w", err)
		}
		return nil
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPut, record.Account.Endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/json")
	authorizeLibrarySyncRequest(request, credentials)
	response, err := s.clientFactory(record.Account.AllowPrivateNetwork).Do(request)
	if err != nil {
		return &syncadapter.Error{Code: "network_error", Retryable: !errors.Is(err, context.Canceled), Err: err}
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return webDAVStatusError(response.StatusCode)
	}
	return nil
}

func normalizeLibrarySyncEndpoint(provider, raw string) (string, error) {
	if provider == "webdav" {
		endpoint := strings.TrimSpace(raw)
		parsed, err := url.Parse(endpoint)
		if err != nil || parsed.Host == "" || parsed.User != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
			return "", errors.New("WebDAV endpoint must be an HTTP or HTTPS file URL without embedded credentials")
		}
		if parsed.Path == "" || strings.HasSuffix(parsed.Path, "/") {
			parsed.Path = strings.TrimRight(parsed.Path, "/") + "/aurora-library.json"
			endpoint = parsed.String()
		}
		return endpoint, nil
	}
	roots, err := iCloudRoots()
	if err != nil {
		return "", err
	}
	endpoint := strings.TrimSpace(raw)
	if endpoint == "" {
		endpoint = filepath.Join(roots[0], "Aurora", "aurora-library.json")
	}
	absolute, err := filepath.Abs(endpoint)
	if err != nil {
		return "", fmt.Errorf("resolve iCloud path: %w", err)
	}
	allowed := false
	for _, root := range roots {
		cleanRoot := filepath.Clean(root)
		if absolute == cleanRoot || strings.HasPrefix(absolute, cleanRoot+string(filepath.Separator)) {
			allowed = true
			break
		}
	}
	if !allowed {
		return "", errors.New("iCloud snapshot path must be inside the local iCloud Drive folder")
	}
	if filepath.Ext(absolute) == "" {
		absolute = filepath.Join(absolute, "aurora-library.json")
	}
	return absolute, nil
}

func iCloudRoots() ([]string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("resolve home directory: %w", err)
	}
	return iCloudRootsForPlatform(runtime.GOOS, home)
}

func iCloudRootsForPlatform(goos, home string) ([]string, error) {
	switch goos {
	case "darwin":
		return []string{filepath.Join(home, "Library", "Mobile Documents", "com~apple~CloudDocs")}, nil
	case "windows":
		return []string{filepath.Join(home, "iCloudDrive")}, nil
	default:
		return nil, errors.New("iCloud Drive synchronization is supported only on macOS and Windows")
	}
}

func authorizeLibrarySyncRequest(request *http.Request, credentials syncadapter.Credentials) {
	if strings.TrimSpace(credentials.Token) != "" {
		request.Header.Set("Authorization", "Bearer "+strings.TrimSpace(credentials.Token))
	} else if credentials.Username != "" || credentials.Password != "" {
		request.SetBasicAuth(credentials.Username, credentials.Password)
	}
}

func (s *SyncService) testWebDAVConnection(ctx context.Context, snapshotEndpoint string, credentials syncadapter.Credentials, allowPrivate bool) error {
	parsed, err := url.Parse(snapshotEndpoint)
	if err != nil {
		return err
	}
	collection := *parsed
	collection.Path = path.Dir(parsed.Path)
	if !strings.HasSuffix(collection.Path, "/") {
		collection.Path += "/"
	}
	collection.RawPath = ""
	collection.RawQuery = ""
	collection.Fragment = ""

	request, err := http.NewRequestWithContext(ctx, "PROPFIND", collection.String(), strings.NewReader(`<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><allprop/></propfind>`))
	if err != nil {
		return err
	}
	request.Header.Set("Accept", "application/xml, text/xml")
	request.Header.Set("Content-Type", "application/xml; charset=utf-8")
	request.Header.Set("Depth", "0")
	authorizeLibrarySyncRequest(request, credentials)
	response, err := s.clientFactory(allowPrivate).Do(request)
	if err != nil {
		return &syncadapter.Error{Code: "network_error", Retryable: !errors.Is(err, context.Canceled), Err: err}
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 64<<10))
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return webDAVStatusError(response.StatusCode)
	}
	return nil
}

func webDAVStatusError(status int) error {
	code := "http_error"
	retryable := status >= 500 || status == http.StatusTooManyRequests
	if status == http.StatusUnauthorized || status == http.StatusForbidden {
		code = "authentication_error"
	}
	return &syncadapter.Error{Code: code, StatusCode: status, Retryable: retryable, Err: errors.New(http.StatusText(status))}
}

func decodeLibrarySyncCursor(raw string) librarySyncCursor {
	var cursor librarySyncCursor
	_ = json.Unmarshal([]byte(raw), &cursor)
	return cursor
}
