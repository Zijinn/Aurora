import {
  Books,
  CaretDown,
  CaretRight,
  CircleNotch,
  Funnel,
  FolderSimple,
  FolderSimplePlus,
  Plus,
  Sparkle,
  Star,
  Tag as TagIcon,
  Tray,
} from "@phosphor-icons/react"
import type { UseQueryResult } from "@tanstack/react-query"
import { useState, type MouseEvent, type ReactNode } from "react"

import type {
  Folder,
  LibraryScope,
  SavedFilter,
  ServerStatus,
  Subscription,
  Tag,
  ViewMode,
} from "../api/types"
import { localizedScopeTitle, useTranslation } from "../lib/i18n"
import { useReaderStore } from "../store/reader"
import { Brand } from "./Brand"
import { SubscriptionContextMenu } from "./SubscriptionContextMenu"

interface SidebarProps {
  scope: LibraryScope
  status: UseQueryResult<ServerStatus, Error>
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
]

export function Sidebar(props: SidebarProps) {
  const { locale, t } = useTranslation()
  const openFolders = useReaderStore((state) => state.openFolders)
  const toggleFolder = useReaderStore((state) => state.toggleFolder)
  const [contextMenu, setContextMenu] = useState<{
    subscription: Subscription
    position: { x: number; y: number }
  } | null>(null)
  const unreadTotal = props.subscriptions.reduce((total, item) => total + item.unread_count, 0)
  const openContextMenu = (event: MouseEvent, subscription: Subscription) => {
    event.preventDefault()
    setContextMenu({ subscription, position: { x: event.clientX, y: event.clientY } })
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
      <nav className="nav-list" aria-label={t("libraryViews")}>
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
        <button
          className={
            props.scope.kind === "saved"
              ? "nav-item nav-item--saved nav-item--active"
              : "nav-item nav-item--saved"
          }
          type="button"
          aria-current={props.scope.kind === "saved" ? "page" : undefined}
          onClick={() => props.onScopeChange({ kind: "saved", title: "Saved" })}
        >
          <Star aria-hidden="true" weight={props.scope.kind === "saved" ? "fill" : "regular"} />
          <span>{t("saved")}</span>
        </button>
      </nav>
      <section className="subscription-section" aria-labelledby="subscriptions-title">
        <div className="section-heading">
          <h2 id="subscriptions-title">{t("spaces")}</h2>
          <button
            className="icon-button icon-button--small"
            type="button"
            aria-label={t("addFeed")}
            title={t("addFeed")}
            onClick={props.onAdd}
          >
            <Plus />
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
          <div className="library-group">
            <div className="library-group__heading">
              <h3>{t("folders")}</h3>
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
            <FolderTree
              folders={props.folders}
              subscriptions={props.subscriptions}
              scope={props.scope}
              openFolders={openFolders}
              onToggleFolder={toggleFolder}
              onScopeChange={props.onScopeChange}
            />
            {props.folders.length === 0 && props.subscriptions.length === 0 && (
              <div className="sidebar-library-empty">
                <Tray aria-hidden="true" />
                <span>{t("noSubscriptions")}</span>
              </div>
            )}
            <div className="feed-list">
              <h3>{t("subscriptions")}</h3>
              {props.subscriptions.map((subscription) => {
                const active =
                  props.scope.kind === "feed" && props.scope.id === subscription.feed_id
                return (
                  <button
                    className={active ? "feed-row feed-row--active" : "feed-row"}
                    key={subscription.id}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() =>
                      props.onScopeChange({
                        kind: "feed",
                        id: subscription.feed_id,
                        title: subscription.title,
                      })
                    }
                    onContextMenu={(event) => openContextMenu(event, subscription)}
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
              })}
            </div>
          </div>
        </div>
      </section>
      <button className="sidebar-add button button--secondary" type="button" onClick={props.onAdd}>
        <Plus />
        <span>{t("addFeed")}</span>
        <kbd>⌘ N</kbd>
      </button>
      <div className="sidebar__footer">
        <div className="server-state" role="status">
          {props.status.isPending ? (
            <CircleNotch className="spin" aria-hidden="true" />
          ) : props.status.isError ? (
            <span className="server-state__indicator server-state__indicator--error" />
          ) : (
            <span className="server-state__indicator" />
          )}
          <span>
            {props.status.isPending
              ? t("connecting")
              : props.status.isError
                ? t("serverOffline")
                : t("libraryReady")}
          </span>
        </div>
      </div>
      {contextMenu && (
        <SubscriptionContextMenu
          subscription={contextMenu.subscription}
          folders={props.folders}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
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
}) {
  const { t } = useTranslation()
  const childrenByParent = new Map<string | null, Folder[]>()
  for (const folder of props.folders) {
    const parent = folder.parent_id ?? null
    const children = childrenByParent.get(parent) ?? []
    children.push(folder)
    childrenByParent.set(parent, children)
  }
  const rendered = new Set<string>()
  const renderLevel = (parentID: string | null, depth: number): ReactNode[] => {
    const children = childrenByParent.get(parentID) ?? []
    return children.flatMap((folder) => {
      rendered.add(folder.id)
      const active = props.scope.kind === "folder" && props.scope.id === folder.id
      const childFolders = childrenByParent.get(folder.id) ?? []
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
      return [
        <div
          className="folder-tree-row"
          key={folder.id}
          style={{ paddingLeft: `${9 + depth * 14}px` }}
        >
          <button
            className={active ? "folder-row folder-row--active" : "folder-row"}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() =>
              props.onScopeChange({ kind: "folder", id: folder.id, title: folder.name })
            }
          >
            <FolderSimple aria-hidden="true" />
            <span>{folder.name}</span>
            <span className="folder-row__count">{unread}</span>
          </button>
          {childFolders.length > 0 && (
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
    })
  }
  const rows = renderLevel(null, 0)
  for (const folder of props.folders) {
    if (rendered.has(folder.id)) continue
    rows.push(...renderLevel(folder.parent_id ?? null, 0))
  }
  return <>{rows}</>
}
