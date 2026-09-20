import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ResearchKind, ResearchPaper } from "../../api/types"
import { useReaderStore } from "../../store/reader"
import { useToastStore } from "../../store/toast"
import { Workbench } from "./Workbench"

vi.mock("../../api/client", () => ({
  createResearchPaper: vi.fn(),
  deleteResearchPaper: vi.fn(),
  fetchResearchCitation: vi.fn(),
  listPreferences: vi.fn(() => Promise.resolve({ items: {} })),
  listResearchPapers: vi.fn(),
  moveResearchPaper: vi.fn(),
  putPreference: vi.fn(),
  reorderResearchPapers: vi.fn(),
  updateResearchPaper: vi.fn(),
}))

import * as api from "../../api/client"

function paper(overrides: Partial<ResearchPaper> = {}): ResearchPaper {
  return {
    id: "r-1",
    kind: "research",
    position: 0,
    title: "Growth Regression",
    authors: ["Zhang San"],
    keywords: [],
    file_path: "",
    next_action: "",
    notes: "",
    research_area: "",
    status: "",
    priority: "Medium",
    target_journal: "",
    stages: [{ name: "Empirics", done: false, children: [] }],
    current_journal: "",
    submission_date: "",
    manuscript_id: "",
    submission_count: 0,
    target_level: "",
    editor: "",
    history: [],
    abstract: "",
    journal: "",
    language: "",
    year: "",
    volume: "",
    issue: "",
    pages: "",
    doi: "",
    citations: null,
    citation_source: "",
    citation_updated_at: "",
    last_updated: "2026-09-01",
    created_at: "",
    updated_at: "",
    ...overrides,
  }
}

const papersByKind: Record<ResearchKind, ResearchPaper[]> = {
  research: [paper()],
  submitted: [],
  published: [],
}

function renderWorkbench() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <Workbench />
    </QueryClientProvider>,
  )
}

function goToTab(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name }))
}

