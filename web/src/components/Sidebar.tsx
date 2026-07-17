import {
  CaretRight,
  CircleNotch,
  Funnel,
  FolderSimple,
  GearSix,
  House,
  MagnifyingGlass,
  Plus,
  Star,
  Tag as TagIcon,
  Tray,
} from "@phosphor-icons/react"
import type { UseQueryResult } from "@tanstack/react-query"

import type { Folder, LibraryScope, SavedFilter, ServerStatus, Subscription, Tag } from "../api/types"
import { Brand } from "./Brand"

interface SidebarProps {
  scope: LibraryScope
  search: string
  status: UseQueryResult<ServerStatus, Error>
  subscriptions: Subscription[]
  folders: Folder[]
  tags: Tag[]
  savedFilters: SavedFilter[]
  onScopeChange: (scope: LibraryScope) => void
  onSearchChange: (value: string) => void
  onAdd: () => void
  onPreferences: () => void
}

const primaryScopes: Array<{ scope: LibraryScope; icon: typeof House }> = [
  { scope: { kind: "today", title: "Today" }, icon: House },
  { scope: { kind: "unread", title: "Unread" }, icon: Tray },
  { scope: { kind: "saved", title: "Saved" }, icon: Star },
]

export function Sidebar(props: SidebarProps) {
  const unreadTotal = props.subscriptions.reduce((total, item) => total + item.unread_count, 0)
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar__header">
        <Brand />
        <button className="icon-button" type="button" aria-label="Add feed" title="Add feed" onClick={props.onAdd}>
          <Plus />
        </button>
      </div>
      <label className="search-box" htmlFor="library-search">
        <MagnifyingGlass aria-hidden="true" />
        <span className="sr-only">Search library</span>
        <input
          id="library-search"
          type="search"
          value={props.search}
          placeholder="Search"
          onChange={(event) => props.onSearchChange(event.target.value)}
        />
        <kbd>/</kbd>
      </label>
      <nav className="nav-list" aria-label="Library views">
        {primaryScopes.map(({ scope, icon: Icon }) => {
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
              <span>{scope.title}</span>
              {scope.kind === "unread" && <span className="nav-item__count">{unreadTotal}</span>}
            </button>
          )
        })}
      </nav>
      <section className="subscription-section" aria-labelledby="subscriptions-title">
        <div className="section-heading">
          <h2 id="subscriptions-title">Subscriptions</h2>
          <button className="icon-button icon-button--small" type="button" aria-label="Add feed" title="Add feed" onClick={props.onAdd}>
            <Plus />
          </button>
        </div>
        <div className="subscription-scroll">
          {props.savedFilters.length > 0 && (
            <div className="library-group">
              <h3>Filters</h3>
              {props.savedFilters.map((filter) => {
                const active = props.scope.kind === "filter" && props.scope.id === filter.id
                return <button className={active ? "folder-row folder-row--active" : "folder-row"} type="button" aria-current={active ? "page" : undefined} key={filter.id} onClick={() => props.onScopeChange({ kind: "filter", id: filter.id, title: filter.name, query: filter.query })}><Funnel aria-hidden="true" /><span>{filter.name}</span></button>
              })}
            </div>
          )}
          {props.tags.length > 0 && (
            <div className="library-group">
              <h3>Tags</h3>
              {props.tags.map((tag) => {
                const active = props.scope.kind === "tag" && props.scope.id === tag.id
                return <button className={active ? "folder-row folder-row--active" : "folder-row"} type="button" aria-current={active ? "page" : undefined} key={tag.id} onClick={() => props.onScopeChange({ kind: "tag", id: tag.id, title: tag.name })}><span className="sidebar-tag-mark" style={tag.color ? { backgroundColor: tag.color } : undefined}><TagIcon aria-hidden="true" /></span><span>{tag.name}</span></button>
              })}
            </div>
          )}
          <div className="library-group">
            <h3>Library</h3>
          <button
            className={props.scope.kind === "all" ? "folder-row folder-row--active" : "folder-row"}
            type="button"
            aria-current={props.scope.kind === "all" ? "page" : undefined}
            onClick={() => props.onScopeChange({ kind: "all", title: "All feeds" })}
          >
            <CaretRight aria-hidden="true" />
            <span>All feeds</span>
            <span className="folder-row__count">{unreadTotal}</span>
          </button>
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
      <div className="sidebar__footer">
        <div className="server-state" role="status">
          {props.status.isPending ? (
            <CircleNotch className="spin" aria-hidden="true" />
          ) : props.status.isError ? (
            <span className="server-state__indicator server-state__indicator--error" />
          ) : (
            <span className="server-state__indicator" />
          )}
          <span>{props.status.isPending ? "Connecting" : props.status.isError ? "Server offline" : "Library ready"}</span>
        </div>
        <button className="icon-button" type="button" aria-label="Preferences" title="Preferences" onClick={props.onPreferences}>
          <GearSix />
        </button>
      </div>
    </aside>
  )
}
