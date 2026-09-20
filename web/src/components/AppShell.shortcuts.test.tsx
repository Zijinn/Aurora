import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import App from "../App"
import { useReaderStore } from "../store/reader"

// Regression guard for the audit finding that global reader shortcuts kept
// firing in the workbench view: j/k/m/s would mutate background articles and
// "/" would target a hidden input, while the app-level command palette
// shortcut must keep working everywhere.

beforeEach(() => {
  useReaderStore.setState({
    scope: { kind: "today", title: "Today" },
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
    appView: "reader",
  })
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url
    if (url.includes("/api/v1/status")) {
      return Promise.resolve(
        jsonResponse({
          status: "ready",
          version: "test",
          api_version: "v1",
          database_ready: true,
          capabilities: ["rss"],
          device_auth_required: false,
          device_authenticated: false,
        }),
      )
    }
    if (url.includes("/api/v1/entries")) {
      return Promise.resolve(
        jsonResponse({ items: [makeEntry("entry-1"), makeEntry("entry-2")], next_cursor: null }),
      )
    }
    return Promise.resolve(jsonResponse({ items: [] }))
  })
})

function makeEntry(id: string) {
  return {
    id,
    feed_id: "feed-1",
    feed_title: "Feed",
    canonical_url: `https://example.com/${id}`,
    title: `Story ${id}`,
    author: null,
    summary: null,
    published_at: "2026-07-17T12:00:00Z",
    discovered_at: "2026-07-17T12:00:00Z",
    lead_image_url: null,
    tag_ids: [],
    state: {
      is_read: false,
      is_starred: false,
      is_read_later: false,
      updated_at: "2026-07-17T12:00:00Z",
    },
  }
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
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

describe("Global shortcut view isolation", () => {
  it("keeps reader navigation working in the reader view", async () => {
    renderApp()
    await screen.findByRole("heading", { name: "Today" })
    await screen.findByText("Story entry-1")
    fireEvent.keyDown(document.body, { key: "j" })
    await waitFor(() => expect(useReaderStore.getState().selectedEntryID).toBe("entry-1"))
  })

  it("ignores reader shortcuts in the workbench view but keeps the command palette", async () => {
    renderApp()
    await screen.findByRole("heading", { name: "Today" })
    await screen.findByText("Story entry-1")
    fireEvent.keyDown(document.body, { key: "j" })
    await waitFor(() => expect(useReaderStore.getState().selectedEntryID).toBe("entry-1"))

    act(() => useReaderStore.getState().setAppView("workbench"))
    expect(useReaderStore.getState().appView).toBe("workbench")

    // j/k would walk the hidden timeline, m/s would toggle state on the
    // selected article: none of them may fire now.
    fireEvent.keyDown(document.body, { key: "j" })
    fireEvent.keyDown(document.body, { key: "k" })
    fireEvent.keyDown(document.body, { key: "m" })
    fireEvent.keyDown(document.body, { key: "s" })
    fireEvent.keyDown(document.body, { key: "/" })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(useReaderStore.getState().selectedEntryID).toBe("entry-1")
    expect(document.activeElement?.id).not.toBe("library-search")

    // The palette is app-level and must still open from the workbench view.
    fireEvent.keyDown(document.body, { key: "k", metaKey: true })
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
  })
})
