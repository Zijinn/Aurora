import type {
  AIChatSession,
  AIOperation,
  AIProfile,
  AIProvider,
  AIProviderID,
  AIResult,
  AIUsage,
  EntryDetail,
  EntryPage,
  EntryState,
  Device,
  Feed,
  Folder,
  Job,
  LibraryScope,
  ListResponse,
  ServerStatus,
  Subscription,
  SyncAccount,
  SyncCredentials,
  SyncProvider,
  SyncProviderID,
  Rule,
  SavedFilter,
  Tag,
  ViewMode,
} from "./types"
import { entryDetailCacheKey, entryPageCacheKey, readCache, writeCache } from "../offline/database"

interface Problem {
  title?: string
  detail?: string
  code?: string
  request_id?: string
}

export class APIError extends Error {
  readonly status: number
  readonly code?: string
  readonly requestID?: string

  constructor(status: number, message: string, problem?: Problem) {
    super(message)
    this.name = "APIError"
    this.status = status
    this.code = problem?.code
    this.requestID = problem?.request_id
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set("Accept", "application/json")
  if (init.body && typeof init.body === "string") headers.set("Content-Type", "application/json")
  const token = localStorage.getItem("cairn-device-token")
  if (token) headers.set("Authorization", `Bearer ${token}`)
  const response = await fetch(path, { ...init, headers, credentials: "same-origin" })
  if (!response.ok) {
    let problem: Problem | undefined
    try {
      problem = (await response.json()) as Problem
    } catch {
      problem = undefined
    }
    throw new APIError(
      response.status,
      problem?.detail ?? problem?.title ?? `Request failed with status ${response.status}`,
      problem,
    )
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function pairDevice(input: {
  code: string
  name: string
  platform: Device["platform"]
}): Promise<Device> {
  const response = await request<{ device: Device; token: string }>("/api/v1/devices/pair", {
    method: "POST",
    body: JSON.stringify(input),
  })
  localStorage.setItem("cairn-device-token", response.token)
  return response.device
}

export function listDevices(signal?: AbortSignal): Promise<ListResponse<Device>> {
  return request<ListResponse<Device>>("/api/v1/devices", { signal })
}

export function createPairingCode(): Promise<{ code: string; expires_at: string }> {
  return request<{ code: string; expires_at: string }>("/api/v1/devices/pairing-code", {
    method: "POST",
  })
}

export function revokeDevice(deviceID: string): Promise<void> {
  return request<void>(`/api/v1/devices/${encodeURIComponent(deviceID)}`, { method: "DELETE" })
}

export interface CreateSyncAccountInput {
  provider: SyncProviderID
  name: string
  endpoint: string
  credentials: SyncCredentials
  enabled?: boolean
  allow_private_network: boolean
  sync_interval_minutes: number
}

export type UpdateSyncAccountInput = Partial<
  Pick<
    SyncAccount,
    "name" | "endpoint" | "enabled" | "allow_private_network" | "sync_interval_minutes"
  >
> & { credentials?: SyncCredentials }

export interface TestSyncConnectionInput {
  account_id?: string
  provider: SyncProviderID
  endpoint: string
  credentials: SyncCredentials
  allow_private_network: boolean
}

export interface SyncConnectionTestResult {
  ok: boolean
  endpoint: string
}

export function listSyncProviders(signal?: AbortSignal): Promise<ListResponse<SyncProvider>> {
  return request<ListResponse<SyncProvider>>("/api/v1/sync/providers", { signal })
}

export function listSyncAccounts(signal?: AbortSignal): Promise<ListResponse<SyncAccount>> {
  return request<ListResponse<SyncAccount>>("/api/v1/sync/accounts", { signal })
}

export function createSyncAccount(input: CreateSyncAccountInput): Promise<SyncAccount> {
  return request<SyncAccount>("/api/v1/sync/accounts", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateSyncAccount(
  accountID: string,
  patch: UpdateSyncAccountInput,
): Promise<SyncAccount> {
  return request<SyncAccount>(`/api/v1/sync/accounts/${encodeURIComponent(accountID)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export function testSyncConnection(
  input: TestSyncConnectionInput,
): Promise<SyncConnectionTestResult> {
  return request<SyncConnectionTestResult>("/api/v1/sync/accounts/test", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function deleteSyncAccount(accountID: string): Promise<void> {
  return request<void>(`/api/v1/sync/accounts/${encodeURIComponent(accountID)}`, {
    method: "DELETE",
  })
}

export function runSyncAccount(
  accountID: string,
  mode: "auto" | "push" | "pull" = "auto",
): Promise<Job> {
  return request<Job>(`/api/v1/sync/accounts/${encodeURIComponent(accountID)}/sync?mode=${mode}`, {
    method: "POST",
  })
}

export interface CreateAIProfileInput {
  provider: AIProviderID
  name: string
  endpoint: string
  model: string
  api_key: string
  settings: { temperature?: number }
  allow_private_network: boolean
  remote_content_approved: boolean
  is_default: boolean
}

export interface AIStartResponse {
  cached: boolean
  result?: AIResult
  job?: Job
}

export function listAIProviders(signal?: AbortSignal): Promise<ListResponse<AIProvider>> {
  return request<ListResponse<AIProvider>>("/api/v1/ai/providers", { signal })
}

export function listAIProfiles(signal?: AbortSignal): Promise<ListResponse<AIProfile>> {
  return request<ListResponse<AIProfile>>("/api/v1/ai/profiles", { signal })
}

export function createAIProfile(input: CreateAIProfileInput): Promise<AIProfile> {
  return request<AIProfile>("/api/v1/ai/profiles", { method: "POST", body: JSON.stringify(input) })
}

export function updateAIProfile(
  profileID: string,
  patch: Partial<
    Pick<
      AIProfile,
      | "name"
      | "endpoint"
      | "model"
      | "enabled"
      | "allow_private_network"
      | "remote_content_approved"
      | "is_default"
    >
  > & { api_key?: string; settings?: { temperature?: number } },
): Promise<AIProfile> {
  return request<AIProfile>(`/api/v1/ai/profiles/${encodeURIComponent(profileID)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export function deleteAIProfile(profileID: string): Promise<void> {
  return request<void>(`/api/v1/ai/profiles/${encodeURIComponent(profileID)}`, { method: "DELETE" })
}

export function getAIUsage(signal?: AbortSignal): Promise<AIUsage> {
  return request<AIUsage>("/api/v1/ai/usage", { signal })
}

export function listAIResults(
  entryID: string,
  signal?: AbortSignal,
): Promise<ListResponse<AIResult>> {
  return request<ListResponse<AIResult>>(
    `/api/v1/entries/${encodeURIComponent(entryID)}/ai-results`,
    { signal },
  )
}

export function runAIOperation(
  entryID: string,
  operation: AIOperation,
  profileID: string,
  language: string,
): Promise<AIStartResponse> {
  const pathOperation = operation === "key_points" ? "key-points" : operation
  return request<AIStartResponse>(
    `/api/v1/entries/${encodeURIComponent(entryID)}/ai/${pathOperation}`,
    {
      method: "POST",
      body: JSON.stringify({ profile_id: profileID, language }),
    },
  )
}

export function startAIChat(
  entryID: string,
  profileID: string,
  sessionID: string | undefined,
  message: string,
): Promise<{ job: Job; session: AIChatSession }> {
  return request<{ job: Job; session: AIChatSession }>(
    `/api/v1/entries/${encodeURIComponent(entryID)}/ai-chat`,
    {
      method: "POST",
      body: JSON.stringify({ profile_id: profileID, session_id: sessionID, message }),
    },
  )
}

export function getAIChat(sessionID: string, signal?: AbortSignal): Promise<AIChatSession> {
  return request<AIChatSession>(`/api/v1/ai/chats/${encodeURIComponent(sessionID)}`, { signal })
}

export function getJob(jobID: string, signal?: AbortSignal): Promise<Job> {
  return request<Job>(`/api/v1/jobs/${encodeURIComponent(jobID)}`, { signal })
}

export function cancelJob(jobID: string): Promise<Job> {
  return request<Job>(`/api/v1/jobs/${encodeURIComponent(jobID)}/cancel`, { method: "POST" })
}

export function getServerStatus(signal?: AbortSignal): Promise<ServerStatus> {
  return request<ServerStatus>("/api/v1/status", { signal })
}

export function listSubscriptions(signal?: AbortSignal): Promise<ListResponse<Subscription>> {
  return request<ListResponse<Subscription>>("/api/v1/subscriptions", { signal })
}

export function listFolders(signal?: AbortSignal): Promise<ListResponse<Folder>> {
  return request<ListResponse<Folder>>("/api/v1/folders", { signal })
}

export function createFolder(input: { name: string; parent_id?: string | null }): Promise<Folder> {
  return request<Folder>("/api/v1/folders", { method: "POST", body: JSON.stringify(input) })
}

export function updateFolder(
  folderID: string,
  patch: { name?: string; parent_id?: string | null; position?: number },
): Promise<Folder> {
  return request<Folder>(`/api/v1/folders/${encodeURIComponent(folderID)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export function deleteFolder(folderID: string): Promise<void> {
  return request<void>(`/api/v1/folders/${encodeURIComponent(folderID)}`, { method: "DELETE" })
}

export function listTags(signal?: AbortSignal): Promise<ListResponse<Tag>> {
  return request<ListResponse<Tag>>("/api/v1/tags", { signal })
}

export function createTag(input: { name: string; color?: string | null }): Promise<Tag> {
  return request<Tag>("/api/v1/tags", { method: "POST", body: JSON.stringify(input) })
}

export function deleteTag(tagID: string): Promise<void> {
  return request<void>(`/api/v1/tags/${encodeURIComponent(tagID)}`, { method: "DELETE" })
}

export function listRules(signal?: AbortSignal): Promise<ListResponse<Rule>> {
  return request<ListResponse<Rule>>("/api/v1/rules", { signal })
}

export function createRule(input: {
  name: string
  enabled?: boolean
  priority?: number
  conditions: Record<string, unknown>
  actions: Record<string, unknown>
}): Promise<Rule> {
  return request<Rule>("/api/v1/rules", { method: "POST", body: JSON.stringify(input) })
}

export function deleteRule(ruleID: string): Promise<void> {
  return request<void>(`/api/v1/rules/${encodeURIComponent(ruleID)}`, { method: "DELETE" })
}

export function listSavedFilters(signal?: AbortSignal): Promise<ListResponse<SavedFilter>> {
  return request<ListResponse<SavedFilter>>("/api/v1/saved-filters", { signal })
}

export function createSavedFilter(input: {
  name: string
  query: Record<string, unknown>
}): Promise<SavedFilter> {
  return request<SavedFilter>("/api/v1/saved-filters", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function deleteSavedFilter(filterID: string): Promise<void> {
  return request<void>(`/api/v1/saved-filters/${encodeURIComponent(filterID)}`, {
    method: "DELETE",
  })
}

export interface EntryQuery {
  scope: LibraryScope
  query: string
  cursor?: string
  limit?: number
  aiLanguage?: string
}

export function listEntries(input: EntryQuery, signal?: AbortSignal): Promise<EntryPage> {
  const params = new URLSearchParams({ limit: String(input.limit ?? 30) })
  if (input.cursor) params.set("cursor", input.cursor)
  const scopeFilters = libraryScopeFilters(input.scope)
  for (const [key, value] of Object.entries(scopeFilters)) params.set(key, value)
  if (input.query.trim()) params.set("query", input.query.trim())
  if (input.aiLanguage) params.set("ai_language", input.aiLanguage)
  const cacheKey = entryPageCacheKey(
    JSON.stringify(input.scope),
    input.query,
    input.cursor,
    input.aiLanguage,
  )
  return request<EntryPage>(`/api/v1/entries?${params.toString()}`, { signal })
    .then((page) => {
      void writeCache(cacheKey, page)
      return page
    })
    .catch(async (error: unknown) => {
      if (error instanceof APIError) throw error
      const cached = await readCache<EntryPage>(cacheKey)
      if (cached) return cached
      throw error
    })
}

export async function getEntry(
  entryID: string,
  aiLanguage: string,
  signal?: AbortSignal,
): Promise<EntryDetail> {
  const cacheKey = entryDetailCacheKey(entryID, aiLanguage)
  try {
    const params = new URLSearchParams({ ai_language: aiLanguage })
    const entry = await request<EntryDetail>(
      `/api/v1/entries/${encodeURIComponent(entryID)}?${params.toString()}`,
      { signal },
    )
    void writeCache(cacheKey, entry)
    return entry
  } catch (error) {
    if (error instanceof APIError) throw error
    const cached = await readCache<EntryDetail>(cacheKey)
    if (cached) return cached
    throw error
  }
}

export function updateEntryState(
  entryID: string,
  patch: Partial<Pick<EntryState, "is_read" | "is_starred" | "is_read_later">>,
  mutationID = crypto.randomUUID(),
): Promise<EntryState> {
  return request<EntryState>(`/api/v1/entries/${encodeURIComponent(entryID)}/state`, {
    method: "PATCH",
    body: JSON.stringify({
      mutation_id: mutationID,
      device_time: new Date().toISOString(),
      ...patch,
    }),
  })
}

export function setEntryTags(entryID: string, tagIDs: string[]): Promise<{ tag_ids: string[] }> {
  return request<{ tag_ids: string[] }>(`/api/v1/entries/${encodeURIComponent(entryID)}/tags`, {
    method: "PUT",
    body: JSON.stringify({ tag_ids: tagIDs }),
  })
}

export function addFeed(input: { url: string; folder_id?: string | null }): Promise<Feed> {
  return request<Feed>("/api/v1/feeds", { method: "POST", body: JSON.stringify(input) })
}

export function deleteFeed(feedID: string): Promise<void> {
  return request<void>(`/api/v1/feeds/${encodeURIComponent(feedID)}`, { method: "DELETE" })
}

export function refreshFeed(feedID: string): Promise<Job> {
  return request<Job>(`/api/v1/feeds/${encodeURIComponent(feedID)}/refresh`, { method: "POST" })
}

export function fetchReadability(entryID: string): Promise<Job> {
  return request<Job>(`/api/v1/entries/${encodeURIComponent(entryID)}/readability`, {
    method: "POST",
  })
}

export function updateFeed(
  feedID: string,
  patch: {
    folder_id?: string | null
    title_override?: string | null
    view_mode?: ViewMode
    refresh_policy?: Subscription["refresh_policy"]
    refresh_interval_minutes?: number
    position?: number
  },
): Promise<Subscription> {
  return request<Subscription>(`/api/v1/feeds/${encodeURIComponent(feedID)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
}

export function markEntriesRead(scope: LibraryScope): Promise<{ updated: number }> {
  return request<{ updated: number }>("/api/v1/entries/mark-read", {
    method: "POST",
    body: JSON.stringify(libraryScopeFilters(scope)),
  })
}

function libraryScopeFilters(scope: LibraryScope): Record<string, string> {
  switch (scope.kind) {
    case "today":
      return { since: startOfToday().toISOString() }
    case "unread":
      return { state: "unread" }
    case "saved":
      return { state: "starred" }
    case "feed":
      return { feed_id: scope.id }
    case "folder":
      return { folder_id: scope.id }
    case "tag":
      return { tag_id: scope.id }
    case "filter": {
      const filters: Record<string, string> = {}
      for (const key of ["feed_id", "folder_id", "tag_id", "query", "since"] as const) {
        const value = scope.query[key]
        if (typeof value === "string" && value.trim()) filters[key] = value.trim()
      }
      const state = scope.query.state
      if (state === "all" || state === "unread" || state === "starred" || state === "read_later")
        filters.state = state
      return filters
    }
    case "all":
      return {}
  }
}

export async function importOPML(file: File): Promise<Job> {
  const headers = new Headers({ "Content-Type": "application/xml; charset=utf-8" })
  const token = localStorage.getItem("cairn-device-token")
  if (token) headers.set("Authorization", `Bearer ${token}`)
  const body = await file.text()
  const response = await fetch("/api/v1/imports/opml", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body,
  })
  if (!response.ok) {
    const problem = (await response.json().catch(() => undefined)) as Problem | undefined
    throw new APIError(response.status, problem?.detail ?? "OPML import failed", problem)
  }
  return (await response.json()) as Job
}

export async function restoreBackup(file: File): Promise<void> {
  const headers = new Headers({ "Content-Type": "application/json" })
  const token = localStorage.getItem("cairn-device-token")
  if (token) headers.set("Authorization", `Bearer ${token}`)
  const body = await file.text()
  const response = await fetch("/api/v1/restore", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body,
  })
  if (!response.ok) {
    const problem = (await response.json().catch(() => undefined)) as Problem | undefined
    throw new APIError(response.status, problem?.detail ?? "Backup restore failed", problem)
  }
}

export function startOfToday(): Date {
  const value = new Date()
  value.setHours(0, 0, 0, 0)
  return value
}
