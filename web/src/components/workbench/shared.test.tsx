import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useReaderStore } from "../../store/reader"
import { ChipEditor, InlineText } from "./shared"

beforeEach(() => {
  useReaderStore.setState({ locale: "en-US" })
})

afterEach(() => cleanup())

describe("InlineText", () => {
  it("renders the value and an i18n edit hint (no hard-coded Chinese)", () => {
    render(<InlineText value="Smith J" placeholder="(fill in)" onCommit={() => {}} />)
    const span = screen.getByText("Smith J")
    expect(span).toHaveAttribute("title", expect.stringContaining("Double-click"))
    expect(span.getAttribute("title")).not.toContain("双击")
  })

  it("is keyboard reachable and starts editing on Enter", () => {
    render(<InlineText value="Smith J" placeholder="(fill in)" onCommit={() => {}} />)
    const span = screen.getByText("Smith J")
    expect(span).toHaveAttribute("role", "button")
    expect(span).toHaveAttribute("tabindex", "0")
    fireEvent.keyDown(span, { key: "Enter" })
    expect(screen.getByDisplayValue("Smith J")).toBeInTheDocument()
  })

  it("commits on Enter only with the trimmed changed value", () => {
    const onCommit = vi.fn()
    render(<InlineText value="A Journal" placeholder="(fill in)" onCommit={onCommit} />)
    fireEvent.doubleClick(screen.getByText("A Journal"))
    const input = screen.getByDisplayValue("A Journal")
    fireEvent.change(input, { target: { value: "  B Journal  " } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith("B Journal")
  })

  it("does not PATCH when blurring without a real change", () => {
    const onCommit = vi.fn()
    render(<InlineText value="Same value" placeholder="(fill in)" onCommit={onCommit} />)
    fireEvent.doubleClick(screen.getByText("Same value"))
    const input = screen.getByDisplayValue("Same value")
    // Trailing whitespace added by the user is trimmed away; the stored value
    // is unchanged, so no network write should happen.
    fireEvent.change(input, { target: { value: "Same value   " } })
    fireEvent.blur(input)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it("Escape cancels without committing", () => {
    const onCommit = vi.fn()
    render(<InlineText value="Original" placeholder="(fill in)" onCommit={onCommit} />)
    fireEvent.doubleClick(screen.getByText("Original"))
    const input = screen.getByDisplayValue("Original")
    fireEvent.change(input, { target: { value: "Discarded" } })
    fireEvent.keyDown(input, { key: "Escape" })
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText("Original")).toBeInTheDocument()
  })
})

describe("ChipEditor", () => {
  it("adds a chip through an inline input instead of window.prompt", () => {
    const promptSpy = vi.spyOn(window, "prompt").mockImplementation(() => null)
    const onChange = vi.fn()
    render(
      <ChipEditor label="Authors" items={["Ada"]} addPrompt="Enter author:" onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    const input = screen.getByPlaceholderText("Enter author:")
    fireEvent.change(input, { target: { value: " Grace " } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(promptSpy).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith(["Ada", "Grace"])
  })

  it("ignores empty additions", () => {
    const onChange = vi.fn()
    render(
      <ChipEditor label="Authors" items={["Ada"]} addPrompt="Enter author:" onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    const input = screen.getByPlaceholderText("Enter author:")
    fireEvent.change(input, { target: { value: "   " } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onChange).not.toHaveBeenCalled()
  })

  it("removes chips via labelled buttons", () => {
    const onChange = vi.fn()
    render(
      <ChipEditor
        label="Authors"
        items={["Ada", "Bob"]}
        addPrompt="Enter author:"
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Delete: Ada" }))
    expect(onChange).toHaveBeenCalledWith(["Bob"])
  })
})
