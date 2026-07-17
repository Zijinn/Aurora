import type { KeyboardEvent as ReactKeyboardEvent } from "react"

export function keyboardChord(event: KeyboardEvent | ReactKeyboardEvent): string {
  const parts: string[] = []
  if (event.metaKey || event.ctrlKey) parts.push("mod")
  if (event.altKey) parts.push("alt")
  if (event.shiftKey) parts.push("shift")
  const key = normalizeKey(event.key)
  if (!modifierKeys.has(key)) parts.push(key)
  return parts.join("+")
}

export function displayShortcut(shortcut: string): string {
  const isMac = navigator.platform.toLowerCase().includes("mac")
  return shortcut
    .split("+")
    .map((part) => {
      if (part === "mod") return isMac ? "⌘" : "Ctrl"
      if (part === "alt") return isMac ? "⌥" : "Alt"
      if (part === "shift") return isMac ? "⇧" : "Shift"
      if (part === "escape") return "Esc"
      if (part === " ") return "Space"
      return part.length === 1 ? part.toUpperCase() : part
    })
    .join(isMac ? "" : "+")
}

function normalizeKey(key: string) {
  const lowered = key.toLowerCase()
  if (lowered === "control" || lowered === "meta") return "mod"
  if (lowered === "esc") return "escape"
  return lowered
}

const modifierKeys = new Set(["mod", "alt", "shift"])
