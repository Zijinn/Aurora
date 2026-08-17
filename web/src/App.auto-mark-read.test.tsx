// Regression test for the v2.2.0 white-screen crash: opening an unread
// article fired the auto-mark-read effect in a loop (the callback prop had a
// fresh identity per AppShell render) until React aborted with "Maximum
// update depth exceeded" and unmounted the whole tree. The state PATCH is
// deliberately delayed here so the loop cannot win the race and hide.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import App from "./App"
import { useReaderStore } from "./store/reader"

function makeEntry(id: string, title: string) {
  return {
    id,
    feed_id: "feed-1",
    feed_title: "Feed One",
    canonical_url: `https://example.com/${id}`,
    title,
    author: "Author One",
    summary: "Summary text",
    published_at: "2026-08-10T00:00:00Z",
    discovered_at: "2026-08-10T01:00:00Z",
    lead_image_url: null,
    doi: null,
    tag_ids: [],
    state: {
      is_read: false,
      is_starred: false,
      is_read_later: false,
      updated_at: "2026-08-10T01:00:00Z",
    },
  }
}

const ENTRIES = [makeEntry("entry-1", "First unread article"), makeEntry("entry-2", "Second unread article")]

let statePatchCalls = 0

beforeEach(() => {
  statePatchCalls = 0
  localStorage.clear()
  useReaderStore.setState({
    scope: { kind: "all", title: "All feeds" },
    readerReturnScope: null,
    selectedEntryID: null,
    search: "",
    viewMode: "standard",
    mobileReaderOpen: false,
    locale: "en-US",
    paneLayout: { sidebarWidth: 246, timelineWidth: 424 },
    openFolders: {},
    readerAppearance: { fontFamily: "serif", fontSize: 19, lineHeight: 1.8 },
    annotations: [],
    theme: "system",
  })
  // jsdom lacks scroll APIs; virtual-core's scrollToIndex would throw a
  // false-positive TypeError once the selected row exists in the list.
  Element.prototype.scrollTo = () => {}
  Element.prototype.scrollIntoView = () => {}
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url
    const method = (
      init?.method ??
      (typeof input === "object" && "method" in input ? input.method : "GET")
    ).toUpperCase()
    const stateMatch = url.match(/\/api\/v1\/entries\/([^/?]+)\/state(?:\?|$)/)
    if (stateMatch && method === "PATCH") {
      statePatchCalls++
      await new Promise((resolve) => setTimeout(resolve, 300))
      const entry = ENTRIES.find((item) => item.id === stateMatch[1])
      return jsonResponse({ ...entry?.state, is_read: true, updated_at: "2026-08-10T01:00:01Z" })
    }
    const annotationsMatch = url.match(/\/api\/v1\/entries\/([^/?]+)\/annotations(?:\?|$)/)
    if (annotationsMatch) {
      return jsonResponse({ items: [] })
    }
    const detailMatch = url.match(/\/api\/v1\/entries\/([^/?]+)(?:\?|$)/)
    if (detailMatch && method === "GET") {
      const entry = ENTRIES.find((item) => item.id === detailMatch[1])
      if (entry) return jsonResponse({ ...entry, readability_html: null, sanitized_html: null })
    }
    if (url.includes("/api/v1/entries")) {
      return jsonResponse({ items: ENTRIES, next_cursor: null })
    }
    if (url.includes("/api/v1/status")) {
      return jsonResponse({
        status: "ready",
        version: "test",
        api_version: "v1",
        database_ready: true,
        capabilities: ["rss"],
      })
    }
    if (
      url.includes("/api/v1/subscriptions") ||
      url.includes("/api/v1/folders") ||
      url.includes("/api/v1/devices") ||
      url.includes("/api/v1/sync/accounts") ||
      url.includes("/api/v1/rules") ||
      url.includes("/api/v1/tags") ||
      url.includes("/api/v1/saved-filters") ||
      url.includes("/api/v1/sync/providers") ||
      url.includes("/api/v1/ai/providers") ||
      url.includes("/api/v1/ai/profiles")
    ) {
      return jsonResponse({ items: [] })
    }
    if (url.includes("/api/v1/ai/usage")) {
      return jsonResponse({ input_tokens: 0, output_tokens: 0, total_tokens: 0 })
    }
    return jsonResponse({}, 404)
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("auto mark-read on article open", () => {
  it("fires exactly one state PATCH and keeps the UI mounted", async () => {
    renderApp()
    fireEvent.click(await screen.findByRole("button", { name: /First unread article/ }))
    await screen.findByRole("heading", { name: "First unread article", level: 1 })
    // Outlast the delayed PATCH so any effect loop would exceed React's
    // nested-update limit here.
    await act(() => new Promise((resolve) => setTimeout(resolve, 1200)))
    expect(statePatchCalls).toBe(1)
    expect(
      screen.getByRole("heading", { name: "First unread article", level: 1 }),
    ).toBeInTheDocument()
  })

  it("fires once per article when switching from one article to another", async () => {
    renderApp()
    fireEvent.click(await screen.findByRole("button", { name: /First unread article/ }))
    await screen.findByRole("heading", { name: "First unread article", level: 1 })
    await act(() => new Promise((resolve) => setTimeout(resolve, 1200)))
    expect(statePatchCalls).toBe(1)

    fireEvent.click(await screen.findByRole("button", { name: /Second unread article/ }))
    await screen.findByRole("heading", { name: "Second unread article", level: 1 })
    await act(() => new Promise((resolve) => setTimeout(resolve, 1200)))
    expect(statePatchCalls).toBe(2)
    expect(
      screen.getByRole("heading", { name: "Second unread article", level: 1 }),
    ).toBeInTheDocument()
  })
})
