import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { Locale } from "../lib/i18n"
import type { LibraryScope, ViewMode } from "../api/types"
import type { ReaderAnnotation } from "../lib/annotations"

export type ShortcutAction = "palette" | "search" | "next" | "previous" | "toggleStar" | "toggleRead"
export type ThemeMode = "system" | "light" | "dark"

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

export type ReaderFontFamily = "serif" | "sans"

export interface ReaderAppearance {
  fontFamily: ReaderFontFamily
  fontSize: number
  lineHeight: number
}

export const defaultReaderAppearance: ReaderAppearance = {
  fontFamily: "serif",
  fontSize: 19,
  lineHeight: 1.8,
}

export const defaultPaneLayout: PaneLayout = { sidebarWidth: 232, timelineWidth: 376 }

interface ReaderStore {
  scope: LibraryScope
  selectedEntryID: string | null
  search: string
  viewMode: ViewMode
  mobileReaderOpen: boolean
  locale: Locale
  theme: ThemeMode
  paneLayout: PaneLayout
  readerAppearance: ReaderAppearance
  annotations: ReaderAnnotation[]
  shortcuts: Record<ShortcutAction, string>
  setScope: (scope: LibraryScope) => void
  selectEntry: (entryID: string | null) => void
  setSearch: (search: string) => void
  setViewMode: (viewMode: ViewMode) => void
  closeMobileReader: () => void
  setLocale: (locale: Locale) => void
  setTheme: (theme: ThemeMode) => void
  setPaneLayout: (paneLayout: PaneLayout) => void
  setReaderAppearance: (appearance: Partial<ReaderAppearance>) => void
  addAnnotation: (annotation: ReaderAnnotation) => void
  removeAnnotation: (annotationID: string) => void
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
      theme: "system",
      paneLayout: defaultPaneLayout,
      readerAppearance: defaultReaderAppearance,
      annotations: [],
      shortcuts: defaultShortcuts,
      setScope: (scope) => set({ scope, selectedEntryID: null, mobileReaderOpen: false }),
      selectEntry: (selectedEntryID) => set({ selectedEntryID, mobileReaderOpen: selectedEntryID !== null }),
      setSearch: (search) => set({ search, selectedEntryID: null }),
      setViewMode: (viewMode) => set({ viewMode }),
      closeMobileReader: () => set({ selectedEntryID: null, mobileReaderOpen: false }),
      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
      setPaneLayout: (paneLayout) => set({ paneLayout }),
      setReaderAppearance: (appearance) =>
        set((state) => ({ readerAppearance: { ...state.readerAppearance, ...appearance } })),
      addAnnotation: (annotation) =>
        set((state) => ({ annotations: [...state.annotations, annotation].slice(-500) })),
      removeAnnotation: (annotationID) =>
        set((state) => ({
          annotations: state.annotations.filter((annotation) => annotation.id !== annotationID),
        })),
      setShortcut: (action, shortcut) => set((state) => ({ shortcuts: { ...state.shortcuts, [action]: shortcut } })),
      resetShortcuts: () => set({ shortcuts: defaultShortcuts }),
    }),
    {
      name: "cairn-reader-preferences",
      partialize: (state) => ({
        viewMode: state.viewMode,
        shortcuts: state.shortcuts,
        locale: state.locale,
        theme: state.theme,
        paneLayout: state.paneLayout,
        readerAppearance: state.readerAppearance,
        annotations: state.annotations,
      }),
    },
  ),
)
