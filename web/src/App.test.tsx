import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import App from "./App"
import { useReaderStore } from "./store/reader"

beforeEach(() => {
  useReaderStore.setState({
    scope: { kind: "today", title: "Today" },
    selectedEntryID: null,
    search: "",
    viewMode: "standard",
    mobileReaderOpen: false,
    locale: "en-US",
    paneLayout: { sidebarWidth: 256, timelineWidth: 416 },
  })
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url
    if (url.includes("/api/v1/status")) {
      return Promise.resolve(jsonResponse({ status: "ready", version: "test", api_version: "v1", database_ready: true, capabilities: ["rss"] }))
    }
    if (url.includes("/api/v1/tags")) {
      return Promise.resolve(jsonResponse({ items: [{ id: "tag-research", name: "Research", color: "#167a72", position: 0, created_at: "2026-07-17T00:00:00Z" }] }))
    }
    if (url.includes("/api/v1/saved-filters")) {
      return Promise.resolve(jsonResponse({ items: [{ id: "filter-favorites", name: "Favorites", query: { state: "starred" }, position: 0, created_at: "2026-07-17T00:00:00Z", updated_at: "2026-07-17T00:00:00Z" }] }))
    }
    if (url.includes("/api/v1/subscriptions") || url.includes("/api/v1/folders") || url.includes("/api/v1/devices") || url.includes("/api/v1/sync/accounts") || url.includes("/api/v1/rules")) {
      return Promise.resolve(jsonResponse({ items: [] }))
    }
    if (url.includes("/api/v1/sync/providers")) {
      return Promise.resolve(jsonResponse({ items: [
        { id: "freshrss", name: "FreshRSS" },
        { id: "miniflux", name: "Miniflux" },
      ] }))
    }
    if (url.includes("/api/v1/ai/providers")) {
      return Promise.resolve(jsonResponse({ items: [
        { id: "openai_compatible", name: "OpenAI compatible" },
        { id: "ollama", name: "Ollama" },
      ] }))
    }
    if (url.includes("/api/v1/ai/profiles")) {
      return Promise.resolve(jsonResponse({ items: [] }))
    }
    if (url.includes("/api/v1/ai/usage")) {
      return Promise.resolve(jsonResponse({ input_tokens: 0, output_tokens: 0, total_tokens: 0 }))
    }
    if (url.includes("/api/v1/entries")) {
      return Promise.resolve(jsonResponse({ items: [], next_cursor: null }))
    }
    return Promise.resolve(jsonResponse({}, 404))
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe("Cairn reading experience", () => {
  it("renders the empty reading state and reports a ready library", async () => {
    renderApp()
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument()
    expect(await screen.findByText("Your reading trail starts here")).toBeInTheDocument()
    expect(await screen.findByText("Library ready")).toBeInTheDocument()
  })

  it("opens the add subscription workflow", async () => {
    renderApp()
    const addButtons = await screen.findAllByRole("button", { name: "Add feed" })
    fireEvent.click(addButtons[0]!)
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Add subscription" })).toBeInTheDocument()
    expect(screen.getByLabelText("Feed or website URL")).toBeInTheDocument()
  })

  it("opens the command palette with the platform shortcut", async () => {
    renderApp()
    fireEvent.keyDown(window, { key: "k", metaKey: true })
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Type a command")).toBeInTheDocument()
  })

  it("rejects conflicting shortcut assignments before saving", async () => {
    renderApp()
    fireEvent.click(await screen.findByRole("button", { name: "Preferences" }))
    const nextLabel = screen.getByText("Next article")
    const nextButton = nextLabel.parentElement?.querySelector("button")
    expect(nextButton).not.toBeNull()
    fireEvent.keyDown(nextButton!, { key: "k" })
    expect(screen.getByRole("alert")).toHaveTextContent("already assigned to Previous article")
    expect(useReaderStore.getState().shortcuts.next).toBe("j")
  })

  it("opens the external sync account workflow", async () => {
    renderApp()
    fireEvent.click(await screen.findByRole("button", { name: "Preferences" }))
    const syncSection = screen.getByRole("heading", { name: "External sync" }).closest("section")
    expect(syncSection).not.toBeNull()
    fireEvent.click(within(syncSection!).getByRole("button", { name: "Add" }))
    expect(screen.getByRole("heading", { name: "Add sync account" })).toBeInTheDocument()
    await screen.findByRole("option", { name: "FreshRSS" })
    expect(screen.getByRole("combobox", { name: "Provider" })).toHaveValue("freshrss")
    expect(screen.getByLabelText("Allow private network endpoint")).toBeInTheDocument()
  })

  it("requires privacy confirmation before configuring a remote AI provider", async () => {
    renderApp()
    fireEvent.click(await screen.findByRole("button", { name: "Preferences" }))
    const aiSection = screen.getByRole("heading", { name: "AI providers" }).closest("section")
    expect(aiSection).not.toBeNull()
    fireEvent.click(within(aiSection!).getByRole("button", { name: "Add" }))

    expect(screen.getByRole("heading", { name: "Add AI provider" })).toBeInTheDocument()
    await screen.findByRole("option", { name: "OpenAI compatible" })
    expect(screen.getByRole("combobox", { name: "Provider" })).toHaveValue("openai_compatible")
    const submit = screen.getByRole("button", { name: "Add provider" })
    expect(submit).toBeDisabled()
    fireEvent.click(screen.getByLabelText("Article content may be sent to this provider"))
    expect(submit).toBeEnabled()
  })

  it("opens the library organization workflow", async () => {
    renderApp()
    fireEvent.click(await screen.findByRole("button", { name: "Preferences" }))
    fireEvent.click(screen.getByRole("button", { name: "Manage" }))
    expect(await screen.findByRole("heading", { name: "Library organization" })).toBeInTheDocument()
    expect(screen.getByLabelText("Folder name")).toBeInTheDocument()
    expect(screen.getByLabelText("Tag name")).toBeInTheDocument()
    expect(screen.getByLabelText("Rule conditions JSON")).toBeInTheDocument()
    expect(screen.getByLabelText("Saved filter query JSON")).toBeInTheDocument()
  })

  it("switches the interface language and persists the choice", async () => {
    renderApp()
    fireEvent.click(await screen.findByRole("button", { name: "Preferences" }))
    const language = screen.getByRole("combobox", { name: "Interface language" })
    fireEvent.change(language, { target: { value: "zh-CN" } })
    expect(useReaderStore.getState().locale).toBe("zh-CN")
    expect(screen.getByRole("heading", { name: "偏好设置" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "关闭" }))
    expect(screen.getByRole("heading", { name: "今天" })).toBeInTheDocument()
    expect(localStorage.getItem("cairn-reader-preferences")).toContain("zh-CN")
  })

  it("exposes keyboard accessible pane resize separators", async () => {
    renderApp()
    const separators = await screen.findAllByRole("separator")
    expect(separators).toHaveLength(2)
    expect(separators[0]).toHaveAttribute("aria-orientation", "vertical")
    expect(separators[0]).toHaveAttribute("aria-valuenow", "256")
    fireEvent.keyDown(separators[0]!, { key: "ArrowLeft" })
    expect(useReaderStore.getState().paneLayout.sidebarWidth).toBe(240)
  })

  it("uses saved filters and tags as timeline scopes", async () => {
    renderApp()
    fireEvent.click(await screen.findByRole("button", { name: "Favorites" }))
    expect(screen.getByRole("heading", { name: "Favorites" })).toBeInTheDocument()
    await waitFor(() => expect(requestedURLIncludes("state=starred")).toBe(true))

    fireEvent.click(screen.getByRole("button", { name: "Research" }))
    expect(screen.getByRole("heading", { name: "Research" })).toBeInTheDocument()
    await waitFor(() => expect(requestedURLIncludes("tag_id=tag-research")).toBe(true))
  })

  it("exposes library scopes from mobile navigation", async () => {
    renderApp()
    await screen.findByRole("button", { name: "Favorites" })
    fireEvent.click(await screen.findByRole("button", { name: "Library" }))
    const dialog = screen.getByRole("dialog", { name: "Library" })
    fireEvent.click(await within(dialog).findByRole("button", { name: "Favorites" }))
    expect(screen.getByRole("heading", { name: "Favorites" })).toBeInTheDocument()
  })
})

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><App /></QueryClientProvider>)
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } })
}

function requestedURLIncludes(value: string) {
  return vi.mocked(fetch).mock.calls.some(([input]) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    return url.includes(value)
  })
}
