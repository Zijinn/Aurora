import {
  Books,
  CaretDown,
  CaretRight,
  Funnel,
  FolderOpen,
  FolderSimplePlus,
  Plus,
  Sparkle,
  Star,
  Tag as TagIcon,
  Tray,
} from "@phosphor-icons/react"
import { useState, type DragEvent, type MouseEvent, type ReactNode } from "react"

import type { Folder, LibraryScope, SavedFilter, Subscription, Tag, ViewMode } from "../api/types"
import { localizedScopeTitle, useTranslation } from "../lib/i18n"
import { useReaderStore } from "../store/reader"
import { Brand } from "./Brand"
import { FolderContextMenu } from "./FolderContextMenu"
import { SubscriptionContextMenu } from "./SubscriptionContextMenu"

interface SidebarProps {
  scope: LibraryScope
  subscriptions: Subscription[]
  folders: Folder[]
  tags: Tag[]
  savedFilters: SavedFilter[]
  onScopeChange: (scope: LibraryScope) => void
  onAdd: () => void
  onOrganizeLibrary: () => void
  onMarkFeedRead: (feedID: string) => void
  onRefreshFeed: (feedID: string) => void
  onMoveFeed: (feedID: string, folderID: string | null) => void
  onRenameFeed: (feedID: string, name: string) => void
  onRenameFolder: (folderID: string, name: string) => void
  onMergeFeeds: (feedID: string, targetFeedID: string) => void
  onReorderFolder: (folderID: string, targetID: string, before: boolean) => void
  onReorderFeed: (feedID: string, targetID: string, before: boolean) => void
  onDeleteFeed: (feedID: string) => void
  onChangeFeedView: (feedID: string, viewMode: ViewMode) => void
  onChangeFeedRefresh: (
    feedID: string,
    policy: Subscription["refresh_policy"],
    intervalMinutes: number,
  ) => void
}

const workspaceScopes: Array<{ scope: LibraryScope; icon: typeof Sparkle }> = [
  { scope: { kind: "today", title: "Today" }, icon: Sparkle },
  { scope: { kind: "all", title: "All feeds" }, icon: Books },
  { scope: { kind: "unread", title: "Unread" }, icon: Tray },
  { scope: { kind: "saved", title: "Saved" }, icon: Star },
]

