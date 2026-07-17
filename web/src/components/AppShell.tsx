import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react"

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
  updateSyncAccount,
} from "../api/client"
import type { Entry, EntryState } from "../api/types"
import { keyboardChord } from "../lib/shortcuts"
import { enqueueStateMutation, flushMutationOutbox } from "../offline/database"
import { useReaderStore } from "../store/reader"
import { AddFeedDialog } from "./AddFeedDialog"
import { AIProfileDialog } from "./AIProfileDialog"
import { PreferencesDialog } from "./PreferencesDialog"
import { ReaderPane } from "./ReaderPane"
import { Sidebar } from "./Sidebar"
import { TimelinePane } from "./TimelinePane"
import { MobileNav } from "./MobileNav"
import { MobileLibraryDialog } from "./MobileLibraryDialog"
import { CommandPalette } from "./CommandPalette"
import { PairDeviceDialog } from "./PairDeviceDialog"
import { SyncAccountDialog } from "./SyncAccountDialog"
import { LibraryOrganizationDialog } from "./LibraryOrganizationDialog"

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
  const deferredSearch = useDeferredValue(search)
  const [addOpen, setAddOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [syncAccountOpen, setSyncAccountOpen] = useState(false)
  const [aiProfileOpen, setAIProfileOpen] = useState(false)
  const [organizationOpen, setOrganizationOpen] = useState(false)
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false)
  const online = useOnlineState()

  const status = useQuery({
    queryKey: ["server-status"],
    queryFn: ({ signal }) => getServerStatus(signal),
    retry: 2,
    refetchInterval: 30_000,
  })
  const libraryEnabled = status.isSuccess && (!status.data.device_auth_required || status.data.device_authenticated)
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
  const entriesQuery = useInfiniteQuery({
    queryKey: ["entries", scope, deferredSearch],
    queryFn: ({ pageParam, signal }) =>
      listEntries({ scope, query: deferredSearch, cursor: pageParam ?? undefined }, signal),
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
    queryKey: ["entry", selectedEntryID],
    queryFn: ({ signal }) => getEntry(selectedEntryID!, signal),
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
        await enqueueStateMutation({ mutationID, entryID: entry.id, patch, deviceTime, createdAt: Date.now() })
        return { ...entry.state, ...patch, updated_at: deviceTime }
      }
    },
    onSuccess: invalidateLibrary,
  })
  const tagMutation = useMutation({
    mutationFn: ({ entryID, tagIDs }: { entryID: string; tagIDs: string[] }) => setEntryTags(entryID, tagIDs),
    onSuccess: invalidateLibrary,
  })
  const mutateEntryState = stateMutation.mutate
  const markReadMutation = useMutation({ mutationFn: () => markEntriesRead(scope), onSuccess: invalidateLibrary })
  const refreshMutation = useMutation({
    mutationFn: (feedID: string) => refreshFeed(feedID),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscriptions"] }),
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
    mutationFn: ({ code, name, platform }: Parameters<typeof pairDevice>[0]) => pairDevice({ code, name, platform }),
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
    mutationFn: ({ accountID, enabled }: { accountID: string; enabled: boolean }) => updateSyncAccount(accountID, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sync-accounts"] }),
  })
  const runSyncMutation = useMutation({
    mutationFn: runSyncAccount,
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
    mutationFn: ({ profileID, enabled }: { profileID: string; enabled: boolean }) => updateAIProfile(profileID, { enabled }),
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

  const mutateState = useCallback((entry: Entry, patch: Partial<EntryState>) => {
    mutateEntryState({ entry, patch })
  }, [mutateEntryState])

  useEffect(() => {
    if (!libraryEnabled || !("EventSource" in window)) return
    const source = new EventSource("/api/v1/events")
    const refresh = () => void invalidateLibrary()
    const subscriptionRefresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["subscriptions"] })
      void queryClient.invalidateQueries({ queryKey: ["folders"] })
      void queryClient.invalidateQueries({ queryKey: ["entries"] })
    }
    for (const eventName of ["feed.updated", "entry.updated", "entry.state", "entry.bulk_state", "job.succeeded", "library.restored"]) {
      source.addEventListener(eventName, refresh)
    }
    source.addEventListener("subscriptions.updated", subscriptionRefresh)
    source.addEventListener("sync.completed", () => void queryClient.invalidateQueries({ queryKey: ["sync-accounts"] }))
    const aiRefresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["ai-results"] })
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
  }, [closeMobileReader, entries, mutateState, selectEntry, selectedEntry, selectedEntryID, shortcuts])

  return (
    <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <main id="main-content" tabIndex={-1} className={mobileReaderOpen ? "app-shell app-shell--reader-open" : "app-shell"}>
      <Sidebar
        scope={scope}
        search={search}
        status={status}
        subscriptions={subscriptions.data?.items ?? []}
        folders={folders.data?.items ?? []}
        tags={tags.data?.items ?? []}
        savedFilters={savedFilters.data?.items ?? []}
        onScopeChange={setScope}
        onSearchChange={setSearch}
        onAdd={() => setAddOpen(true)}
        onPreferences={() => setPreferencesOpen(true)}
      />
      <TimelinePane
        scope={scope}
        entries={entries}
        selectedEntryID={selectedEntryID}
        viewMode={viewMode}
        isLoading={entriesQuery.isPending}
        isFetchingNext={entriesQuery.isFetchingNextPage}
        hasNextPage={entriesQuery.hasNextPage}
        error={entriesQuery.error}
        markReadPending={markReadMutation.isPending}
        refreshPending={refreshMutation.isPending}
        onSelect={selectEntry}
        onAdd={() => setAddOpen(true)}
        onRetry={() => void entriesQuery.refetch()}
        onLoadMore={() => void entriesQuery.fetchNextPage()}
        onMarkAllRead={() => markReadMutation.mutate()}
        onRefresh={(feedID) => refreshMutation.mutate(feedID)}
        onToggleStar={(entry) => mutateState(entry, { is_starred: !entry.state.is_starred })}
      />
      <ReaderPane
        key={selectedEntryID ?? "empty-reader"}
        summary={selectedEntry}
        detail={entryDetail.data}
        isLoading={entryDetail.isPending && selectedEntryID !== null}
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
      <MobileNav scope={scope} onScopeChange={setScope} onLibrary={() => setMobileLibraryOpen(true)} onPreferences={() => setPreferencesOpen(true)} />
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
      {!online && <div className="offline-banner">Offline mode</div>}
      <AddFeedDialog
        open={addOpen}
        folders={folders.data?.items ?? []}
        addPending={addMutation.isPending}
        importPending={importMutation.isPending}
        error={addMutation.error ?? importMutation.error}
        onOpenChange={setAddOpen}
        onAdd={(url, folderID) => addMutation.mutate({ url, folderID })}
        onImport={(file) => importMutation.mutate(file)}
      />
      <PreferencesDialog
        open={preferencesOpen}
        status={status.data}
        restorePending={restoreMutation.isPending}
        error={restoreMutation.error ?? toggleSyncMutation.error ?? runSyncMutation.error ?? deleteSyncMutation.error ?? toggleAIProfileMutation.error ?? defaultAIProfileMutation.error ?? deleteAIProfileMutation.error}
        devices={devices.data?.items ?? []}
        syncAccounts={syncAccounts.data?.items ?? []}
        syncPendingID={runSyncMutation.isPending ? runSyncMutation.variables : undefined}
        aiProfiles={aiProfiles.data?.items ?? []}
        aiUsage={aiUsage.data}
        pairingCode={pairingCodeMutation.data}
        pairingCodePending={pairingCodeMutation.isPending}
        onOpenChange={setPreferencesOpen}
        onRestore={(file) => restoreMutation.mutate(file)}
        onCreatePairingCode={() => pairingCodeMutation.mutate()}
        onRevokeDevice={(deviceID) => revokeDeviceMutation.mutate(deviceID)}
        onAddSyncAccount={() => {
          setPreferencesOpen(false)
          setSyncAccountOpen(true)
        }}
        onOrganizeLibrary={() => {
          setPreferencesOpen(false)
          setOrganizationOpen(true)
        }}
        onToggleSyncAccount={(accountID, enabled) => toggleSyncMutation.mutate({ accountID, enabled })}
        onRunSyncAccount={(accountID) => runSyncMutation.mutate(accountID)}
        onDeleteSyncAccount={(accountID) => {
          if (window.confirm("Delete this sync account?")) deleteSyncMutation.mutate(accountID)
        }}
        onAddAIProfile={() => {
          setPreferencesOpen(false)
          setAIProfileOpen(true)
        }}
        onToggleAIProfile={(profileID, enabled) => toggleAIProfileMutation.mutate({ profileID, enabled })}
        onDefaultAIProfile={(profileID) => defaultAIProfileMutation.mutate(profileID)}
        onDeleteAIProfile={(profileID) => {
          if (window.confirm("Delete this AI provider?")) deleteAIProfileMutation.mutate(profileID)
        }}
      />
      <CommandPalette
        open={commandOpen}
        shortcuts={shortcuts}
        onOpenChange={setCommandOpen}
        onScopeChange={setScope}
        onAdd={() => setAddOpen(true)}
        onPreferences={() => setPreferencesOpen(true)}
        onMarkAllRead={() => markReadMutation.mutate()}
        onFocusSearch={() => document.querySelector<HTMLInputElement>("#library-search")?.focus()}
      />
      <PairDeviceDialog
        open={status.data?.device_auth_required === true && !status.data.device_authenticated}
        pending={pairMutation.isPending}
        error={pairMutation.error}
        onPair={(code, name, platform) => pairMutation.mutate({ code, name, platform })}
      />
      <SyncAccountDialog
        open={syncAccountOpen}
        providers={syncProviders.data?.items ?? []}
        pending={createSyncMutation.isPending}
        error={createSyncMutation.error}
        onOpenChange={setSyncAccountOpen}
        onCreate={(input) => createSyncMutation.mutate(input)}
      />
      <AIProfileDialog
        open={aiProfileOpen}
        providers={aiProviders.data?.items ?? []}
        pending={createAIProfileMutation.isPending}
        error={createAIProfileMutation.error}
        onOpenChange={setAIProfileOpen}
        onCreate={(input) => createAIProfileMutation.mutate(input)}
      />
      <LibraryOrganizationDialog
        open={organizationOpen}
        folders={folders.data?.items ?? []}
        tags={tags.data?.items ?? []}
        rules={rules.data?.items ?? []}
        savedFilters={savedFilters.data?.items ?? []}
        pending={createFolderMutation.isPending || deleteFolderMutation.isPending || createTagMutation.isPending || deleteTagMutation.isPending || createRuleMutation.isPending || deleteRuleMutation.isPending || createSavedFilterMutation.isPending || deleteSavedFilterMutation.isPending}
        error={createFolderMutation.error ?? deleteFolderMutation.error ?? createTagMutation.error ?? deleteTagMutation.error ?? createRuleMutation.error ?? deleteRuleMutation.error ?? createSavedFilterMutation.error ?? deleteSavedFilterMutation.error}
        onOpenChange={setOrganizationOpen}
        onCreateFolder={(input) => createFolderMutation.mutate(input)}
        onDeleteFolder={(folderID) => {
          if (window.confirm("Delete this folder and unassign its subscriptions?")) deleteFolderMutation.mutate(folderID)
        }}
        onCreateTag={(input) => createTagMutation.mutate(input)}
        onDeleteTag={(tagID) => {
          if (window.confirm("Delete this tag?")) deleteTagMutation.mutate(tagID)
        }}
        onCreateRule={(input) => createRuleMutation.mutate(input)}
        onDeleteRule={(ruleID) => {
          if (window.confirm("Delete this automation rule?")) deleteRuleMutation.mutate(ruleID)
        }}
        onCreateSavedFilter={(input) => createSavedFilterMutation.mutate(input)}
        onDeleteSavedFilter={(filterID) => {
          if (window.confirm("Delete this saved filter?")) deleteSavedFilterMutation.mutate(filterID)
        }}
      />
    </main>
    </>
  )
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
