import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ResearchPaper, SubmissionRecord } from "../../api/types"
import { useReaderStore } from "../../store/reader"
import { SubmittedPage } from "./SubmittedPage"

beforeEach(() => {
  useReaderStore.setState({ locale: "en-US" })
})

function paper(overrides: Partial<ResearchPaper> = {}): ResearchPaper {
  return {
    id: "s-1",
    kind: "submitted",
    position: 0,
    title: "Submitted Paper",
    authors: ["Li Si"],
    keywords: [],
    file_path: "",
    next_action: "",
    notes: "",
    research_area: "",
    status: "under_review",
    priority: "",
    target_journal: "",
    stages: [],
    current_journal: "Journal of Development Economics",
    submission_date: "2026-08-01",
    manuscript_id: "JDE-26-0042",
    submission_count: 1,
    target_level: "",
    editor: "",
    history: [{ journal: "Review of Finance", date: "2026-01-15", status: "rejected" }],
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
    last_updated: "",
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

describe("SubmittedPage", () => {
  it("renders history rows with translated status badges and i18n titles", () => {
    render(<SubmittedPage papers={[paper()]} {...props()} />)
    expect(screen.getByText("Review of Finance")).toBeInTheDocument()
    // Badge (plus the status <option>s) all render the translated label.
    const badges = document.querySelectorAll(".wb-badge--red")
    expect(badges).toHaveLength(1)
    expect(badges[0]).toHaveTextContent("Rejected")
    expect(screen.getByRole("button", { name: "Add record: Submitted Paper" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Delete record: Review of Finance" }),
    ).toBeInTheDocument()
  })

  it("adds a history record through an inline form, not window.prompt", () => {
    const promptSpy = vi.spyOn(window, "prompt").mockImplementation(() => null)
    const handlers = props()
    render(<SubmittedPage papers={[paper()]} {...handlers} />)
    fireEvent.click(screen.getByRole("button", { name: "Add record: Submitted Paper" }))
    const journal = screen.getByLabelText("Enter the journal name:")
    fireEvent.change(journal, { target: { value: "Review of Economic Studies" } })
    fireEvent.keyDown(journal, { key: "Enter" })
    expect(promptSpy).not.toHaveBeenCalled()
    expect(handlers.onUpdate).toHaveBeenCalledTimes(1)
    const history = (handlers.onUpdate.mock.calls[0]![1] as { history: SubmissionRecord[] }).history
    expect(history).toHaveLength(2)
    expect(history[0]).toEqual({
      journal: "Review of Finance",
      date: "2026-01-15",
      status: "rejected",
    })
    expect(history[1]!.journal).toBe("Review of Economic Studies")
    expect(history[1]!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(history[1]!.status).toBe("submitted")
  })

  it("ignores a record without a journal name", () => {
    const handlers = props()
    render(<SubmittedPage papers={[paper()]} {...handlers} />)
    fireEvent.click(screen.getByRole("button", { name: "Add record: Submitted Paper" }))
    fireEvent.keyDown(screen.getByLabelText("Enter the journal name:"), { key: "Enter" })
    expect(handlers.onUpdate).not.toHaveBeenCalled()
  })

  it("deletes a history record via onUpdate with the row removed", () => {
    const handlers = props()
    render(<SubmittedPage papers={[paper()]} {...handlers} />)
    fireEvent.click(screen.getByRole("button", { name: "Delete record: Review of Finance" }))
    expect(handlers.onUpdate).toHaveBeenCalledWith("s-1", { history: [] })
  })

  it("moves to published through the parent callback", () => {
    const handlers = props()
    render(<SubmittedPage papers={[paper()]} {...handlers} />)
    fireEvent.click(screen.getByRole("button", { name: /Move to publications/ }))
    expect(handlers.onMove).toHaveBeenCalledWith("s-1")
  })
})

afterEach(() => cleanup())
