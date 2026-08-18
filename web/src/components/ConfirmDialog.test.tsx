import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import { ConfirmDialog } from "./ConfirmDialog"

afterEach(() => cleanup())

it("runs the guarded action only after an explicit confirm", () => {
  const onConfirm = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <ConfirmDialog
      open={true}
      message="Delete this folder?"
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
    />,
  )

  expect(screen.getByText("Delete this folder?")).toBeTruthy()
  expect(onConfirm).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole("button", { name: "确认" }))
  expect(onConfirm).toHaveBeenCalledTimes(1)
})

it("cancels without running the action", () => {
  const onConfirm = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <ConfirmDialog
      open={true}
      message="Delete this folder?"
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
    />,
  )

  fireEvent.click(screen.getByRole("button", { name: "取消" }))
  expect(onConfirm).not.toHaveBeenCalled()
  expect(onOpenChange).toHaveBeenCalledWith(false)
})

it("dismisses on Escape without running the action", () => {
  const onConfirm = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <ConfirmDialog
      open={true}
      message="Delete this folder?"
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
    />,
  )

  fireEvent.keyDown(document, { key: "Escape" })
  expect(onConfirm).not.toHaveBeenCalled()
  expect(onOpenChange).toHaveBeenCalledWith(false)
})
