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
import { useTranslation } from "../lib/i18n"
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
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const commands = useMemo(() => [
    { id: "today", label: t("goToToday"), icon: House, run: () => props.onScopeChange({ kind: "today", title: "Today" }) },
    { id: "unread", label: t("goToUnread"), icon: Tray, run: () => props.onScopeChange({ kind: "unread", title: "Unread" }) },
    { id: "saved", label: t("goToSaved"), icon: Star, run: () => props.onScopeChange({ kind: "saved", title: "Saved" }) },
    { id: "search", label: t("searchLibrary"), icon: MagnifyingGlass, shortcut: props.shortcuts.search, run: props.onFocusSearch },
    { id: "add", label: t("addSubscription"), icon: Plus, run: props.onAdd },
    { id: "read", label: t("markCurrentViewRead"), icon: Article, run: props.onMarkAllRead },
    { id: "preferences", label: t("openPreferences"), icon: GearSix, run: props.onPreferences },
  ], [props, t])
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
          <Dialog.Title className="sr-only">{t("commandPalette")}</Dialog.Title>
          <div className="command-search">
            <MagnifyingGlass aria-hidden="true" />
            <input value={query} placeholder={t("typeCommand")} onChange={(event) => setQuery(event.target.value)} autoFocus />
            <Dialog.Close asChild><button className="icon-button" type="button" aria-label={t("close")} title={t("close")}><X /></button></Dialog.Close>
          </div>
          <div className="command-list" role="listbox" aria-label={t("commands")}>
            {filtered.map((command) => {
              const Icon = command.icon
              return <button className="command-item" type="button" role="option" aria-selected="false" key={command.id} onClick={() => run(command)}><Icon /><span>{command.label}</span>{command.shortcut && <kbd>{displayShortcut(command.shortcut)}</kbd>}</button>
            })}
            {filtered.length === 0 && <p className="command-empty">{t("noMatchingCommands")}</p>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
