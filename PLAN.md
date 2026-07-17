# Cairn execution plan

Status: complete (cloud installer execution deferred)

Last updated: 2026-07-17

## Product objective

Cairn is a personal, local-first RSS reader that runs as a native desktop application on Windows and macOS and as an installable PWA on iPad. A single Go service owns feed fetching, persistence, scheduling, synchronization, AI tasks, and the versioned REST API. Every client uses the same API.

The project selectively refactors MrRSS core behavior, reimplements Folo-inspired information architecture without copying Folo source code, and ports compatible interaction and sync concepts from Fluent Reader with attribution.

## Product principles

1. Local data is authoritative. Cloud services are optional adapters.
2. The API is a stable product boundary, not an implementation detail.
3. Network access is off by default and authenticated when enabled.
4. Feed content is untrusted input and is sanitized before rendering.
5. Desktop, PWA, and future native mobile clients share domain semantics.
6. Features ship with loading, empty, error, offline, and recovery states.
7. Direct Folo source reuse is prohibited to avoid AGPL contamination.

## Approved decisions

- iPad delivery starts with a PWA connected to Cairn Server.
- The new client uses React 19 and TypeScript.
- Cairn is single-user and local-first in the initial release.
- AI and external sync follow the secure cross-device reading MVP.
- Cairn is GPL-3.0-only because the core is derived from MrRSS.
- The desktop shell is replaceable. Domain and API packages cannot import Wails.

## Target architecture

```text
Windows/macOS desktop shell ----+
                                |
iPad/browser PWA ---------------+--> /api/v1 --> Go application services
                                |                     |
Future native mobile client ----+                     +--> SQLite / FTS5
                                                      +--> Feed fetch workers
                                                      +--> Sync adapters
                                                      +--> AI providers
```

## Phase 0: architecture freeze

Status: complete

Deliverables:

- [x] Execution plan
- [x] Architecture overview
- [x] Architecture decision records
- [x] Logical data model
- [x] Initial OpenAPI contract
- [x] Third-party and license policy

Acceptance evidence:

```bash
test -f PLAN.md
test -f docs/architecture/overview.md
test -f docs/data-model.md
test -f api/openapi.yaml
```

## Phase 1: runnable foundation

Status: complete

Scope:

- Create Go module and application configuration.
- Add numbered, embedded SQLite migrations.
- Add server entry point and health/status endpoints.
- Add structured logging and graceful shutdown.
- Create React 19, TypeScript, Vite, and PWA application.
- Add Cairn semantic tokens, light/dark themes, and responsive application shell.
- Add desktop shell adapter without coupling domain code to Wails.
- Add lint, typecheck, unit-test, build, and CI commands.

Acceptance:

- [x] `go test ./...`
- [x] `go vet ./...`
- [x] `pnpm --dir web install --frozen-lockfile`
- [x] `pnpm --dir web typecheck`
- [x] `pnpm --dir web lint`
- [x] `pnpm --dir web test`
- [x] `pnpm --dir web build`
- [x] `go build -tags desktop ./cmd/cairn-desktop` (compile check only; local SDK emitted deployment-target warnings)
- [x] Server starts, applies migrations, and returns ready status JSON.
- [x] Browser QA passed at 1440x900, 1366x1024, and 820x1180 with no console warnings or errors and no horizontal overflow.

## Phase 2: RSS core

Status: complete

Scope:

- Feed discovery and validation.
- RSS 2.0, Atom, and JSON Feed parsing.
- Conditional requests with ETag and Last-Modified.
- Bounded concurrent refresh workers, retries, backoff, and cancellation.
- GUID/canonical URL/content-fingerprint deduplication.
- RSSHub URL transformation.
- OPML import and export.
- Persistent jobs and server-sent refresh events.
- SSRF controls and response-size limits.

Acceptance:

- [x] Fixture tests cover RSS, Atom, JSON Feed, malformed XML, duplicate items, malicious HTML, response limits, SSRF, and conditional refresh.
- [x] A feed can be added, refreshed through a persistent job, queried, state-mutated idempotently, searched, and deleted through `/api/v1`.
- [x] OPML round-trip preserves nested folders, titles, site URLs, and feed URLs.
- [x] Refresh and job progress are observable through SSE.
- [x] Interrupted jobs recover on startup; feed failures persist RFC3339 retry times with bounded quadratic backoff.
- [x] `go test ./...`, `go vet ./...`, and OpenAPI parsing pass with 17 paths.

## Phase 3: reading experience

Status: complete

Scope:

- Today, Unread, Saved, Folders, and Feeds navigation.
- Subscription tree, timeline, and reader panes.
- Read, unread, starred, and read-later state.
- FTS5 search.
- Virtualized timeline and incremental pagination.
- Responsive desktop and iPad layouts.
- Empty, loading, offline, and error states.

