import "fake-indexeddb/auto"

import { afterEach, describe, expect, it, vi } from "vitest"

import type { EntryPage } from "../api/types"
import {
  enqueueStateMutation,
  entryPageCacheKey,
  flushMutationOutbox,
  readCache,
  writeCache,
} from "./database"

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe("offline reading database", () => {
  it("updates cached state and replays the mutation once", async () => {
    const key = entryPageCacheKey("today", "", undefined)
    const page: EntryPage = {
      next_cursor: null,
      items: [{
        id: "entry-1",
        feed_id: "feed-1",
        feed_title: "Feed",
        canonical_url: "https://example.com/one",
        title: "One",
        author: null,
        summary: null,
        published_at: "2026-07-17T00:00:00Z",
        discovered_at: "2026-07-17T00:00:00Z",
        lead_image_url: null,
        tag_ids: [],
        state: { is_read: false, is_starred: false, is_read_later: false, updated_at: "2026-07-17T00:00:00Z" },
      }],
    }
    await writeCache(key, page)
    await enqueueStateMutation({
      mutationID: "offline-mutation-1",
      entryID: "entry-1",
      patch: { is_starred: true },
      deviceTime: "2026-07-17T01:00:00Z",
      createdAt: 1,
    })
    const cached = await readCache<EntryPage>(key)
    expect(cached?.items[0]?.state.is_starred).toBe(true)

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }))
    expect(await flushMutationOutbox()).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const request = fetchMock.mock.calls[0]
    expect(request?.[0]).toBe("/api/v1/entries/entry-1/state")
    expect(request?.[1]?.body).toEqual(expect.stringContaining('"mutation_id":"offline-mutation-1"'))
    expect(await flushMutationOutbox()).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