export function Sidebar(props: SidebarProps) {
  const { locale, t } = useTranslation()
  const openFolders = useReaderStore((state) => state.openFolders)
  const toggleFolder = useReaderStore((state) => state.toggleFolder)
  const [contextMenu, setContextMenu] = useState<
    | {
        kind: "subscription"
        subscription: Subscription
        position: { x: number; y: number }
      }
    | { kind: "folder"; folder: Folder; position: { x: number; y: number } }
    | null
  >(null)
  const unreadTotal = props.subscriptions.reduce((total, item) => total + item.unread_count, 0)
  const openContextMenu = (event: MouseEvent, subscription: Subscription) => {
    event.preventDefault()
    setContextMenu({
      kind: "subscription",
      subscription,
      position: { x: event.clientX, y: event.clientY },
    })
  }
  const openFolderContextMenu = (event: MouseEvent, folder: Folder) => {
    event.preventDefault()
    setContextMenu({
      kind: "folder",
      folder,
      position: { x: event.clientX, y: event.clientY },
    })
  }
  const requestRename = (currentName: string) => {
    const nextName = window.prompt(t("rename"), currentName)?.trim()
    return nextName && nextName !== currentName ? nextName : null
  }
  const openURL = (value: string | null | undefined) => {
    if (!value) return
    window.open(value, "_blank", "noopener,noreferrer")
  }
  return (
    <aside className="sidebar" aria-label={t("primaryNavigation")}>
      <div className="sidebar__header">
        <Brand />
      </div>
      <nav className="nav-list nav-list--compact" aria-label={t("libraryViews")}>
        <p className="sidebar-section-label">{t("workspace")}</p>
        {workspaceScopes.map(({ scope, icon: Icon }) => {
          const active = props.scope.kind === scope.kind
          return (
            <button
              className={active ? "nav-item nav-item--active" : "nav-item"}
              key={scope.kind}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => props.onScopeChange(scope)}
            >
              <Icon aria-hidden="true" weight={active ? "fill" : "regular"} />
              <span>{localizedScopeTitle(scope, locale)}</span>
              {(scope.kind === "all" || scope.kind === "unread") && (
                <span className="nav-item__count">{unreadTotal}</span>
              )}
            </button>
          )
        })}
      </nav>
      <section className="subscription-section" aria-labelledby="subscriptions-title">
        <div className="library-toolbar">
          <h2 id="subscriptions-title">{t("subscriptions")}</h2>
          <button
            className="icon-button icon-button--small"
            type="button"
            aria-label={t("addFeed")}
            title={t("addFeed")}
            onClick={props.onAdd}
          >
            <Plus />
          </button>
          <button
            className="icon-button icon-button--small"
            type="button"
            aria-label={t("addFolder")}
            title={t("addFolder")}
            onClick={props.onOrganizeLibrary}
          >
            <FolderSimplePlus />
          </button>
        </div>
        <div className="subscription-scroll">
          {props.savedFilters.length > 0 && (
            <div className="library-group">
              <h3>{t("filters")}</h3>
              {props.savedFilters.map((filter) => {
                const active = props.scope.kind === "filter" && props.scope.id === filter.id
                return (
                  <button
                    className={active ? "folder-row folder-row--active" : "folder-row"}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    key={filter.id}
                    onClick={() =>
                      props.onScopeChange({
                        kind: "filter",
                        id: filter.id,
                        title: filter.name,
                        query: filter.query,
                      })
                    }
                  >
                    <Funnel aria-hidden="true" />
                    <span>{filter.name}</span>
                  </button>
                )
              })}
            </div>
          )}
          {props.tags.length > 0 && (
            <div className="library-group">
              <h3>{t("tags")}</h3>
              {props.tags.map((tag) => {
                const active = props.scope.kind === "tag" && props.scope.id === tag.id
                return (
                  <button
                    className={active ? "folder-row folder-row--active" : "folder-row"}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    key={tag.id}
                    onClick={() =>
                      props.onScopeChange({ kind: "tag", id: tag.id, title: tag.name })
                    }
                  >
                    <span
                      className="sidebar-tag-mark"
                      style={tag.color ? { backgroundColor: tag.color } : undefined}
                    >
                      <TagIcon aria-hidden="true" />
                    </span>
                    <span>{tag.name}</span>
                  </button>
                )
              })}
            </div>
          )}
          <div className="library-group library-group--tree">
            <FolderTree
              folders={props.folders}
              subscriptions={props.subscriptions}
              scope={props.scope}
              openFolders={openFolders}
              onToggleFolder={toggleFolder}
              onScopeChange={props.onScopeChange}
              onContextMenu={openContextMenu}
              onFolderContextMenu={openFolderContextMenu}
              onMoveFeed={props.onMoveFeed}
              onMergeFeeds={props.onMergeFeeds}
              onReorderFolder={props.onReorderFolder}
              onReorderFeed={props.onReorderFeed}
            />
            {props.folders.length === 0 && props.subscriptions.length === 0 && (
              <div className="sidebar-library-empty">
                <Tray aria-hidden="true" />
                <span>{t("noSubscriptions")}</span>
              </div>
            )}
          </div>
        </div>
      </section>
      {contextMenu?.kind === "subscription" && (
        <SubscriptionContextMenu
          subscription={contextMenu.subscription}
          folders={props.folders}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onRename={() => {
            const name = requestRename(contextMenu.subscription.title)
            if (name) props.onRenameFeed(contextMenu.subscription.feed_id, name)
          }}
          onMarkRead={() => props.onMarkFeedRead(contextMenu.subscription.feed_id)}
          onRefresh={() => props.onRefreshFeed(contextMenu.subscription.feed_id)}
          onMove={(folderID) => props.onMoveFeed(contextMenu.subscription.feed_id, folderID)}
          onDelete={() => props.onDeleteFeed(contextMenu.subscription.feed_id)}
          onOpenSource={() => openURL(contextMenu.subscription.feed_url)}
          onOpenWebsite={() => openURL(contextMenu.subscription.site_url)}
          onCopyID={() => void navigator.clipboard?.writeText(contextMenu.subscription.feed_id)}
          onChangeView={(viewMode) =>
            props.onChangeFeedView(contextMenu.subscription.feed_id, viewMode)
          }
          onChangeRefresh={(policy, intervalMinutes) =>
            props.onChangeFeedRefresh(contextMenu.subscription.feed_id, policy, intervalMinutes)
          }
        />
      )}
      {contextMenu?.kind === "folder" && (
        <FolderContextMenu
          folder={contextMenu.folder}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onRename={() => {
            const name = requestRename(contextMenu.folder.name)
            if (name) props.onRenameFolder(contextMenu.folder.id, name)
          }}
        />
      )}
    </aside>
  )
}