Acceptance:

- [x] Today, Unread, Saved, All feeds, folders, feed filters, FTS search, cursor pagination, and virtualized rows use only `/api/v1`.
- [x] Article detail, automatic read state, unread/star/read-later mutations, bulk read, refresh, add feed, and OPML import/export are operable.
- [x] Keyboard `j` navigation and touch-sized controls work; mobile reader has an explicit back transition.
- [x] Live-data QA passed at 1440x900, 820x1180, and 390x844 with no horizontal overflow or browser warnings/errors.
- [x] Frontend typecheck, strict lint, interaction tests, and production PWA build pass.

## Phase 4: advanced reading

Status: complete

Scope:

- Safe full-text extraction.
- HTML allow-list sanitization and isolated rendering.
- Audio, video, image, code, and math presentation.
- Compact, standard, card, magazine, and image views.
- Folders, tags, saved filters, and automation rules.
- Command palette and Fluent Reader-inspired shortcuts.
- Backup and restore.

Acceptance:

- [x] Malicious HTML fixtures cannot execute scripts or event handlers.
- [x] Full-text extraction is sanitized before persistence and rendering.
- [x] Compact, standard, card, magazine, and image view selection persists per device.
- [x] Keyboard shortcut conflicts are detected before saving.
- [x] Folder cycles, automation rules, logical backup/restore, and FTS rebuild are covered by tests.
- [x] Folders, tags, automation rules, and saved filters have REST-backed management workflows; article tags are readable and assignable, and tag/saved-filter scopes drive the timeline and scoped bulk-read behavior.
- [x] Go tests, frontend interaction tests, typecheck, lint, and production PWA build pass.

## Phase 5: devices and offline PWA

Status: complete

Scope:

- Localhost-only default binding.
- Explicit LAN mode.
- One-time pairing codes and hashed device tokens.
- Scoped CORS and origin validation.
- Installable iPad PWA.
- Recent-entry IndexedDB cache.
- Offline state mutation queue and deterministic conflict rules.
- Device list and token revocation.

Acceptance:

- [x] An unpaired device cannot read or mutate data when LAN mode is enabled.
- [x] Pairing codes are one-time and device tokens are hashed, authenticated, listed, and revocable.
- [x] The iPad PWA has an installable manifest, recent-entry IndexedDB cache, and ordered offline mutation outbox.
- [x] Offline mutations replay once with stable mutation IDs after reconnecting.
- [x] Disabling LAN mode rejects non-loopback binding configuration.
- [x] Scoped CORS and origin rejection are covered by integration tests.
- [x] Built-in TLS accepts a certificate/key pair only when both are configured; a live HTTPS smoke process returned ready and served the PWA while rejecting plaintext HTTP. iPad installation still requires a locally trusted certificate or trusted reverse proxy.
- [x] Browser QA at 820x1180 confirmed five-item mobile navigation, the Library panel for feeds/folders/tags/saved filters, reader transition, manifest presence, and no horizontal overflow.
- [x] A live REST pairing flow created, listed, and revoked an iPad device successfully.

## Phase 6: external synchronization

Status: complete

Adapters, in delivery order:

1. FreshRSS
2. Google Reader compatible services
3. Miniflux
4. Fever
5. Feedbin
6. Nextcloud News

Each adapter must implement authentication, subscription mapping, incremental cursors, read/star synchronization, conflict resolution, retry classification, and encrypted credentials.

Acceptance:

- [x] FreshRSS and Google Reader compatible services share a tested Google Reader adapter while retaining distinct provider IDs.
- [x] Miniflux, Fever, Feedbin, and Nextcloud News implement subscription, cursor, read, and starred state contracts.
- [x] Contract tests run against recorded protocol fixtures for all six provider choices.
- [x] Credentials are AES-256-GCM encrypted with account-bound associated data and a stable owner-only master key.
- [x] Account metadata, cursors, feed/entry mappings, attempts, errors, intervals, and next-run times persist in SQLite.
- [x] Initial remote state is imported; later local changes push first and win over stale remote state.
- [x] Adapter authentication, rate-limit, transient network, and permanent HTTP failures are classified.
- [x] Private-network sync endpoints require an explicit per-account opt-in and remain subject to redirect validation.
- [x] Sync jobs are independently queued and scheduled; an adapter failure cannot block a local feed refresh job.
- [x] Interrupted running jobs recover through the shared persistent job queue without losing account cursors.
- [x] REST and Preferences UI support create, list, enable, disable, run, observe, and delete account workflows without exposing credentials.
- [x] Server and Wails desktop entry points load the same credential master key and expose the same sync capability.
- [x] Go tests/vet, frontend typecheck/lint/tests/build, OpenAPI parsing, and desktop-tag compile checks pass.
- [x] Browser QA at 1440x900 and 820x1180 confirmed the sync settings and account form have no horizontal overflow or nested active dialogs.

