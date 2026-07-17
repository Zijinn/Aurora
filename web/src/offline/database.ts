import type { EntryPage, EntryState } from "../api/types"

const databaseName = "cairn-offline-v1"
const cacheStore = "cache"
const outboxStore = "outbox"
const maxCacheAge = 7 * 24 * 60 * 60 * 1000

interface CacheRecord<T = unknown> {
  key: string
  value: T
  updatedAt: number
}

export interface StateMutationRecord {
  mutationID: string
  entryID: string
  patch: Partial<Pick<EntryState, "is_read" | "is_starred" | "is_read_later">>
  deviceTime: string
  createdAt: number
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  const database = await openDatabase()
  if (!database) return
  await transactionPromise(database, cacheStore, "readwrite", (store) => store.put({ key, value, updatedAt: Date.now() } satisfies CacheRecord<T>))
}

export async function readCache<T>(key: string): Promise<T | undefined> {
  const database = await openDatabase()
  if (!database) return undefined
  const request = database.transaction(cacheStore).objectStore(cacheStore).get(key) as unknown as IDBRequest<CacheRecord<T> | undefined>
  const record = await requestPromise(request)
  if (!record || Date.now() - record.updatedAt > maxCacheAge) return undefined
  return record.value
}

export async function enqueueStateMutation(record: StateMutationRecord): Promise<void> {
  const database = await openDatabase()
  if (!database) throw new Error("Offline storage is unavailable")
  await transactionPromise(database, outboxStore, "readwrite", (store) => store.put(record))
  await updateCachedEntryState(database, record.entryID, record.patch, record.deviceTime)
}

export async function flushMutationOutbox(): Promise<number> {
  const database = await openDatabase()
  if (!database) return 0
  const request = database.transaction(outboxStore).objectStore(outboxStore).getAll() as unknown as IDBRequest<StateMutationRecord[]>
  const records = await requestPromise(request)
  records.sort((left, right) => left.createdAt - right.createdAt)
  let completed = 0
  for (const record of records) {
    let response: Response
    try {
      const headers = new Headers({ "Content-Type": "application/json", Accept: "application/json" })
      const token = localStorage.getItem("cairn-device-token")
      if (token) headers.set("Authorization", `Bearer ${token}`)
      response = await fetch(`/api/v1/entries/${encodeURIComponent(record.entryID)}/state`, {
        method: "PATCH",
        headers,
        credentials: "same-origin",
        body: JSON.stringify({
          mutation_id: record.mutationID,
          device_time: record.deviceTime,
          ...record.patch,
        }),
      })
    } catch {
      break
    }
    if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 401 && response.status !== 429)) {
      await transactionPromise(database, outboxStore, "readwrite", (store) => store.delete(record.mutationID))
      completed++
      continue
    }
    break
  }
  return completed
}

export function entryPageCacheKey(scopeKey: string, query: string, cursor?: string) {
  return `entries:${scopeKey}:${query.trim()}:${cursor ?? "first"}`
}

export function entryDetailCacheKey(entryID: string) {
  return `entry:${entryID}`
}

async function updateCachedEntryState(
  database: IDBDatabase,
  entryID: string,
  patch: StateMutationRecord["patch"],
  updatedAt: string,
) {
  const transaction = database.transaction(cacheStore, "readwrite")
  const store = transaction.objectStore(cacheStore)
  const request = store.getAll() as unknown as IDBRequest<Array<CacheRecord<EntryPage | Record<string, unknown>>>>
  const records = await requestPromise(request)
  for (const record of records) {
    if (record.key.startsWith("entries:")) {
      const page = record.value as EntryPage
      let changed = false
      page.items = page.items.map((entry) => {
        if (entry.id !== entryID) return entry
        changed = true
        return { ...entry, state: { ...entry.state, ...patch, updated_at: updatedAt } }
      })
      if (changed) store.put({ ...record, value: page, updatedAt: Date.now() })
    } else if (record.key === entryDetailCacheKey(entryID)) {
      const entry = record.value as { state?: EntryState }
      if (entry.state) store.put({ ...record, value: { ...entry, state: { ...entry.state, ...patch, updated_at: updatedAt } }, updatedAt: Date.now() })
    }
  }
  await transactionComplete(transaction)
}

let databasePromise: Promise<IDBDatabase | null> | undefined

function openDatabase(): Promise<IDBDatabase | null> {
  if (!("indexedDB" in globalThis)) return Promise.resolve(null)
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(cacheStore)) database.createObjectStore(cacheStore, { keyPath: "key" })
      if (!database.objectStoreNames.contains(outboxStore)) {
        const store = database.createObjectStore(outboxStore, { keyPath: "mutationID" })
        store.createIndex("createdAt", "createdAt")
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Could not open offline database"))
  })
  return databasePromise
}

function transactionPromise(database: IDBDatabase, storeName: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest) {
  const transaction = database.transaction(storeName, mode)
  operation(transaction.objectStore(storeName))
  return transactionComplete(transaction)
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error("Offline transaction failed"))
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline transaction aborted"))
  })
}

function requestPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Offline request failed"))
  })
}
