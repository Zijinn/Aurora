import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import type { EntryDetail, Tag } from "../api/types"
import { useReaderStore } from "../store/reader"
import { ReaderPane } from "./ReaderPane"

afterEach(() => cleanup())

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
  state: {
    is_read: true,
    is_starred: false,
    is_read_later: false,
    updated_at: "2026-07-17T00:00:00Z",
  },
  sanitized_html: "<p>Article body</p>",
  readability_html: null,
}

const tags: Tag[] = [
  {
    id: "tag-important",
    name: "Important",
    color: "#b3413a",
    position: 0,
    created_at: "2026-07-17T00:00:00Z",
  },
  {
    id: "tag-research",
    name: "Research",
    color: "#167a72",
    position: 1,
    created_at: "2026-07-17T00:00:00Z",
  },
]

it("shows and updates article tags", () => {
  useReaderStore.setState({
    locale: "en-US",
    theme: "system",
    readerAppearance: { fontFamily: "serif", fontSize: 19, lineHeight: 1.8 },
    annotations: [],
  })
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

it("shows cached AI title translation and summary in the reading header", () => {
  useReaderStore.setState({
    locale: "en-US",
    theme: "system",
    readerAppearance: { fontFamily: "serif", fontSize: 19, lineHeight: 1.8 },
    annotations: [],
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ReaderPane
        summary={{
          ...detail,
          ai_translated_title: "一篇带标签的文章",
          ai_summary: "这是缓存的 AI 摘要。",
        }}
        detail={{
          ...detail,
          ai_translated_title: "一篇带标签的文章",
          ai_summary: "这是缓存的 AI 摘要。",
        }}
        isLoading={false}
        error={null}
        mutationPending={false}
        readabilityPending={false}
        aiProfiles={[]}
        tags={[]}
        onBack={vi.fn()}
        onRetry={vi.fn()}
        onStateChange={vi.fn()}
        onTagsChange={vi.fn()}
        onFetchReadability={vi.fn()}
        onConfigureAI={vi.fn()}
      />
    </QueryClientProvider>,
  )
  expect(screen.getByText("一篇带标签的文章")).toBeInTheDocument()
  expect(screen.getByText("AI summary")).toBeInTheDocument()
  expect(screen.getByText("这是缓存的 AI 摘要。")).toBeInTheDocument()
})

it("adjusts reading typography from the right-side inspector", () => {
  useReaderStore.setState({
    locale: "en-US",
    theme: "system",
    readerAppearance: { fontFamily: "serif", fontSize: 19, lineHeight: 1.8 },
    annotations: [],
  })
  renderReader()

  fireEvent.click(screen.getByRole("button", { name: "Reading appearance" }))
  fireEvent.click(screen.getByRole("button", { name: "Sans serif" }))
  fireEvent.change(screen.getByRole("slider", { name: "Text size" }), {
    target: { value: "22" },
  })

  expect(useReaderStore.getState().readerAppearance).toMatchObject({
    fontFamily: "sans",
    fontSize: 22,
  })
  expect(screen.getByRole("article", { name: "Reader" })).toHaveStyle({
    "--reader-content-size": "22px",
  })
})

it("restores saved highlights and notes for the current article", async () => {
  useReaderStore.setState({
    locale: "en-US",
    theme: "system",
    readerAppearance: { fontFamily: "serif", fontSize: 19, lineHeight: 1.8 },
    annotations: [
      {
        id: "annotation-1",
        entryID: detail.id,
        quote: "Article body",
        prefix: "",
        suffix: "",
        style: "highlight",
        note: "Return to this idea",
        createdAt: "2026-07-18T00:00:00Z",
      },
    ],
  })
  renderReader()

  await waitFor(() =>
    expect(document.querySelector(".reader-annotation--highlight")).toHaveTextContent(
      "Article body",
    ),
  )
  expect(document.querySelector(".reader-annotation--highlight")).toHaveAttribute(
    "title",
    "Return to this idea",
  )
})

it("creates a persistent highlight from selected article text", async () => {
  useReaderStore.setState({
    locale: "en-US",
    theme: "system",
    readerAppearance: { fontFamily: "serif", fontSize: 19, lineHeight: 1.8 },
    annotations: [],
  })
  renderReader()

  const paragraph = screen.getByText("Article body")
  const text = paragraph.firstChild
  expect(text).not.toBeNull()
  const range = document.createRange()
  range.setStart(text!, 0)
  range.setEnd(text!, 7)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  fireEvent.pointerUp(paragraph)

  fireEvent.click(await screen.findByRole("button", { name: "Highlight" }))
  expect(useReaderStore.getState().annotations).toHaveLength(1)
  expect(useReaderStore.getState().annotations[0]).toMatchObject({
    entryID: detail.id,
    quote: "Article",
    style: "highlight",
  })
  await waitFor(() =>
    expect(document.querySelector(".reader-annotation--highlight")).toHaveTextContent("Article"),
  )
})

function renderReader() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ReaderPane
        summary={detail}
        detail={detail}
        isLoading={false}
        error={null}
        mutationPending={false}
        readabilityPending={false}
        aiProfiles={[]}
        tags={[]}
        onBack={vi.fn()}
        onRetry={vi.fn()}
        onStateChange={vi.fn()}
        onTagsChange={vi.fn()}
        onFetchReadability={vi.fn()}
        onConfigureAI={vi.fn()}
      />
    </QueryClientProvider>,
  )
}
