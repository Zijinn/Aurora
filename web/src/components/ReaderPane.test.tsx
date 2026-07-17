import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

import type { EntryDetail, Tag } from "../api/types"
import { ReaderPane } from "./ReaderPane"

const detail: EntryDetail = {
  id: "entry-1",
  feed_id: "feed-1",
  feed_title: "Cairn Notes",
  canonical_url: "https://example.com/entry",
  title: "A tagged article",
  author: null,
  summary: null,
  published_at: "2026-07-17T00:00:00Z",
  discovered_at: "2026-07-17T00:00:00Z",
  lead_image_url: null,
  tag_ids: ["tag-important"],
  state: { is_read: true, is_starred: false, is_read_later: false, updated_at: "2026-07-17T00:00:00Z" },
  sanitized_html: "<p>Article body</p>",
  readability_html: null,
}

const tags: Tag[] = [
  { id: "tag-important", name: "Important", color: "#b3413a", position: 0, created_at: "2026-07-17T00:00:00Z" },
  { id: "tag-research", name: "Research", color: "#167a72", position: 1, created_at: "2026-07-17T00:00:00Z" },
]

it("shows and updates article tags", () => {
  const onTagsChange = vi.fn()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ReaderPane
        summary={detail}
        detail={detail}
        isLoading={false}
        error={null}
        mutationPending={false}
        readabilityPending={false}
        aiProfiles={[]}
        tags={tags}
        onBack={vi.fn()}
        onRetry={vi.fn()}
        onStateChange={vi.fn()}
        onTagsChange={onTagsChange}
        onFetchReadability={vi.fn()}
        onConfigureAI={vi.fn()}
      />
    </QueryClientProvider>,
  )

  fireEvent.click(screen.getByRole("button", { name: "Edit article tags" }))
  expect(screen.getByRole("checkbox", { name: "Important" })).toBeChecked()
  fireEvent.click(screen.getByRole("checkbox", { name: "Research" }))
  expect(onTagsChange).toHaveBeenCalledWith("entry-1", ["tag-important", "tag-research"])
})
