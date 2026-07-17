import {
  Books,
  CircleNotch,
  Funnel,
  FolderSimple,
  Plus,
  Sparkle,
  Star,
  Tag as TagIcon,
  Tray,
} from "@phosphor-icons/react"
import type { UseQueryResult } from "@tanstack/react-query"

import type { Folder, LibraryScope, SavedFilter, ServerStatus, Subscription, Tag } from "../api/types"
import { localizedScopeTitle, useTranslation } from "../lib/i18n"
import { Brand } from "./Brand"

interface SidebarProps {
  scope: LibraryScope
  status: UseQueryResult<ServerStatus, Error>
  subscriptions: Subscription[]
  folders: Folder[]
  tags: Tag[]
  savedFilters: SavedFilter[]
  onScopeChange: (scope: LibraryScope) => void
  onAdd: () => void
}

const workspaceScopes: Array<{ scope: LibraryScope; icon: typeof Sparkle }> = [
  { scope: { kind: "today", title: "Today" }, icon: Sparkle },
  { scope: { kind: "all", title: "All feeds" }, icon: Books },
  { scope: { kind: "unread", title: "Unread" }, icon: Tray },
]

export function Sidebar(props: SidebarProps) {
  const { locale, t } = useTranslation()
  const unreadTotal = props.subscriptions.reduce((total, item) => total + item.unread_count, 0)
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
              {(scope.kind === "all" || scope.kind === "unread") && <span className="nav-item__count">{unreadTotal}</span>}
            </button>
          )
        })}
        <p className="sidebar-section-label sidebar-section-label--spaced">{t("saved")}</p>
        <button
          className={props.scope.kind === "saved" ? "nav-item nav-item--active" : "nav-item"}
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
          <button className="icon-button icon-button--small" type="button" aria-label={t("addFeed")} title={t("addFeed")} onClick={props.onAdd}>
            <Plus />
          </button>
        </div>
        <div className="subscription-scroll">
          {props.savedFilters.length > 0 && (
            <div className="library-group">
              <h3>{t("filters")}</h3>
              {props.savedFilters.map((filter) => {
                const active = props.scope.kind === "filter" && props.scope.id === filter.id
                return <button className={active ? "folder-row folder-row--active" : "folder-row"} type="button" aria-current={active ? "page" : undefined} key={filter.id} onClick={() => props.onScopeChange({ kind: "filter", id: filter.id, title: filter.name, query: filter.query })}><Funnel aria-hidden="true" /><span>{filter.name}</span></button>
              })}
            </div>
          )}
          {props.tags.length > 0 && (
            <div className="library-group">
              <h3>{t("tags")}</h3>
              {props.tags.map((tag) => {
                const active = props.scope.kind === "tag" && props.scope.id === tag.id
                return <button className={active ? "folder-row folder-row--active" : "folder-row"} type="button" aria-current={active ? "page" : undefined} key={tag.id} onClick={() => props.onScopeChange({ kind: "tag", id: tag.id, title: tag.name })}><span className="sidebar-tag-mark" style={tag.color ? { backgroundColor: tag.color } : undefined}><TagIcon aria-hidden="true" /></span><span>{tag.name}</span></button>
              })}
            </div>
          )}
          <div className="library-group">
            <h3>{t("folders")}</h3>
          {props.folders.map((folder) => {
            const active = props.scope.kind === "folder" && props.scope.id === folder.id
            const unread = props.subscriptions
              .filter((subscription) => subscription.folder_id === folder.id)
              .reduce((total, subscription) => total + subscription.unread_count, 0)
            return (
              <button
                className={active ? "folder-row folder-row--active" : "folder-row"}
                key={folder.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => props.onScopeChange({ kind: "folder", id: folder.id, title: folder.name })}
              >
                <FolderSimple aria-hidden="true" />
                <span>{folder.name}</span>
                <span className="folder-row__count">{unread}</span>
              </button>
            )
          })}
          <div className="feed-list">
            <h3>{t("subscriptions")}</h3>
            {props.subscriptions.map((subscription) => {
              const active = props.scope.kind === "feed" && props.scope.id === subscription.feed_id
              return (
                <button
                  className={active ? "feed-row feed-row--active" : "feed-row"}
                  key={subscription.id}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => props.onScopeChange({ kind: "feed", id: subscription.feed_id, title: subscription.title })}
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
        <span className="sidebar-profile-mark" aria-hidden="true">A</span>
        <div className="server-state" role="status">
          <strong>Aurora</strong>
          {props.status.isPending ? (
            <CircleNotch className="spin" aria-hidden="true" />
          ) : props.status.isError ? (
            <span className="server-state__indicator server-state__indicator--error" />
          ) : (
            <span className="server-state__indicator" />
          )}
          <span>{props.status.isPending ? t("connecting") : props.status.isError ? t("serverOffline") : t("libraryReady")}</span>
        </div>
      </div>
    </aside>
  )
}
