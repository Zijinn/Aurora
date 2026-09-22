import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ResearchPaper } from "../../api/types"
import { useReaderStore } from "../../store/reader"
import { useToastStore } from "../../store/toast"
import { PublishedPage } from "./PublishedPage"

beforeEach(() => {
  useReaderStore.setState({ locale: "en-US" })
  useToastStore.setState({ toasts: [] })
})

function paper(overrides: Partial<ResearchPaper> = {}): ResearchPaper {
  return {
    id: "p-1",
    kind: "published",
    position: 0,
    title: "Data and Growth",
    authors: ["Smith J"],
    keywords: [],
    file_path: "",
    next_action: "",
    notes: "",
    research_area: "",
    status: "",
    priority: "",
    target_journal: "",
    stages: [],
    current_journal: "",
    submission_date: "",
    manuscript_id: "",
    submission_count: 0,
    target_level: "",
    editor: "",
    deadline: "",
    history: [],
    abstract: "",
    journal: "American Economic Review",
    language: "",
    year: "2024",
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

function noopProps() {
  return {
    citationPendingID: null,
    onCreate: vi.fn(),
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    onReorder: vi.fn(),
    onFetchCitation: vi.fn(),
    onFetchAllCitations: vi.fn(),
    onCrossrefEmailChange: vi.fn(),
  }
}

describe("PublishedPage crossref email input", () => {
  it("backfills the input when the email arrives asynchronously", () => {
    const props = { ...noopProps(), crossrefEmail: "" }
    const view = render(<PublishedPage papers={[paper()]} {...props} />)
    const input = screen.getByPlaceholderText(/your-email|example\.com/i)
    expect(input).toHaveValue("")
    // Preferences query resolves later: the old defaultValue version kept
    // showing an empty box forever.
    view.rerender(<PublishedPage papers={[paper()]} {...props} crossrefEmail="me@lab.org" />)
    expect(screen.getByPlaceholderText(/your-email|example\.com/i)).toHaveValue("me@lab.org")
  })

  it("never submits an empty string and blurs away", () => {
    const props = { ...noopProps(), crossrefEmail: "" }
    render(<PublishedPage papers={[paper()]} {...props} />)
    const input = screen.getByPlaceholderText(/your-email|example\.com/i)
    fireEvent.change(input, { target: { value: "   " } })
    fireEvent.blur(input)
    expect(props.onCrossrefEmailChange).not.toHaveBeenCalled()
  })

  it("does not re-PUT the unchanged stored value", () => {
    const props = { ...noopProps(), crossrefEmail: "me@lab.org" }
    render(<PublishedPage papers={[paper()]} {...props} />)
    const input = screen.getByPlaceholderText(/your-email|example\.com/i)
    fireEvent.blur(input)
    expect(props.onCrossrefEmailChange).not.toHaveBeenCalled()
  })

  it("commits the trimmed value on blur", () => {
    const props = { ...noopProps(), crossrefEmail: "" }
    render(<PublishedPage papers={[paper()]} {...props} />)
    const input = screen.getByPlaceholderText(/your-email|example\.com/i)
    fireEvent.change(input, { target: { value: " new@lab.org " } })
    fireEvent.blur(input)
    expect(props.onCrossrefEmailChange).toHaveBeenCalledWith("new@lab.org")
  })
})

describe("PublishedPage citations", () => {
  it("stores the stable manual enum key instead of a Chinese label", () => {
    const props = { ...noopProps(), crossrefEmail: "" }
    render(<PublishedPage papers={[paper({ citations: 3 })]} {...props} />)
    fireEvent.doubleClick(screen.getByText("3"))
    const input = screen.getByDisplayValue("3")
    fireEvent.change(input, { target: { value: "12" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(props.onUpdate).toHaveBeenCalledWith("p-1", {
      citations: 12,
      citation_source: "manual",
    })
  })

  it("recognises Crossref sources (including the legacy Chinese label)", () => {
    const props = { ...noopProps(), crossrefEmail: "" }
    render(
      <PublishedPage
        papers={[
          paper({
            id: "p-cross",
            citations: 8,
            citation_source: "Crossref",
            citation_updated_at: "2026-01-02T00:00:00Z",
          }),
          paper({ id: "p-legacy", citations: 4, citation_source: "手工录入" }),
        ]}
        {...props}
      />,
    )
    expect(screen.getByText(/Crossref \(2026-01-02\)/)).toBeInTheDocument()
    // The legacy label must not be displayed raw nor treated as Crossref.
    expect(screen.queryByText("手工录入")).not.toBeInTheDocument()
    expect(
      screen.getAllByText(/Double-click to edit, or fetch|fetch from Crossref/i).length,
    ).toBeGreaterThan(0)
  })

  it("fetch guard: a missing DOI surfaces a toast without calling the API", () => {
    const props = { ...noopProps(), crossrefEmail: "me@lab.org" }
    render(<PublishedPage papers={[paper()]} {...props} />)
    fireEvent.click(screen.getByRole("button", { name: /Crossref/ }))
    expect(props.onFetchCitation).not.toHaveBeenCalled()
    const messages = useToastStore.getState().toasts.map((item) => item.message)
    expect(messages.some((message) => /DOI/i.test(message))).toBe(true)
  })
})

describe("PublishedPage search", () => {
  it("filters on whitelisted fields only", () => {
    const props = { ...noopProps(), crossrefEmail: "" }
    render(
      <PublishedPage
        papers={[
          paper({ title: "Machine Learning Review", notes: "internal-note-42" }),
          paper({ id: "p-2", title: "Other Paper" }),
        ]}
        {...props}
      />,
    )
    const search = screen.getByPlaceholderText(/Search title/i)
    fireEvent.change(search, { target: { value: "machine learning" } })
    expect(screen.getByText("Machine Learning Review")).toBeInTheDocument()
    expect(screen.queryByText("Other Paper")).not.toBeInTheDocument()
    // JSON.stringify matching would have hit internal keys like "notes" too;
    // the value itself only matches through the whitelisted notes field.
    fireEvent.change(search, { target: { value: "internal-note-42" } })
    expect(screen.getByText("Machine Learning Review")).toBeInTheDocument()
    fireEvent.change(search, { target: { value: "citation_updated_at" } })
    expect(screen.queryByText("Machine Learning Review")).not.toBeInTheDocument()
  })
})

describe("PublishedPage batch citations", () => {
  it("fires onFetchAllCitations from the toolbar button", () => {
    const props = { ...noopProps(), crossrefEmail: "me@lab.org" }
    render(<PublishedPage papers={[paper()]} {...props} />)
    fireEvent.click(screen.getByRole("button", { name: "Update all citations" }))
    expect(props.onFetchAllCitations).toHaveBeenCalledTimes(1)
  })

  it("disables the batch button and swaps its label while pending", () => {
    const props = { ...noopProps(), crossrefEmail: "me@lab.org", batchCitationPending: true }
    render(<PublishedPage papers={[paper()]} {...props} />)
    const button = screen.getByRole("button", { name: "Updating all citations…" })
    expect(button).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Update all citations" })).not.toBeInTheDocument()
  })
})

describe("PublishedPage offline", () => {
  it("disables write affordances when offline", () => {
    const props = { ...noopProps(), crossrefEmail: "", offline: true }
    render(<PublishedPage papers={[paper()]} {...props} />)
    expect(screen.getByRole("button", { name: /＋ Add paper|Add paper/ })).toBeDisabled()
  })
})

afterEach(() => cleanup())
