# ADR 0001: server-first core

Status: accepted

## Decision

All persistent data and business behavior live in a standalone Go service. Desktop and PWA clients consume the same REST and SSE interfaces. Wails is an outer lifecycle adapter only.

## Rationale

Windows and macOS can host an embedded backend, while iPad cannot. A server-first boundary supports all three without duplicating feed and state logic. It also makes a future native mobile client possible.

## Consequences

- API compatibility is tested as a product contract.
- Network authentication is required earlier than in a desktop-only application.
- Desktop framework replacement does not require rewriting domain packages.

