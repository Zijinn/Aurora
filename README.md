# Cairn

Cairn is a local-first personal RSS reader for Windows, macOS, iPad, and the web. A Go service owns the feed library, SQLite database, refresh scheduler, synchronization, and AI operations. React clients use the same versioned API.

The active implementation plan is in [PLAN.md](PLAN.md).

## Current status

The planned first-release implementation is complete; native installer execution and clean-install checks remain deferred to cloud runners. Cairn includes:

- a transactionally migrated SQLite database;
- loopback-safe server configuration with optional certificate/key TLS for trusted LAN access;
- liveness and readiness endpoints;
- a responsive React PWA shell;
- desktop and mobile library navigation for feeds, folders, tags, and saved filters, plus article tag assignment and automation rules;
- a replaceable Wails desktop adapter;
- automated Go and frontend checks;
- encrypted third-party sync accounts for FreshRSS, Google Reader compatible services, Miniflux, Fever, Feedbin, and Nextcloud News.
- optional OpenAI-compatible and Ollama article assistance with encrypted BYOK credentials, cancellable jobs, stable result caching, article chat, and token accounting.

## Requirements

- Go 1.25 or newer
- Node.js 22 or newer
- pnpm 11

Platform packaging requires the normal Wails native build prerequisites.

## Packaging

Native installers are intentionally not built on the development workstation. The [release workflow](.github/workflows/release.yml) builds a universal macOS DMG and a per-user Windows x64 NSIS installer on cloud runners, with optional signing and notarization. See [docs/release-checklist.md](docs/release-checklist.md) for required secrets, clean-install checks, backup recovery, and rollback steps.

## Development

```bash
pnpm install
pnpm --dir web install
pnpm dev
```

The web client runs at `http://127.0.0.1:4173` and proxies API calls to the server at `http://127.0.0.1:7381`.

Run all checks:

```bash
make check
```

Run the desktop adapter after building the web client:

```bash
pnpm --dir web build
pnpm desktop:dev
```

## Data location

By default, Cairn stores `cairn.db` and an owner-only `master.key` in the operating system user configuration directory under `Cairn`. Override paths with the environment variables documented in [.env.example](.env.example). Keep the master key with the database when moving an installation; encrypted sync and AI credentials cannot be opened without it.

## Security

Cairn binds to loopback by default. A non-loopback address is rejected unless LAN mode is explicitly enabled. LAN mode requires one-time device pairing, hashed bearer tokens, scoped origins, and supports token revocation. For an installable iPad PWA over a LAN, provide a trusted certificate and key with `CAIRN_TLS_CERT_PATH` and `CAIRN_TLS_KEY_PATH` (or terminate TLS in a trusted reverse proxy). Third-party sync and AI endpoints are subject to SSRF protection; private network endpoints require an explicit profile-level opt-in.

AI is disabled until a provider profile is configured. Remote endpoints also require explicit approval before article content is transmitted. API keys are encrypted with the installation master key and never returned by REST, jobs, or events. AI prompts treat feed text as untrusted input, expose no tools, and cannot mutate subscriptions or library content.

## License

Cairn is licensed under GPL-3.0-only. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
