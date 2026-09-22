import { describe, expect, it } from "vitest"

import { useReaderStore } from "./reader"

describe("accentTheme", () => {
  it("defaults to academic-blue", () => {
    expect(useReaderStore.getState().accentTheme).toBe("academic-blue")
  })

  it("updates when setAccentTheme is called", () => {
    useReaderStore.getState().setAccentTheme("forest")
    expect(useReaderStore.getState().accentTheme).toBe("forest")
    useReaderStore.getState().setAccentTheme("academic-blue")
    expect(useReaderStore.getState().accentTheme).toBe("academic-blue")
  })

  it("is included in the persisted partialize output", () => {
    useReaderStore.getState().setAccentTheme("wine")
    const partialize = useReaderStore.persist.getOptions().partialize
    expect(partialize).toBeTypeOf("function")
    const persisted = partialize?.(useReaderStore.getState()) as Record<string, unknown>
    expect(persisted).toHaveProperty("accentTheme", "wine")
    useReaderStore.getState().setAccentTheme("academic-blue")
  })
})
