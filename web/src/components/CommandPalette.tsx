import * as Dialog from "@radix-ui/react-dialog"
import {
  Article,
  GearSix,
  House,
  MagnifyingGlass,
  Plus,
  Star,
  Tray,
  X,
} from "@phosphor-icons/react"
import { useMemo, useState } from "react"

import type { LibraryScope } from "../api/types"
import { displayShortcut } from "../lib/shortcuts"
import type { ShortcutAction } from "../store/reader"

interface CommandPaletteProps {
  open: boolean
  shortcuts: Record<ShortcutAction, string>
  onOpenChange: (open: boolean) => void
  onScopeChange: (scope: LibraryScope) => void
  onAdd: () => void
  onPreferences: () => void
  onMarkAllRead: () => void
  onFocusSearch: () => void
}

export function CommandPalette(props: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const commands = useMemo(() => [
    { id: "today", label: "Go to Today", icon: House, run: () => props.onScopeChange({ kind: "today", title: "Today" }) },
    { id: "unread", label: "Go to Unread", icon: Tray, run: () => props.onScopeChange({ kind: "unread", title: "Unread" }) },
    { id: "saved", label: "Go to Saved", icon: Star, run: () => props.onScopeChange({ kind: "saved", title: "Saved" }) },
    { id: "search", label: "Search library", icon: MagnifyingGlass, shortcut: props.shortcuts.search, run: props.onFocusSearch },
    { id: "add", label: "Add subscription", icon: Plus, run: props.onAdd },
    { id: "read", label: "Mark current view read", icon: Article, run: props.onMarkAllRead },
    { id: "preferences", label: "Open preferences", icon: GearSix, run: props.onPreferences },
  ], [props])
  const filtered = commands.filter((command) => command.label.toLowerCase().includes(query.trim().toLowerCase()))
  const run = (command: (typeof commands)[number]) => {
    props.onOpenChange(false)
    setQuery("")
    command.run()
  }
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="command-palette" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <div className="command-search">
            <MagnifyingGlass aria-hidden="true" />
            <input value={query} placeholder="Type a command" onChange={(event) => setQuery(event.target.value)} autoFocus />
            <Dialog.Close asChild><button className="icon-button" type="button" aria-label="Close" title="Close"><X /></button></Dialog.Close>
          </div>
          <div className="command-list" role="listbox" aria-label="Commands">
            {filtered.map((command) => {
              const Icon = command.icon
              return <button className="command-item" type="button" role="option" aria-selected="false" key={command.id} onClick={() => run(command)}><Icon /><span>{command.label}</span>{command.shortcut && <kbd>{displayShortcut(command.shortcut)}</kbd>}</button>
            })}
            {filtered.length === 0 && <p className="command-empty">No matching commands</p>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
