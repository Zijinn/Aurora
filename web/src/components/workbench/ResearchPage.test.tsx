import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ResearchPaper } from "../../api/types"
import { useReaderStore } from "../../store/reader"
import { ResearchPage } from "./ResearchPage"

beforeEach(() => {
  useReaderStore.setState({ locale: "en-US" })
})

function paper(overrides: Partial<ResearchPaper> = {}): ResearchPaper {
  return {
    id: "r-1",
    kind: "research",
    position: 0,
    title: "Working Paper One",
    authors: ["Zhang San"],
    keywords: [],
    file_path: "/papers/one",
    next_action: "Run robustness checks",
    notes: "",
    research_area: "Development economics",
    status: "",
    priority: "High",
    target_journal: "经济研究",
    stages: [
      { name: "Intro", done: true, children: [] },
      { name: "Empirics", done: false, children: [] },
    ],
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

function props() {
  return {
    onCreate: vi.fn(),
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    onReorder: vi.fn(),
    onMove: vi.fn(),
  }
}

describe("ResearchPage", () => {
  it("renders the localized eyebrow instead of a hard-coded English label", () => {
    render(<ResearchPage papers={[paper()]} {...props()} />)
    expect(screen.getByText(/R001 · RESEARCH PROJECT/)).toBeInTheDocument()
    expect(screen.getByText("Working Paper One")).toBeInTheDocument()
  })

  it("filters by whitelisted text fields", () => {
    render(
      <ResearchPage
        papers={[paper(), paper({ id: "r-2", title: "Behavioural Contracts", research_area: "" })]}
        {...props()}
      />,
    )
    const search = screen.getByPlaceholderText(/Search title/i)
    fireEvent.change(search, { target: { value: "development" } })
    expect(screen.getByText("Working Paper One")).toBeInTheDocument()
    expect(screen.queryByText("Behavioural Contracts")).not.toBeInTheDocument()
  })

  it("asks the parent to move a paper through the flow button", () => {
    const handlers = props()
    render(<ResearchPage papers={[paper()]} {...handlers} />)
    fireEvent.click(screen.getByRole("button", { name: /Move to submissions/ }))
    expect(handlers.onMove).toHaveBeenCalledWith("r-1")
  })

  it("exposes an aria-labelled delete button", () => {
    const handlers = props()
    render(<ResearchPage papers={[paper()]} {...handlers} />)
    fireEvent.click(screen.getByRole("button", { name: "Delete: Working Paper One" }))
    expect(handlers.onDelete).toHaveBeenCalledWith("r-1")
  })

  it("keeps stage data visible while editing stages", () => {
    const handlers = props()
    render(<ResearchPage papers={[paper()]} {...handlers} />)
    expect(screen.getByText("Intro")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Toggle completion: Intro" }))
    // Toggling an already-done leaf flips it to undone via onUpdate(stages).
    expect(handlers.onUpdate).toHaveBeenCalledWith("r-1", {
      stages: [
        { name: "Intro", done: false, children: [] },
        { name: "Empirics", done: false, children: [] },
      ],
    })
  })
})

afterEach(() => cleanup())