function FolderTree(props: {
  folders: Folder[]
  subscriptions: Subscription[]
  scope: LibraryScope
  openFolders: Record<string, boolean>
  onToggleFolder: (folderID: string) => void
  onScopeChange: (scope: LibraryScope) => void
  onContextMenu: (event: MouseEvent, subscription: Subscription) => void
  onFolderContextMenu: (event: MouseEvent, folder: Folder) => void
  onMoveFeed: (feedID: string, folderID: string | null) => void
  onMergeFeeds: (feedID: string, targetFeedID: string) => void
  onReorderFolder: (folderID: string, targetID: string, before: boolean) => void
  onReorderFeed: (feedID: string, targetID: string, before: boolean) => void
}) {
  const { t } = useTranslation()
  const [dragging, setDragging] = useState<{
    type: "subscription" | "folder"
    id: string
  } | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{
    id: string
    position: "before" | "after" | "inside"
  } | null>(null)
  const childrenByParent = new Map<string | null, Folder[]>()
  const subscriptionsByFolder = new Map<string | null, Subscription[]>()
  for (const folder of props.folders) {
    const parent = folder.parent_id ?? null
    const children = childrenByParent.get(parent) ?? []
    children.push(folder)
    childrenByParent.set(parent, children)
  }
  for (const subscription of props.subscriptions) {
    const folderID = subscription.folder_id ?? null
    const items = subscriptionsByFolder.get(folderID) ?? []
    items.push(subscription)
    subscriptionsByFolder.set(folderID, items)
  }
  const rendered = new Set<string>()
  const dragPayload = (event: DragEvent) => {
    try {
      return JSON.parse(event.dataTransfer.getData("application/x-aurora-library")) as {
        type: "subscription" | "folder"
        id: string
      }
    } catch {
      return null
    }
  }
  const allowDrop = (event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }
  const clearDragState = () => {
    setDragging(null)
    setDropIndicator(null)
  }
  const clearDropIndicator = (event: DragEvent) => {
    const nextTarget = event.relatedTarget
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
    setDropIndicator(null)
  }
  const dropZone = (event: DragEvent) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientY - rect.top) / rect.height
    if (ratio < 0.28) return "before" as const
    if (ratio > 0.72) return "after" as const
    return "merge" as const
  }
  const renderSubscription = (subscription: Subscription, depth: number) => {
    const active = props.scope.kind === "feed" && props.scope.id === subscription.feed_id
    const indicator =
      dropIndicator?.id === `subscription:${subscription.feed_id}` ? dropIndicator.position : null
    return (
      <button
        className={[
          "feed-row feed-row--nested",
          active ? "feed-row--active" : "",
          indicator ? `library-drop-target library-drop-target--${indicator}` : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ paddingLeft: `${9 + depth * 14}px` }}
        key={subscription.id}
        type="button"
        draggable
        aria-current={active ? "page" : undefined}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move"
          event.dataTransfer.setData(
            "application/x-aurora-library",
            JSON.stringify({ type: "subscription", id: subscription.feed_id }),
          )
          setDragging({ type: "subscription", id: subscription.feed_id })
        }}
        onDragEnd={clearDragState}
        onDragOver={(event) => {
          allowDrop(event)
          if (!dragging || dragging.type !== "subscription" || dragging.id === subscription.feed_id)
            return
          const zone = dropZone(event)
          setDropIndicator({
            id: `subscription:${subscription.feed_id}`,
            position: zone === "merge" ? "inside" : zone,
          })
        }}
        onDragLeave={clearDropIndicator}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          clearDragState()
          const source = dragPayload(event)
          if (!source || source.type !== "subscription" || source.id === subscription.feed_id)
            return
          const zone = dropZone(event)
          if (zone === "merge") {
            props.onMergeFeeds(source.id, subscription.feed_id)
          } else {
            props.onReorderFeed(source.id, subscription.feed_id, zone === "before")
          }
        }}
        onClick={() =>
          props.onScopeChange({ kind: "feed", id: subscription.feed_id, title: subscription.title })
        }
        onContextMenu={(event) => props.onContextMenu(event, subscription)}
      >
        <span className="feed-row__mark" aria-hidden="true">
          <span>{subscription.title.slice(0, 1).toUpperCase()}</span>
          {subscription.icon_url && (
            <img
              src={subscription.icon_url}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(event) => {
                event.currentTarget.hidden = true
              }}
            />
          )}
        </span>
        <span className="feed-row__title">{subscription.title}</span>
        <span className="feed-row__count">{subscription.unread_count}</span>
      </button>
    )
  }
  const renderLevel = (parentID: string | null, depth: number): ReactNode[] => {
    const children = childrenByParent.get(parentID) ?? []
    const rows: ReactNode[] = []
    for (const subscription of subscriptionsByFolder.get(parentID) ?? []) {
      rows.push(renderSubscription(subscription, depth))
    }
    rows.push(
      ...children.flatMap((folder) => {
        rendered.add(folder.id)
        const active = props.scope.kind === "folder" && props.scope.id === folder.id
        const childFolders = childrenByParent.get(folder.id) ?? []
        const directSubscriptions = subscriptionsByFolder.get(folder.id) ?? []
        const hasChildren = childFolders.length > 0 || directSubscriptions.length > 0
        const descendantIDs = new Set([folder.id])
        const collectDescendants = (parentID: string) => {
          for (const child of childrenByParent.get(parentID) ?? []) {
            descendantIDs.add(child.id)
            collectDescendants(child.id)
          }
        }
        collectDescendants(folder.id)
        const unread = props.subscriptions
          .filter(
            (subscription) => subscription.folder_id && descendantIDs.has(subscription.folder_id),
          )
          .reduce((total, subscription) => total + subscription.unread_count, 0)
        const expanded = props.openFolders[folder.id] ?? true
        const indicator =
          dropIndicator?.id === `folder:${folder.id}` ? dropIndicator.position : null
        return [
          <div
            className={[
              "folder-tree-row",
              indicator ? `library-drop-target library-drop-target--${indicator}` : "",
            ]
              .filter(Boolean)
              .join(" ")}
            key={folder.id}
            style={{ paddingLeft: `${9 + depth * 14}px` }}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move"
              event.dataTransfer.setData(
                "application/x-aurora-library",
                JSON.stringify({ type: "folder", id: folder.id }),
              )
              setDragging({ type: "folder", id: folder.id })
            }}
            onDragEnd={clearDragState}
            onDragOver={(event) => {
              allowDrop(event)
              if (!dragging || dragging.id === folder.id) return
              if (dragging.type === "subscription") {
                setDropIndicator({ id: `folder:${folder.id}`, position: "inside" })
                return
              }
              setDropIndicator({
                id: `folder:${folder.id}`,
                position: dropZone(event) === "after" ? "after" : "before",
              })
            }}
            onDragLeave={clearDropIndicator}
            onDrop={(event) => {
              event.preventDefault()
              event.stopPropagation()
              clearDragState()
              const source = dragPayload(event)
              if (!source || source.id === folder.id) return
              if (source.type === "folder") {
                props.onReorderFolder(source.id, folder.id, dropZone(event) !== "after")
              } else {
                props.onMoveFeed(source.id, folder.id)
              }
            }}
            onContextMenu={(event) => props.onFolderContextMenu(event, folder)}
          >
            <button
              className={active ? "folder-row folder-row--active" : "folder-row"}
              type="button"
              aria-current={active ? "page" : undefined}
              aria-expanded={hasChildren ? expanded : undefined}
              onClick={() => {
                props.onScopeChange({ kind: "folder", id: folder.id, title: folder.name })
                if (hasChildren) props.onToggleFolder(folder.id)
              }}
            >
              <FolderOpen aria-hidden="true" weight={active ? "fill" : "regular"} />
              <span>{folder.name}</span>
              <span className="folder-row__count">{unread}</span>
            </button>
            {hasChildren && (
              <button
                className="folder-row__toggle"
                type="button"
                aria-label={expanded ? t("collapseFolder") : t("expandFolder")}
                title={expanded ? t("collapseFolder") : t("expandFolder")}
                aria-expanded={expanded}
                onClick={() => props.onToggleFolder(folder.id)}
              >
                {expanded ? <CaretDown aria-hidden="true" /> : <CaretRight aria-hidden="true" />}
              </button>
            )}
          </div>,
          ...(expanded ? renderLevel(folder.id, depth + 1) : []),
        ]
      }),
    )
    return rows
  }
  const rows = renderLevel(null, 0)
  for (const folder of props.folders) {
    if (rendered.has(folder.id)) continue
    rows.push(...renderLevel(folder.parent_id ?? null, 0))
  }
  return <>{rows}</>
}
