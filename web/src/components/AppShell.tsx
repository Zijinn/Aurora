import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  lazy,
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react"

import {
  addFeed,
  APIError,
  createAIProfile,
  createFolder,
  createRule,
  createSavedFilter,
  createTag,
  createPairingCode,
  createSyncAccount,
  deleteAIProfile,
  deleteFolder,
  deleteFeed,
  deleteRule,
  deleteSavedFilter,
  deleteTag,
  deleteSyncAccount,
  fetchReadability,
  getEntry,
  getAIUsage,
  getServerStatus,
  importOPML,
  listEntries,
  listDevices,
  listFolders,
  listRules,
  listSavedFilters,
  listAIProfiles,
  listAIProviders,
  listSubscriptions,
  listTags,
  listSyncAccounts,
  listSyncProviders,
  markEntriesRead,
  pairDevice,
  refreshFeed,
  restoreBackup,
  revokeDevice,
  runSyncAccount,
  setEntryTags,
  updateEntryState,
  updateAIProfile,
  updateFeed,
  updateSyncAccount,
} from "../api/client"
import type { Entry, EntryState, SyncProvider, SyncProviderID } from "../api/types"
import { useTranslation } from "../lib/i18n"
import { keyboardChord } from "../lib/shortcuts"
import { enqueueStateMutation, flushMutationOutbox } from "../offline/database"
import { useReaderStore, type PaneLayout } from "../store/reader"
import { Sidebar } from "./Sidebar"
import { TimelinePane } from "./TimelinePane"
import { MobileNav } from "./MobileNav"
import { MobileLibraryDialog } from "./MobileLibraryDialog"
import { PaneDivider } from "./PaneDivider"
import { WorkspaceHeader } from "./WorkspaceHeader"

const AddFeedDialog = lazy(() =>
  import("./AddFeedDialog").then((module) => ({ default: module.AddFeedDialog })),
)
const AIProfileDialog = lazy(() =>
  import("./AIProfileDialog").then((module) => ({ default: module.AIProfileDialog })),
)
const PreferencesDialog = lazy(() =>
  import("./PreferencesDialog").then((module) => ({ default: module.PreferencesDialog })),
)
const ReaderPane = lazy(() =>
  import("./ReaderPane").then((module) => ({ default: module.ReaderPane })),
)
const CommandPalette = lazy(() =>
  import("./CommandPalette").then((module) => ({ default: module.CommandPalette })),
)
const PairDeviceDialog = lazy(() =>
  import("./PairDeviceDialog").then((module) => ({ default: module.PairDeviceDialog })),
)
const SyncAccountDialog = lazy(() =>
  import("./SyncAccountDialog").then((module) => ({ default: module.SyncAccountDialog })),
)
const LibraryOrganizationDialog = lazy(() =>
  import("./LibraryOrganizationDialog").then((module) => ({
    default: module.LibraryOrganizationDialog,
  })),
)

const DESKTOP_BREAKPOINT = 900
const SIDEBAR_MIN = 210
const SIDEBAR_MAX = 360
const TIMELINE_MIN = 300
const TIMELINE_MAX = 560
const BUILT_IN_CLOUD_PROVIDERS: SyncProvider[] = [
  { id: "webdav", name: "WebDAV" },
  { id: "icloud", name: "iCloud Drive" },
]

