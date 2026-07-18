import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { Locale } from "../lib/i18n"
import type { LibraryScope, ViewMode } from "../api/types"
import type { ReaderAnnotation } from "../lib/annotations"

export type ShortcutAction =
  "palette" | "search" | "next" | "previous" | "toggleStar" | "toggleRead"
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
  readerReturnScope: LibraryScope | null
  selectedEntryID: string | null
  search: string
  viewMode: ViewMode
  mobileReaderOpen: boolean
  locale: Locale
  theme: ThemeMode
  paneLayout: PaneLayout
  openFolders: Record<string, boolean>
  readerAppearance: ReaderAppearance
  annotations: ReaderAnnotation[]
  shortcuts: Record<ShortcutAction, string>
  alwaysTranslateTitles: boolean
  alwaysTranslateContent: boolean
  setScope: (scope: LibraryScope) => void
  selectEntry: (entryID: string | null) => void
  setSearch: (search: string) => void
  setViewMode: (viewMode: ViewMode) => void
  closeMobileReader: () => void
  setLocale: (locale: Locale) => void
  setTheme: (theme: ThemeMode) => void
  setPaneLayout: (paneLayout: PaneLayout) => void
  toggleFolder: (folderID: string) => void
  setReaderAppearance: (appearance: Partial<ReaderAppearance>) => void
  addAnnotation: (annotation: ReaderAnnotation) => void
  removeAnnotation: (annotationID: string) => void
  setShortcut: (action: ShortcutAction, shortcut: string) => void
  resetShortcuts: () => void
  setAlwaysTranslateTitles: (enabled: boolean) => void
  setAlwaysTranslateContent: (enabled: boolean) => void
}

export const useReaderStore = create<ReaderStore>()(
  persist(
    (set) => ({
      scope: { kind: "today", title: "Today" },
      readerReturnScope: null,
      selectedEntryID: null,
      search: "",
      viewMode: "standard",
      mobileReaderOpen: false,
      locale: "zh-CN",
      theme: "system",
      paneLayout: defaultPaneLayout,
      openFolders: {},
      readerAppearance: defaultReaderAppearance,
      annotations: [],
      shortcuts: defaultShortcuts,
      alwaysTranslateTitles: false,
      alwaysTranslateContent: false,
      setScope: (scope) =>
        set({ scope, readerReturnScope: null, selectedEntryID: null, mobileReaderOpen: false }),
      selectEntry: (selectedEntryID) =>
        set((state) => ({
          selectedEntryID,
          readerReturnScope: selectedEntryID === null ? null : state.scope,
          mobileReaderOpen: selectedEntryID !== null,
        })),
      setSearch: (search) => set({ search, readerReturnScope: null, selectedEntryID: null }),
      setViewMode: (viewMode) => set({ viewMode }),
      closeMobileReader: () =>
        set((state) => ({
          selectedEntryID: null,
          mobileReaderOpen: false,
          scope: state.readerReturnScope ?? state.scope,
          readerReturnScope: null,
        })),
      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
      setPaneLayout: (paneLayout) => set({ paneLayout }),
      toggleFolder: (folderID) =>
        set((state) => ({
          openFolders: { ...state.openFolders, [folderID]: !(state.openFolders[folderID] ?? true) },
        })),
      setReaderAppearance: (appearance) =>
        set((state) => ({ readerAppearance: { ...state.readerAppearance, ...appearance } })),
      addAnnotation: (annotation) =>
        set((state) => ({ annotations: [...state.annotations, annotation].slice(-500) })),
      removeAnnotation: (annotationID) =>
        set((state) => ({
          annotations: state.annotations.filter((annotation) => annotation.id !== annotationID),
        })),
      setShortcut: (action, shortcut) =>
        set((state) => ({ shortcuts: { ...state.shortcuts, [action]: shortcut } })),
      resetShortcuts: () => set({ shortcuts: defaultShortcuts }),
      setAlwaysTranslateTitles: (alwaysTranslateTitles) => set({ alwaysTranslateTitles }),
      setAlwaysTranslateContent: (alwaysTranslateContent) => set({ alwaysTranslateContent }),
    }),
    {
      name: "cairn-reader-preferences",
      partialize: (state) => ({
        viewMode: state.viewMode,
        shortcuts: state.shortcuts,
        locale: state.locale,
        theme: state.theme,
        paneLayout: state.paneLayout,
        openFolders: state.openFolders,
        readerAppearance: state.readerAppearance,
        annotations: state.annotations,
        alwaysTranslateTitles: state.alwaysTranslateTitles,
        alwaysTranslateContent: state.alwaysTranslateContent,
      }),
    },
  ),
)
