import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Folder, LibraryScope, Subscription } from "../api/types"
import { useReaderStore } from "../store/reader"
import { Sidebar } from "./Sidebar"

const folder: Folder = {
  id: "folder-1",
  parent_id: null,
  name: "Research",
  position: 0,
  created_at: "2026-07-21T00:00:00Z",
  updated_at: "2026-07-21T00:00:00Z",
}

const subscription: Subscription = {
  id: "subscription-1",
  feed_id: "feed-1",
  folder_id: "folder-1",
  position: 0,
  title: "Example feed",
  icon_url: null,
  feed_url: "https://example.com/feed.xml",
  site_url: "https://example.com",
  unread_count: 2,
  view_mode: "standard",
  refresh_policy: "inherit",
  refresh_interval_minutes: 0,
  hide_from_timeline: false,
  created_at: "2026-07-21T00:00:00Z",
  updated_at: "2026-07-21T00:00:00Z",
}

beforeEach(() => {
  useReaderStore.setState({ locale: "en-US", openFolders: { "folder-1": true } })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("Sidebar rename menus", () => {
  it("renames a subscription from its context menu", () => {
    const onRenameFeed = vi.fn()
    vi.spyOn(window, "prompt").mockReturnValue("Renamed feed")
    renderSidebar({ onRenameFeed })

    fireEvent.contextMenu(screen.getByRole("button", { name: "Example feed2" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }))

    expect(onRenameFeed).toHaveBeenCalledWith("feed-1", "Renamed feed")
  })

  it("renames a folder from its context menu", () => {
    const onRenameFolder = vi.fn()
    vi.spyOn(window, "prompt").mockReturnValue("Papers")
    renderSidebar({ onRenameFolder })

    fireEvent.contextMenu(screen.getByRole("button", { name: "Research2" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }))

    expect(onRenameFolder).toHaveBeenCalledWith("folder-1", "Papers")
  })
})

describe("Sidebar folder interactions", () => {
  it("toggles a folder when its main row is clicked", () => {
    const onScopeChange = vi.fn()
    renderSidebar({ onScopeChange })

    const folderRow = screen.getByRole("button", { name: "Research2" })
    expect(screen.getByRole("button", { name: "Example feed2" })).toBeInTheDocument()
    fireEvent.click(folderRow)

    expect(onScopeChange).toHaveBeenCalledWith({
      kind: "folder",
      id: "folder-1",
      title: "Research",
    })
    expect(screen.queryByRole("button", { name: "Example feed2" })).not.toBeInTheDocument()
    fireEvent.click(folderRow)
    expect(screen.getByRole("button", { name: "Example feed2" })).toBeInTheDocument()
  })
})

function renderSidebar(overrides: {
  onRenameFeed?: (feedID: string, name: string) => void
  onRenameFolder?: (folderID: string, name: string) => void
  onScopeChange?: (scope: LibraryScope) => void
}) {
  return render(
    <Sidebar
      scope={{ kind: "all", title: "All feeds" }}
      subscriptions={[subscription]}
      folders={[folder]}
      tags={[]}
      savedFilters={[]}
      onScopeChange={overrides.onScopeChange ?? vi.fn()}
      onAdd={vi.fn()}
      onOrganizeLibrary={vi.fn()}
      onMarkFeedRead={vi.fn()}
      onRefreshFeed={vi.fn()}
      onMoveFeed={vi.fn()}
      onRenameFeed={overrides.onRenameFeed ?? vi.fn()}
      onRenameFolder={overrides.onRenameFolder ?? vi.fn()}
      onMergeFeeds={vi.fn()}
      onReorderFolder={vi.fn()}
      onReorderFeed={vi.fn()}
      onDeleteFeed={vi.fn()}
      onChangeFeedView={vi.fn()}
      onChangeFeedRefresh={vi.fn()}
    />,
  )
}