export function AppShell() {
  const queryClient = useQueryClient()
  const scope = useReaderStore((state) => state.scope)
  const selectedEntryID = useReaderStore((state) => state.selectedEntryID)
  const search = useReaderStore((state) => state.search)
  const viewMode = useReaderStore((state) => state.viewMode)
  const mobileReaderOpen = useReaderStore((state) => state.mobileReaderOpen)
  const setScope = useReaderStore((state) => state.setScope)
  const selectEntry = useReaderStore((state) => state.selectEntry)
  const setSearch = useReaderStore((state) => state.setSearch)
  const closeMobileReader = useReaderStore((state) => state.closeMobileReader)
  const shortcuts = useReaderStore((state) => state.shortcuts)
  const theme = useReaderStore((state) => state.theme)
  const setTheme = useReaderStore((state) => state.setTheme)
  const paneLayout = useReaderStore((state) => state.paneLayout)
  const setPaneLayout = useReaderStore((state) => state.setPaneLayout)
  const { locale, t } = useTranslation()
  const deferredSearch = useDeferredValue(search)
  const [addOpen, setAddOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [syncAccountOpen, setSyncAccountOpen] = useState(false)
  const [syncAccountProvider, setSyncAccountProvider] = useState<SyncProviderID>()
  const [aiProfileOpen, setAIProfileOpen] = useState(false)
  const [organizationOpen, setOrganizationOpen] = useState(false)
  const [organizationMode, setOrganizationMode] = useState<"all" | "folders">("all")
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const online = useOnlineState()
  const shellRef = useRef<HTMLElement>(null)
  const dragStartLayout = useRef<PaneLayout>(paneLayout)
  const dragLayout = useRef<PaneLayout>(paneLayout)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    if (theme === "system") {
      delete document.documentElement.dataset.theme
      document.documentElement.style.colorScheme = "light dark"
    } else {
      document.documentElement.dataset.theme = theme
      document.documentElement.style.colorScheme = theme
    }
  }, [theme])

  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth)
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  const constrainedPaneLayout = useMemo(
    () => constrainPaneLayout(paneLayout, viewportWidth),
    [paneLayout, viewportWidth],
  )
  useEffect(() => {
    if (
      constrainedPaneLayout.sidebarWidth !== paneLayout.sidebarWidth ||
      constrainedPaneLayout.timelineWidth !== paneLayout.timelineWidth
    ) {
      setPaneLayout(constrainedPaneLayout)
    }
  }, [constrainedPaneLayout, paneLayout, setPaneLayout])

  const applyPaneLayout = useCallback((next: PaneLayout) => {
    shellRef.current?.style.setProperty("--sidebar-width", `${next.sidebarWidth}px`)
    shellRef.current?.style.setProperty("--timeline-width", `${next.timelineWidth}px`)
  }, [])
  const startPaneResize = useCallback(() => {
    dragStartLayout.current = constrainedPaneLayout
    dragLayout.current = constrainedPaneLayout
  }, [constrainedPaneLayout])
  const resizePane = useCallback(
    (edge: "sidebar" | "timeline", delta: number) => {
      const base = dragStartLayout.current
      const readerMinimum = minimumReaderWidth(viewportWidth)
      if (edge === "sidebar") {
        const max = Math.max(
          SIDEBAR_MIN,
          Math.min(SIDEBAR_MAX, viewportWidth - base.timelineWidth - readerMinimum),
        )
        dragLayout.current = {
          ...base,
          sidebarWidth: Math.round(clamp(base.sidebarWidth + delta, SIDEBAR_MIN, max)),
        }
      } else {
        const max = Math.max(
          TIMELINE_MIN,
          Math.min(TIMELINE_MAX, viewportWidth - base.sidebarWidth - readerMinimum),
        )
        dragLayout.current = {
          ...base,
          timelineWidth: Math.round(clamp(base.timelineWidth + delta, TIMELINE_MIN, max)),
        }
      }
      applyPaneLayout(dragLayout.current)
    },
    [applyPaneLayout, viewportWidth],
  )
  const finishPaneResize = useCallback(() => {
    setPaneLayout(dragLayout.current)
  }, [setPaneLayout])
  const readerMinimum = minimumReaderWidth(viewportWidth)
  const sidebarMax = Math.max(
    SIDEBAR_MIN,
    Math.min(SIDEBAR_MAX, viewportWidth - constrainedPaneLayout.timelineWidth - readerMinimum),
  )
  const timelineMax = Math.max(
    TIMELINE_MIN,
    Math.min(TIMELINE_MAX, viewportWidth - constrainedPaneLayout.sidebarWidth - readerMinimum),
  )
  const shellStyle = {
    "--sidebar-width": `${constrainedPaneLayout.sidebarWidth}px`,
    "--timeline-width": `${constrainedPaneLayout.timelineWidth}px`,
  } as CSSProperties

  const status = useQuery({
    queryKey: ["server-status"],
    queryFn: ({ signal }) => getServerStatus(signal),
    retry: 2,
    refetchInterval: 30_000,
  })
  const libraryEnabled =
    status.isSuccess && (!status.data.device_auth_required || status.data.device_authenticated)
  const subscriptions = useQuery({
    queryKey: ["subscriptions"],
    queryFn: ({ signal }) => listSubscriptions(signal),
    enabled: libraryEnabled,
  })
  const folders = useQuery({
    queryKey: ["folders"],
    queryFn: ({ signal }) => listFolders(signal),
    enabled: libraryEnabled,
  })
  const tags = useQuery({
    queryKey: ["tags"],
    queryFn: ({ signal }) => listTags(signal),
    enabled: libraryEnabled,
  })
  const rules = useQuery({
    queryKey: ["rules"],
    queryFn: ({ signal }) => listRules(signal),
    enabled: libraryEnabled,
  })
  const savedFilters = useQuery({
    queryKey: ["saved-filters"],
    queryFn: ({ signal }) => listSavedFilters(signal),
    enabled: libraryEnabled,
  })
  const devices = useQuery({
    queryKey: ["devices"],
    queryFn: ({ signal }) => listDevices(signal),
    enabled: libraryEnabled,
  })
  const syncProviders = useQuery({
    queryKey: ["sync-providers"],
    queryFn: ({ signal }) => listSyncProviders(signal),
    enabled: libraryEnabled,
  })
  const syncAccounts = useQuery({
    queryKey: ["sync-accounts"],
    queryFn: ({ signal }) => listSyncAccounts(signal),
    enabled: libraryEnabled,
    refetchInterval: 30_000,
  })
  const availableSyncProviders = useMemo(() => {
    const providers = new Map<SyncProviderID, SyncProvider>()
    for (const provider of BUILT_IN_CLOUD_PROVIDERS) providers.set(provider.id, provider)
    for (const provider of syncProviders.data?.items ?? []) providers.set(provider.id, provider)
    return Array.from(providers.values())
  }, [syncProviders.data?.items])
  const aiProviders = useQuery({
    queryKey: ["ai-providers"],
    queryFn: ({ signal }) => listAIProviders(signal),
    enabled: libraryEnabled,
  })
  const aiProfiles = useQuery({
    queryKey: ["ai-profiles"],
    queryFn: ({ signal }) => listAIProfiles(signal),
    enabled: libraryEnabled,
  })
  const aiUsage = useQuery({
    queryKey: ["ai-usage"],
    queryFn: ({ signal }) => getAIUsage(signal),
    enabled: libraryEnabled,
  })
  const aiLanguage = locale === "zh-CN" ? "Chinese" : "English"
  const entriesQuery = useInfiniteQuery({
    queryKey: ["entries", scope, deferredSearch, aiLanguage],
    queryFn: ({ pageParam, signal }) =>
      listEntries(
        { scope, query: deferredSearch, cursor: pageParam ?? undefined, aiLanguage },
        signal,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: libraryEnabled,
  })
  const entries = useMemo(
    () => entriesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [entriesQuery.data],
  )
  const selectedEntry = entries.find((entry) => entry.id === selectedEntryID) ?? null
  const entryDetail = useQuery({
    queryKey: ["entry", selectedEntryID, aiLanguage],
    queryFn: ({ signal }) => getEntry(selectedEntryID!, aiLanguage, signal),
    enabled: selectedEntryID !== null,
  })

  const invalidateLibrary = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["entries"] }),
      queryClient.invalidateQueries({ queryKey: ["entry"] }),
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
    ])
  }, [queryClient])
  const stateMutation = useMutation({
    mutationFn: async ({ entry, patch }: { entry: Entry; patch: Partial<EntryState> }) => {
      const mutationID = crypto.randomUUID()
      const deviceTime = new Date().toISOString()
      try {
        return await updateEntryState(entry.id, patch, mutationID)
      } catch (error) {
        if (error instanceof APIError) throw error
        await enqueueStateMutation({
          mutationID,
          entryID: entry.id,
          patch,
          deviceTime,
          createdAt: Date.now(),
        })
        return { ...entry.state, ...patch, updated_at: deviceTime }
      }
    },
    onSuccess: invalidateLibrary,
  })
  const tagMutation = useMutation({
    mutationFn: ({ entryID, tagIDs }: { entryID: string; tagIDs: string[] }) =>
      setEntryTags(entryID, tagIDs),
    onSuccess: invalidateLibrary,
  })
  const mutateEntryState = stateMutation.mutate
  const markReadMutation = useMutation({
    mutationFn: () => markEntriesRead(scope),
    onSuccess: invalidateLibrary,
  })
  const refreshMutation = useMutation({
    mutationFn: (feedID: string) => refreshFeed(feedID),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
  })
  const markFeedReadMutation = useMutation({
    mutationFn: (feedID: string) => markEntriesRead({ kind: "feed", id: feedID, title: "" }),
    onSuccess: invalidateLibrary,
  })
  const feedUpdateMutation = useMutation({
    mutationFn: ({
      feedID,
      folderID,
      viewMode,
      refreshPolicy,
      refreshIntervalMinutes,
    }: {
      feedID: string
      folderID?: string | null
      viewMode?: import("../api/types").ViewMode
      refreshPolicy?: import("../api/types").Subscription["refresh_policy"]
      refreshIntervalMinutes?: number
    }) =>
      updateFeed(feedID, {
        ...(folderID !== undefined ? { folder_id: folderID } : {}),
        ...(viewMode !== undefined ? { view_mode: viewMode } : {}),
        ...(refreshPolicy !== undefined ? { refresh_policy: refreshPolicy } : {}),
        ...(refreshIntervalMinutes !== undefined
          ? { refresh_interval_minutes: refreshIntervalMinutes }
          : {}),
      }),
    onSuccess: invalidateLibrary,
  })
  const feedDeleteMutation = useMutation({
    mutationFn: deleteFeed,
    onSuccess: invalidateLibrary,
  })
  const readabilityMutation = useMutation({
    mutationFn: (entryID: string) => fetchReadability(entryID),
  })
  const addMutation = useMutation({
    mutationFn: ({ url, folderID }: { url: string; folderID?: string }) =>
      addFeed({ url, folder_id: folderID ?? null }),
    onSuccess: async (feed) => {
      setAddOpen(false)
      setScope({ kind: "feed", id: feed.id, title: feed.title })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
        queryClient.invalidateQueries({ queryKey: ["folders"] }),
        queryClient.invalidateQueries({ queryKey: ["entries"] }),
      ])
    },
  })
  const importMutation = useMutation({
    mutationFn: importOPML,
    onSuccess: async () => {
      setAddOpen(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
        queryClient.invalidateQueries({ queryKey: ["folders"] }),
      ])
    },
  })
  const restoreMutation = useMutation({
    mutationFn: restoreBackup,
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      setPreferencesOpen(false)
    },
  })
  const pairMutation = useMutation({
    mutationFn: ({ code, name, platform }: Parameters<typeof pairDevice>[0]) =>
      pairDevice({ code, name, platform }),
    onSuccess: async () => {
      await status.refetch()
      await queryClient.invalidateQueries()
    },
  })
  const pairingCodeMutation = useMutation({ mutationFn: createPairingCode })
  const revokeDeviceMutation = useMutation({
    mutationFn: revokeDevice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["devices"] }),
  })
  const createSyncMutation = useMutation({
    mutationFn: createSyncAccount,
    onSuccess: async () => {
      setSyncAccountOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["sync-accounts"] })
    },
  })
  const toggleSyncMutation = useMutation({
    mutationFn: ({ accountID, enabled }: { accountID: string; enabled: boolean }) =>
      updateSyncAccount(accountID, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sync-accounts"] }),
  })
  const runSyncMutation = useMutation({
    mutationFn: ({ accountID, mode }: { accountID: string; mode: "auto" | "push" | "pull" }) =>
      runSyncAccount(accountID, mode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sync-accounts"] }),
  })
  const deleteSyncMutation = useMutation({
    mutationFn: deleteSyncAccount,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sync-accounts"] }),
  })
  const createFolderMutation = useMutation({
    mutationFn: createFolder,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["folders"] }),
  })
  const deleteFolderMutation = useMutation({
    mutationFn: deleteFolder,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["folders"] }),
        queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
      ])
    },
  })
  const createTagMutation = useMutation({
    mutationFn: createTag,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
  })
  const deleteTagMutation = useMutation({
    mutationFn: deleteTag,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
  })
  const createRuleMutation = useMutation({
    mutationFn: createRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rules"] }),
  })
  const deleteRuleMutation = useMutation({
    mutationFn: deleteRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rules"] }),
  })
  const createSavedFilterMutation = useMutation({
    mutationFn: createSavedFilter,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-filters"] }),
  })
  const deleteSavedFilterMutation = useMutation({
    mutationFn: deleteSavedFilter,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-filters"] }),
  })
  const createAIProfileMutation = useMutation({
    mutationFn: createAIProfile,
    onSuccess: async () => {
      setAIProfileOpen(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ai-profiles"] }),
        queryClient.invalidateQueries({ queryKey: ["ai-usage"] }),
      ])
    },
  })
  const toggleAIProfileMutation = useMutation({
    mutationFn: ({ profileID, enabled }: { profileID: string; enabled: boolean }) =>
      updateAIProfile(profileID, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-profiles"] }),
  })
  const defaultAIProfileMutation = useMutation({
    mutationFn: (profileID: string) => updateAIProfile(profileID, { is_default: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-profiles"] }),
  })
  const deleteAIProfileMutation = useMutation({
    mutationFn: deleteAIProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-profiles"] }),
  })

  const mutateState = useCallback(
    (entry: Entry, patch: Partial<EntryState>) => {
      mutateEntryState({ entry, patch })
    },
    [mutateEntryState],
  )

  useEffect(() => {
    if (!libraryEnabled || !("EventSource" in window)) return
    const source = new EventSource("/api/v1/events")
    const refresh = () => void invalidateLibrary()
    const subscriptionRefresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
      void queryClient.invalidateQueries({ queryKey: ["folders"] })
      void queryClient.invalidateQueries({ queryKey: ["entries"] })
    }
    for (const eventName of [
      "feed.updated",
      "entry.updated",
      "entry.state",
      "entry.bulk_state",
      "job.succeeded",
      "library.restored",
    ]) {
      source.addEventListener(eventName, refresh)
    }
    source.addEventListener("subscriptions.updated", subscriptionRefresh)
    source.addEventListener(
      "sync.completed",
      () => void queryClient.invalidateQueries({ queryKey: ["sync-accounts"] }),
    )
    const aiRefresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["ai-results"] })
      void queryClient.invalidateQueries({ queryKey: ["entries"] })
      void queryClient.invalidateQueries({ queryKey: ["entry"] })
      void queryClient.invalidateQueries({ queryKey: ["ai-chat"] })
      void queryClient.invalidateQueries({ queryKey: ["ai-profiles"] })
      void queryClient.invalidateQueries({ queryKey: ["ai-usage"] })
    }
    source.addEventListener("ai.result", aiRefresh)
    source.addEventListener("ai.chat", aiRefresh)
    return () => source.close()
  }, [invalidateLibrary, libraryEnabled, queryClient])

  useEffect(() => {
    if (!online) return
    void flushMutationOutbox().then((completed) => {
      if (completed > 0) void invalidateLibrary()
    })
  }, [invalidateLibrary, online])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const chord = keyboardChord(event)
      if (chord === shortcuts.palette) {
        event.preventDefault()
        setCommandOpen((open) => !open)
        return
      }
      const target = event.target as HTMLElement | null
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return
      const currentIndex = entries.findIndex((entry) => entry.id === selectedEntryID)
      if (chord === shortcuts.search) {
        event.preventDefault()
        document.querySelector<HTMLInputElement>("#library-search")?.focus()
      } else if (chord === shortcuts.next && entries.length > 0) {
        event.preventDefault()
        selectEntry(entries[Math.min(entries.length - 1, currentIndex + 1)]?.id ?? entries[0]!.id)
      } else if (chord === shortcuts.previous && entries.length > 0) {
        event.preventDefault()
        selectEntry(entries[Math.max(0, currentIndex <= 0 ? 0 : currentIndex - 1)]!.id)
      } else if (event.key === "Escape") {
        closeMobileReader()
      } else if (chord === shortcuts.toggleStar && selectedEntry) {
        event.preventDefault()
        mutateState(selectedEntry, { is_starred: !selectedEntry.state.is_starred })
      } else if (chord === shortcuts.toggleRead && selectedEntry) {
        event.preventDefault()
        mutateState(selectedEntry, { is_read: !selectedEntry.state.is_read })
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    closeMobileReader,
    entries,
    mutateState,
    selectEntry,
    selectedEntry,
    selectedEntryID,
    shortcuts,
  ])

  return (
    <>
      <a className="skip-link" href="#main-content">
        {t("skipToContent")}
      </a>
      <main
        ref={shellRef}
        id="main-content"
        tabIndex={-1}
        style={shellStyle}
        className={mobileReaderOpen ? "app-shell app-shell--reader-open" : "app-shell"}
      >
        <Sidebar
          scope={scope}
          status={status}
          subscriptions={subscriptions.data?.items ?? []}
          folders={folders.data?.items ?? []}
          tags={tags.data?.items ?? []}
          savedFilters={savedFilters.data?.items ?? []}
          onScopeChange={setScope}
          onAdd={() => setAddOpen(true)}
          onOrganizeLibrary={() => {
            setOrganizationMode("folders")
            setOrganizationOpen(true)
          }}
          onMarkFeedRead={(feedID) => markFeedReadMutation.mutate(feedID)}
          onRefreshFeed={(feedID) => refreshMutation.mutate(feedID)}
          onMoveFeed={(feedID, folderID) => feedUpdateMutation.mutate({ feedID, folderID })}
          onDeleteFeed={(feedID) => {
            if (window.confirm(t("unsubscribeConfirmation"))) feedDeleteMutation.mutate(feedID)
          }}
          onChangeFeedView={(feedID, viewMode) => feedUpdateMutation.mutate({ feedID, viewMode })}
          onChangeFeedRefresh={(feedID, refreshPolicy, refreshIntervalMinutes) =>
            feedUpdateMutation.mutate({ feedID, refreshPolicy, refreshIntervalMinutes })
          }
        />
        <section className="workspace">
          <WorkspaceHeader
            scope={scope}
            search={search}
            searchShortcut={shortcuts.search}
            theme={theme}
            onSearchChange={setSearch}
            onThemeChange={setTheme}
            onPreferences={() => setPreferencesOpen(true)}
            onAdd={() => setAddOpen(true)}
          />
          <div className="workspace-body">
            <TimelinePane
              scope={scope}
              entries={entries}
              subscriptions={subscriptions.data?.items ?? []}
              selectedEntryID={selectedEntryID}
              viewMode={viewMode}
              isLoading={entriesQuery.isPending}
              isFetchingNext={entriesQuery.isFetchingNextPage}
              hasNextPage={entriesQuery.hasNextPage}
              error={entriesQuery.error}
              markReadPending={markReadMutation.isPending}
              refreshPending={refreshMutation.isPending}
              onScopeChange={setScope}
              onSelect={selectEntry}
              onAdd={() => setAddOpen(true)}
              onRetry={() => void entriesQuery.refetch()}
              onLoadMore={() => void entriesQuery.fetchNextPage()}
              onMarkAllRead={() => markReadMutation.mutate()}
              onRefresh={(feedID) => refreshMutation.mutate(feedID)}
              onToggleStar={(entry) => mutateState(entry, { is_starred: !entry.state.is_starred })}
            />
            {selectedEntryID === null ? (
              <ReaderPlaceholder label={t("reader")} message={t("selectArticle")} />
            ) : (
              <Suspense
                fallback={<ReaderPlaceholder label={t("reader")} message={t("loadingArticle")} />}
              >
                <ReaderPane
                  key={selectedEntryID}
                  summary={selectedEntry}
                  detail={entryDetail.data}
                  isLoading={entryDetail.isPending}
                  error={entryDetail.error}
                  mutationPending={stateMutation.isPending || tagMutation.isPending}
                  readabilityPending={readabilityMutation.isPending}
                  aiProfiles={aiProfiles.data?.items ?? []}
                  tags={tags.data?.items ?? []}
                  onBack={closeMobileReader}
                  onRetry={() => void entryDetail.refetch()}
                  onStateChange={mutateState}
                  onTagsChange={(entryID, tagIDs) => tagMutation.mutate({ entryID, tagIDs })}
                  onFetchReadability={(entryID) => readabilityMutation.mutate(entryID)}
                  onConfigureAI={() => setAIProfileOpen(true)}
                />
              </Suspense>
            )}
          </div>
        </section>
        <PaneDivider
          edge="sidebar"
          value={constrainedPaneLayout.sidebarWidth}
          min={SIDEBAR_MIN}
          max={sidebarMax}
          label={t("resizeSidebar")}
          onStart={startPaneResize}
          onDelta={(delta) => resizePane("sidebar", delta)}
          onEnd={finishPaneResize}
        />
        <PaneDivider
          edge="timeline"
          value={constrainedPaneLayout.timelineWidth}
          min={TIMELINE_MIN}
          max={timelineMax}
          label={t("resizeTimeline")}
          onStart={startPaneResize}
          onDelta={(delta) => resizePane("timeline", delta)}
          onEnd={finishPaneResize}
        />
        <MobileNav
          scope={scope}
          onScopeChange={setScope}
          onLibrary={() => setMobileLibraryOpen(true)}
        />
        <MobileLibraryDialog
          open={mobileLibraryOpen}
          scope={scope}
          folders={folders.data?.items ?? []}
          subscriptions={subscriptions.data?.items ?? []}
          tags={tags.data?.items ?? []}
          savedFilters={savedFilters.data?.items ?? []}
          onOpenChange={setMobileLibraryOpen}
          onScopeChange={setScope}
        />
        {!online && <div className="offline-banner">{t("offlineMode")}</div>}
        {addOpen && (
          <Suspense fallback={null}>
            <AddFeedDialog
              open
              folders={folders.data?.items ?? []}
              addPending={addMutation.isPending}
              importPending={importMutation.isPending}
              error={addMutation.error ?? importMutation.error}
              onOpenChange={setAddOpen}
              onAdd={(url, folderID) => addMutation.mutate({ url, folderID })}
              onImport={(file) => importMutation.mutate(file)}
            />
          </Suspense>
        )}
        {preferencesOpen && (
          <Suspense fallback={null}>
            <PreferencesDialog
              open={preferencesOpen}
              theme={theme}
              status={status.data}
              restorePending={restoreMutation.isPending}
              error={
                restoreMutation.error ??
                toggleSyncMutation.error ??
                runSyncMutation.error ??
                deleteSyncMutation.error ??
                toggleAIProfileMutation.error ??
                defaultAIProfileMutation.error ??
                deleteAIProfileMutation.error
              }
              devices={devices.data?.items ?? []}
              syncAccounts={syncAccounts.data?.items ?? []}
              syncPendingID={
                runSyncMutation.isPending ? runSyncMutation.variables?.accountID : undefined
              }
              aiProfiles={aiProfiles.data?.items ?? []}
              aiUsage={aiUsage.data}
              pairingCode={pairingCodeMutation.data}
              pairingCodePending={pairingCodeMutation.isPending}
              onOpenChange={setPreferencesOpen}
              onRestore={(file) => restoreMutation.mutate(file)}
              onCreatePairingCode={() => pairingCodeMutation.mutate()}
              onRevokeDevice={(deviceID) => revokeDeviceMutation.mutate(deviceID)}
              onAddSyncAccount={(provider) => {
                setPreferencesOpen(false)
                setSyncAccountProvider(provider)
                setSyncAccountOpen(true)
              }}
              onOrganizeLibrary={() => {
                setPreferencesOpen(false)
                setOrganizationMode("all")
                setOrganizationOpen(true)
              }}
              onToggleSyncAccount={(accountID, enabled) =>
                toggleSyncMutation.mutate({ accountID, enabled })
              }
              onRunSyncAccount={(accountID, mode) => runSyncMutation.mutate({ accountID, mode })}
              onDeleteSyncAccount={(accountID) => {
                if (window.confirm(t("deleteSyncConfirmation")))
                  deleteSyncMutation.mutate(accountID)
              }}
              onAddAIProfile={() => {
                setPreferencesOpen(false)
                setAIProfileOpen(true)
              }}
              onToggleAIProfile={(profileID, enabled) =>
                toggleAIProfileMutation.mutate({ profileID, enabled })
              }
              onDefaultAIProfile={(profileID) => defaultAIProfileMutation.mutate(profileID)}
              onDeleteAIProfile={(profileID) => {
                if (window.confirm(t("deleteAIConfirmation")))
                  deleteAIProfileMutation.mutate(profileID)
              }}
            />
          </Suspense>
        )}
        {commandOpen && (
          <Suspense fallback={null}>
            <CommandPalette
              open={commandOpen}
              shortcuts={shortcuts}
              onOpenChange={setCommandOpen}
              onScopeChange={setScope}
              onAdd={() => setAddOpen(true)}
              onPreferences={() => setPreferencesOpen(true)}
              onMarkAllRead={() => markReadMutation.mutate()}
              onFocusSearch={() =>
                document.querySelector<HTMLInputElement>("#library-search")?.focus()
              }
            />
          </Suspense>
        )}
        {status.data?.device_auth_required === true && !status.data.device_authenticated && (
          <Suspense fallback={null}>
            <PairDeviceDialog
              open
              pending={pairMutation.isPending}
              error={pairMutation.error}
              onPair={(code, name, platform) => pairMutation.mutate({ code, name, platform })}
            />
          </Suspense>
        )}
        {syncAccountOpen && (
          <Suspense fallback={null}>
            <SyncAccountDialog
              key={`${syncAccountProvider ?? "default"}-${syncAccountOpen ? "open" : "closed"}`}
              open
              providers={availableSyncProviders}
              initialProvider={syncAccountProvider}
              pending={createSyncMutation.isPending}
              error={createSyncMutation.error}
              onOpenChange={setSyncAccountOpen}
              onCreate={(input) => createSyncMutation.mutate(input)}
            />
          </Suspense>
        )}
        {aiProfileOpen && (
          <Suspense fallback={null}>
            <AIProfileDialog
              open
              providers={aiProviders.data?.items ?? []}
              pending={createAIProfileMutation.isPending}
              error={createAIProfileMutation.error}
              onOpenChange={setAIProfileOpen}
              onCreate={(input) => createAIProfileMutation.mutate(input)}
            />
          </Suspense>
        )}
        {organizationOpen && (
          <Suspense fallback={null}>
            <LibraryOrganizationDialog
              open
              mode={organizationMode}
              folders={folders.data?.items ?? []}
              tags={tags.data?.items ?? []}
              rules={rules.data?.items ?? []}
              savedFilters={savedFilters.data?.items ?? []}
              pending={
                createFolderMutation.isPending ||
                deleteFolderMutation.isPending ||
                createTagMutation.isPending ||
                deleteTagMutation.isPending ||
                createRuleMutation.isPending ||
                deleteRuleMutation.isPending ||
                createSavedFilterMutation.isPending ||
                deleteSavedFilterMutation.isPending
              }
              error={
                createFolderMutation.error ??
                deleteFolderMutation.error ??
                createTagMutation.error ??
                deleteTagMutation.error ??
                createRuleMutation.error ??
                deleteRuleMutation.error ??
                createSavedFilterMutation.error ??
                deleteSavedFilterMutation.error
              }
              onOpenChange={setOrganizationOpen}
              onCreateFolder={(input) => createFolderMutation.mutate(input)}
              onDeleteFolder={(folderID) => {
                if (window.confirm(t("deleteFolderConfirmation")))
                  deleteFolderMutation.mutate(folderID)
              }}
              onCreateTag={(input) => createTagMutation.mutate(input)}
              onDeleteTag={(tagID) => {
                if (window.confirm(t("deleteTagConfirmation"))) deleteTagMutation.mutate(tagID)
              }}
              onCreateRule={(input) => createRuleMutation.mutate(input)}
              onDeleteRule={(ruleID) => {
                if (window.confirm(t("deleteRuleConfirmation"))) deleteRuleMutation.mutate(ruleID)
              }}
              onCreateSavedFilter={(input) => createSavedFilterMutation.mutate(input)}
              onDeleteSavedFilter={(filterID) => {
                if (window.confirm(t("deleteFilterConfirmation")))
                  deleteSavedFilterMutation.mutate(filterID)
              }}
            />
          </Suspense>
        )}
      </main>
    </>
  )
}