## Phase 7: AI

Status: complete

Scope:

- OpenAI-compatible and Ollama providers.
- Encrypted BYOK profiles.
- Summary, translation, key-point extraction, and article chat.
- Background jobs, result cache, cancellation, and usage accounting.
- Explicit privacy disclosure before remote content transmission.

Acceptance:

- [x] AI is fully optional and the reader works without a provider.
- [x] OpenAI-compatible and Ollama protocol contracts are fixture-tested.
- [x] BYOK secrets are encrypted and never returned by REST, jobs, events, or logs.
- [x] Summary, translation, key points, and article chat run as cancellable background jobs.
- [x] Cached operations do not resubmit unchanged content.
- [x] Usage accounting records provider/model/token totals without storing prompts in logs.
- [x] Remote providers require explicit privacy confirmation before article content is transmitted.
- [x] AI has no tools or callbacks and cannot mutate subscriptions or library content.
- [x] Provider, API, UI, and browser tests pass across desktop, iPad, and mobile viewports.

Acceptance evidence:

- `go test ./... -count=1`, `go test -race ./...`, and `go vet ./...` pass.
- Frontend typecheck, lint, 11 interaction tests, and production PWA build pass.
- OpenAPI parses with the implemented AI profile, operation, chat, usage, result, and cancellation paths.
- Browser QA at 1440x900, 820x1180, and 390x844 confirmed one active dialog, mandatory remote-content approval, optional-provider empty state, and zero horizontal overflow.

## Phase 8: release readiness

Status: complete (cloud packaging execution deferred)

Packaging constraint: native installers are configured and compile-checked locally, but are built and signed later on cloud runners because the current workstation does not have the complete platform toolchains.

Scope:

- Windows and macOS packaging configuration and cloud build workflows.
- macOS universal build and Windows installer.
- PWA icons and iPad safe-area polish.
- Security, accessibility, performance, and migration audits.
- Backup recovery test.
- End-to-end release checklist and documentation.

Acceptance:

- [x] Cloud packaging jobs are configured for a macOS universal DMG and a per-user Windows x64 NSIS installer, with signing and notarization secret hooks. The first artifact run and clean-install verification are intentionally deferred to a cloud runner.
- [x] PWA metadata, generated icons, iPad safe-area padding, keyboard skip navigation, current-navigation semantics, and reduced-motion behavior are covered.
- [x] Security, accessibility, and performance checks are green: CSP/security-header tests, auth/SSRF tests, visible focus styles, no browser console warnings, zero horizontal overflow at desktop/iPad/mobile viewports, and a 494.25 kB production JS bundle (144.95 kB gzip).
- [x] A database created after each prior migration (0 through 4) upgrades successfully to schema 5; backup restore preserves encrypted credentials with the matching master key and rejects a different key.
- [x] OpenAPI parses and an AST-backed contract test covers every registered runtime HTTP method/path.
- [x] Automated tests, race checks, vet, release configuration parsing, frontend checks, and desktop-tag compile checks are green.
- [x] The release checklist, cloud secret contract, dependency license inventory workflow, checksum generation, and rollback guidance are documented in `docs/release-checklist.md` and `THIRD_PARTY_NOTICES.md`.

Acceptance evidence:

- `GOCACHE="$PWD/.cache/go-build" go test ./... -count=1`
- `GOCACHE="$PWD/.cache/go-build" go test -race ./...`
- `GOCACHE="$PWD/.cache/go-build" go vet ./...`
- `GOCACHE="$PWD/.cache/go-build" go build -tags desktop -o .cache/cairn-desktop-check ./cmd/cairn-desktop` (compile check only; local SDK deployment-target warnings are expected)
- `pnpm --dir web typecheck`, `pnpm --dir web lint`, `pnpm --dir web test -- --run`, and `pnpm --dir web build`
- `bash scripts/check-release-config.sh` and `TestOpenAPICoversRegisteredHTTPRoutes`
- A live TLS smoke server under `.cache/tls-smoke` returned ready over HTTPS and rejected plaintext HTTP.
- Browser QA covers the full shell at 1440x900 plus the final organization and mobile Library workflows at a stable desktop viewport, 820x1180, and 390x844; one active dialog, no console warnings/errors, and no visible horizontal clipping.

## Explicit non-goals for the first release

- Multi-user hosted SaaS
- Native iOS binary
- Arbitrary user script execution
- Public unauthenticated server mode
- Social feeds that require bypassing access controls

## Execution policy

- Work proceeds in phase order unless a dependency requires a documented change.
- All project writes and deletions are confined to the `Cairn/` directory. The three source repositories beside it are read-only references.
- `PLAN.md` is updated whenever phase status or scope changes.
- Every phase ends with tests and recorded evidence.
- A phase is not complete merely because code exists.
