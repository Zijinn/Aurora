import { afterEach, describe, expect, it, vi } from "vitest"

import { importOPML, restoreBackup } from "./client"

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe("desktop file uploads", () => {
  it("sends OPML as text instead of a File body", async () => {
    const source = `<?xml version="1.0"?><opml version="2.0"><body><outline text="Feed" xmlUrl="https://example.com/feed.xml" /></body></opml>`
    const readText = vi.fn().mockResolvedValue(source)
    const file = { text: readText } as unknown as File
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "job-1",
          kind: "opml.import",
          state: "queued",
          progress_current: 0,
          progress_total: 0,
        }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      ),
    )

    await importOPML(file)

    expect(readText).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/imports/opml",
      expect.objectContaining({ body: source }),
    )
  })

  it("sends a backup as text instead of a File body", async () => {
    const source = JSON.stringify({ format: "aurora-backup" })
    const readText = vi.fn().mockResolvedValue(source)
    const file = { text: readText } as unknown as File
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }))

    await restoreBackup(file)

    expect(readText).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/restore",
      expect.objectContaining({ body: source }),
    )
  })
})
