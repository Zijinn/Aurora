import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { Locale } from "../lib/i18n"
import type { LibraryScope, ViewMode } from "../api/types"

export type ShortcutAction = "palette" | "search" | "next" | "previous" | "toggleStar" | "toggleRead"

export const defaultShortcuts: Record<ShortcutAction, string> = {
  palette: "mod+k",
  search: "/",
  next: "j",
  previous: "k",
  toggleStar: "s",
  toggleRead: "m",
}

export interface PaneLayout {
  sidebarWidth: number
  timelineWidth: number
}

export const defaultPaneLayout: PaneLayout = { sidebarWidth: 256, timelineWidth: 416 }

interface ReaderStore {
  scope: LibraryScope
  selectedEntryID: string | null
  search: string
  viewMode: ViewMode
  mobileReaderOpen: boolean
  locale: Locale
  paneLayout: PaneLayout
  shortcuts: Record<ShortcutAction, string>
  setScope: (scope: LibraryScope) => void
  selectEntry: (entryID: string | null) => void
  setSearch: (search: string) => void
  setViewMode: (viewMode: ViewMode) => void
  closeMobileReader: () => void
  setLocale: (locale: Locale) => void
  setPaneLayout: (paneLayout: PaneLayout) => void
  setShortcut: (action: ShortcutAction, shortcut: string) => void
  resetShortcuts: () => void
}

export const useReaderStore = create<ReaderStore>()(
  persist(
    (set) => ({
      scope: { kind: "today", title: "Today" },
      selectedEntryID: null,
      search: "",
      viewMode: "standard",
      mobileReaderOpen: false,
      locale: "zh-CN",
      paneLayout: defaultPaneLayout,
      shortcuts: defaultShortcuts,
      setScope: (scope) => set({ scope, selectedEntryID: null, mobileReaderOpen: false }),
      selectEntry: (selectedEntryID) => set({ selectedEntryID, mobileReaderOpen: selectedEntryID !== null }),
      setSearch: (search) => set({ search, selectedEntryID: null }),
      setViewMode: (viewMode) => set({ viewMode }),
      closeMobileReader: () => set({ mobileReaderOpen: false }),
      setLocale: (locale) => set({ locale }),
      setPaneLayout: (paneLayout) => set({ paneLayout }),
      setShortcut: (action, shortcut) => set((state) => ({ shortcuts: { ...state.shortcuts, [action]: shortcut } })),
      resetShortcuts: () => set({ shortcuts: defaultShortcuts }),
    }),
    {
      name: "cairn-reader-preferences",
      partialize: (state) => ({ viewMode: state.viewMode, shortcuts: state.shortcuts, locale: state.locale, paneLayout: state.paneLayout }),
    },
  ),
)