beforeEach(() => {
  vi.clearAllMocks()
  useReaderStore.setState({ locale: "en-US" })
  useToastStore.setState({ toasts: [] })
  papersByKind.research = [paper()]
  papersByKind.submitted = []
  papersByKind.published = []
  vi.mocked(api.listResearchPapers).mockImplementation((kind) =>
    Promise.resolve({ items: papersByKind[kind] }),
  )
  vi.mocked(api.createResearchPaper).mockResolvedValue(paper({ id: "new-1" }))
  vi.mocked(api.deleteResearchPaper).mockResolvedValue(undefined)
  vi.mocked(api.updateResearchPaper).mockResolvedValue(paper())
  vi.mocked(api.reorderResearchPapers).mockResolvedValue(undefined)
  vi.mocked(api.moveResearchPaper).mockImplementation((id, kind) =>
    Promise.resolve({ ...paper({ kind }), id }),
  )
  vi.mocked(api.putPreference).mockResolvedValue({})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("Workbench load errors", () => {
  it("shows a retryable error state instead of silently empty lists", async () => {
    vi.mocked(api.listResearchPapers).mockRejectedValue(new Error("offline"))
    renderWorkbench()
    expect(await screen.findByRole("alert")).toHaveTextContent(/Could not load your papers/)
    const retry = screen.getByRole("button", { name: "Retry" })
    const before = vi.mocked(api.listResearchPapers).mock.calls.length
    fireEvent.click(retry)
    await waitFor(() =>
      expect(vi.mocked(api.listResearchPapers).mock.calls.length).toBeGreaterThan(before),
    )
  })

  it("renders papers on success", async () => {
    renderWorkbench()
    await waitFor(() => expect(screen.getAllByText("Growth Regression").length).toBeGreaterThan(0))
  })
})

describe("Workbench mutation failures toast every write", () => {
  it("create failure", async () => {
    vi.mocked(api.createResearchPaper).mockRejectedValue(new Error("boom"))
    renderWorkbench()
    goToTab(/Working papers/)
    fireEvent.click(await screen.findByRole("button", { name: /Add paper/ }))
    await waitFor(() =>
      expect(
        useToastStore
          .getState()
          .toasts.some((item) => /Could not add the paper/.test(item.message)),
      ).toBe(true),
    )
  })

  it("delete failure", async () => {
    vi.mocked(api.deleteResearchPaper).mockRejectedValue(new Error("boom"))
    renderWorkbench()
    goToTab(/Working papers/)
    fireEvent.click(await screen.findByRole("button", { name: "Delete: Growth Regression" }))
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }))
    await waitFor(() =>
      expect(
        useToastStore
          .getState()
          .toasts.some((item) => /Could not delete the paper/.test(item.message)),
      ).toBe(true),
    )
  })

  it("move failure", async () => {
    vi.mocked(api.moveResearchPaper).mockRejectedValue(new Error("boom"))
    renderWorkbench()
    goToTab(/Working papers/)
    fireEvent.click(await screen.findByRole("button", { name: /Move to submissions/ }))
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }))
    await waitFor(() =>
      expect(
        useToastStore
          .getState()
          .toasts.some((item) => /Could not move the paper/.test(item.message)),
      ).toBe(true),
    )
  })

  it("update failure", async () => {
    vi.mocked(api.updateResearchPaper).mockRejectedValue(new Error("boom"))
    renderWorkbench()
    goToTab(/Working papers/)
    fireEvent.doubleClick(await screen.findByText("Growth Regression"))
    const input = screen.getByDisplayValue("Growth Regression")
    fireEvent.change(input, { target: { value: "Renamed" } })
    fireEvent.keyDown(input, { key: "Enter" })
    await waitFor(() =>
      expect(
        useToastStore
          .getState()
          .toasts.some((item) => /Could not update the paper/.test(item.message)),
      ).toBe(true),
    )
  })

  it("crossref email save failure", async () => {
    vi.mocked(api.putPreference).mockRejectedValue(new Error("boom"))
    renderWorkbench()
    goToTab(/Publications/)
    const input = await screen.findByLabelText("Crossref contact email")
    fireEvent.change(input, { target: { value: "me@lab.org" } })
    fireEvent.blur(input)
    await waitFor(() =>
      expect(
        useToastStore
          .getState()
          .toasts.some((item) => /Could not save the Crossref email/.test(item.message)),
      ).toBe(true),
    )
  })
})

describe("Workbench paper move", () => {
  it("moves via the dedicated endpoint without locally clearing stages", async () => {
    // The server keeps stages/history on move; the frontend must not "help"
    // by PATCHing stripped fields afterwards.
    vi.mocked(api.moveResearchPaper).mockImplementation((id, kind) => {
      const moved = { ...paper({ kind }), id }
      papersByKind.research = []
      papersByKind.submitted = [moved]
      return Promise.resolve(moved)
    })
    renderWorkbench()
    goToTab(/Working papers/)
    fireEvent.click(await screen.findByRole("button", { name: /Move to submissions/ }))
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }))
    await waitFor(() => expect(api.moveResearchPaper).toHaveBeenCalledWith("r-1", "submitted"))
    await waitFor(() => expect(api.updateResearchPaper).not.toHaveBeenCalled())
    goToTab(/Submissions/)
    await screen.findByText("Growth Regression")
    // And the refetched record still carries its stages untouched.
    expect(papersByKind.submitted[0]!.stages).toEqual([
      { name: "Empirics", done: false, children: [] },
    ])
  })
})

describe("Workbench offline policy", () => {
  it("shows the offline banner and blocks writes with a hint", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => false,
    })
    try {
      renderWorkbench()
      await waitFor(() =>
        expect(screen.getAllByText("Growth Regression").length).toBeGreaterThan(0),
      )
      goToTab(/Working papers/)
      expect(
        await screen.findByText(
          "Offline: the research workspace needs a connection to save edits.",
        ),
      ).toBeInTheDocument()
      const add = screen.getByRole("button", { name: /Add paper/ })
      expect(add).toBeDisabled()
      fireEvent.click(add)
      expect(api.createResearchPaper).not.toHaveBeenCalled()
    } finally {
      delete (window.navigator as { onLine?: boolean }).onLine
    }
  })
})