function ReaderPlaceholder(props: { label: string; message: string }) {
  return (
    <article className="reader reader--placeholder" aria-label={props.label}>
      <div className="reader__placeholder">
        <span className="reader-placeholder-mark" aria-hidden="true" />
        <p>{props.message}</p>
      </div>
    </article>
  )
}

function minimumReaderWidth(viewportWidth: number) {
  return viewportWidth <= 1100 ? 360 : 390
}

function constrainPaneLayout(layout: PaneLayout, viewportWidth: number): PaneLayout {
  if (viewportWidth <= DESKTOP_BREAKPOINT) return layout
  let sidebarWidth = clamp(layout.sidebarWidth, SIDEBAR_MIN, SIDEBAR_MAX)
  let timelineWidth = clamp(layout.timelineWidth, TIMELINE_MIN, TIMELINE_MAX)
  let overflow = sidebarWidth + timelineWidth + minimumReaderWidth(viewportWidth) - viewportWidth
  if (overflow > 0) {
    const timelineReduction = Math.min(overflow, timelineWidth - TIMELINE_MIN)
    timelineWidth -= timelineReduction
    overflow -= timelineReduction
  }
  if (overflow > 0) sidebarWidth -= Math.min(overflow, sidebarWidth - SIDEBAR_MIN)
  return { sidebarWidth: Math.round(sidebarWidth), timelineWidth: Math.round(timelineWidth) }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function useOnlineState() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])
  return online
}
