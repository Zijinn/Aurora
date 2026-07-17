import {
  Article,
  ArrowsClockwise,
  CircleNotch,
  Plus,
  Star,
  WarningCircle,
} from "@phosphor-icons/react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useRef } from "react"

import type { Entry, LibraryScope, ViewMode } from "../api/types"

interface TimelinePaneProps {
  scope: LibraryScope
  entries: Entry[]
  selectedEntryID: string | null
  viewMode: ViewMode
  isLoading: boolean
  isFetchingNext: boolean
  hasNextPage: boolean
  error: Error | null
  markReadPending: boolean
  refreshPending: boolean
  onSelect: (entryID: string) => void
  onAdd: () => void
  onRetry: () => void
  onLoadMore: () => void
  onMarkAllRead: () => void
  onRefresh: (feedID: string) => void
  onToggleStar: (entry: Entry) => void
}

export function TimelinePane(props: TimelinePaneProps) {
	const scrollRef = useRef<HTMLDivElement>(null)
	const selectedFeedID = props.scope.kind === "feed" ? props.scope.id : null
  const virtualizer = useVirtualizer({
    count: props.entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (props.viewMode === "compact" ? 72 : 116),
    overscan: 7,
  })
  const virtualItems = virtualizer.getVirtualItems()
  const onScroll = () => {
    const element = scrollRef.current
    if (!element || !props.hasNextPage || props.isFetchingNext) return
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 640) props.onLoadMore()
  }

  return (
    <section className="timeline" aria-labelledby="timeline-title">
      <header className="pane-header">
        <div className="pane-header__titles">
          <p className="pane-header__context">{scopeContext(props.scope)}</p>
          <h1 id="timeline-title">{props.scope.title}</h1>
        </div>
        <div className="pane-header__actions">
		  {selectedFeedID && (
            <button
              className="icon-button"
              type="button"
              aria-label="Refresh feed"
              title="Refresh feed"
              disabled={props.refreshPending}
			  onClick={() => props.onRefresh(selectedFeedID)}
            >
              {props.refreshPending ? <CircleNotch className="spin" /> : <ArrowsClockwise />}
            </button>
          )}
          <button
            className="button button--quiet"
            type="button"
            disabled={props.entries.length === 0 || props.markReadPending}
            onClick={props.onMarkAllRead}
          >
            {props.markReadPending ? <CircleNotch className="spin" /> : <Article />}
            <span>Mark all read</span>
          </button>
        </div>
      </header>
      {props.isLoading ? (
        <TimelineSkeleton />
      ) : props.error ? (
        <div className="pane-state" role="alert">
          <WarningCircle aria-hidden="true" />
          <h2>Timeline unavailable</h2>
          <p>{props.error.message}</p>
          <button className="button button--secondary" type="button" onClick={props.onRetry}>Retry</button>
        </div>
      ) : props.entries.length === 0 ? (
        <div className="timeline__empty">
          <div className="empty-mark" aria-hidden="true"><span /><span /><span /></div>
          <h2>{props.scope.kind === "unread" ? "You are caught up" : "Your reading trail starts here"}</h2>
          <p>{props.scope.kind === "unread" ? "New unread articles will appear here." : "Add a feed or import an OPML file to build your library."}</p>
          <button className="button button--primary" type="button" onClick={props.onAdd}><Plus />Add feed</button>
        </div>
      ) : (
        <div className="timeline-scroll" ref={scrollRef} onScroll={onScroll}>
          <div className="timeline-list" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualItems.map((virtualItem) => {
              const entry = props.entries[virtualItem.index]
              if (!entry) return null
              return (
                <div
                  className="timeline-list__row"
                  data-index={virtualItem.index}
                  key={entry.id}
                  ref={virtualizer.measureElement}
                  style={{ transform: `translateY(${virtualItem.start}px)` }}
                >
                  <TimelineEntry
                    entry={entry}
                    selected={entry.id === props.selectedEntryID}
                    viewMode={props.viewMode}
                    onSelect={() => props.onSelect(entry.id)}
                    onToggleStar={() => props.onToggleStar(entry)}
                  />
                </div>
              )
            })}
          </div>
          {props.isFetchingNext && <div className="timeline-loading-more"><CircleNotch className="spin" />Loading</div>}
        </div>
      )}
    </section>
  )
}

function TimelineEntry({
  entry,
  selected,
  viewMode,
  onSelect,
  onToggleStar,
}: {
  entry: Entry
  selected: boolean
  viewMode: ViewMode
  onSelect: () => void
  onToggleStar: () => void
}) {
  return (
    <article className={`timeline-entry timeline-entry--${viewMode}${selected ? " timeline-entry--selected" : ""}${entry.state.is_read ? " timeline-entry--read" : ""}`}>
      {entry.lead_image_url && (viewMode === "image" || viewMode === "magazine" || viewMode === "card") && (
        <img className="timeline-entry__image" src={entry.lead_image_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
      )}
      <button className="timeline-entry__main" type="button" aria-current={selected ? "true" : undefined} onClick={onSelect}>
        <div className="timeline-entry__meta">
          <span className="timeline-entry__feed"><span className="unread-dot" />{entry.feed_title}</span>
          <time dateTime={entry.published_at}>{formatRelativeTime(entry.published_at)}</time>
        </div>
        <h2>{entry.title || "Untitled"}</h2>
        {viewMode !== "compact" && entry.summary && <p>{entry.summary}</p>}
        {entry.author && <span className="timeline-entry__author">{entry.author}</span>}
      </button>
      <button
        className={entry.state.is_starred ? "entry-star entry-star--active" : "entry-star"}
        type="button"
        aria-label={entry.state.is_starred ? "Remove star" : "Star article"}
        title={entry.state.is_starred ? "Remove star" : "Star article"}
        onClick={onToggleStar}
      >
        <Star weight={entry.state.is_starred ? "fill" : "regular"} />
      </button>
    </article>
  )
}

function TimelineSkeleton() {
  return <div className="timeline-skeleton" aria-label="Loading articles">{Array.from({ length: 7 }, (_, index) => <div className="skeleton-row" key={index}><span /><span /><span /></div>)}</div>
}

function scopeContext(scope: LibraryScope) {
  switch (scope.kind) {
    case "feed": return "Feed"
    case "folder": return "Folder"
    case "today": return "Library"
    default: return "Smart view"
  }
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  const deltaMinutes = Math.round((date.getTime() - Date.now()) / 60_000)
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  if (Math.abs(deltaMinutes) < 60) return formatter.format(deltaMinutes, "minute")
  const deltaHours = Math.round(deltaMinutes / 60)
  if (Math.abs(deltaHours) < 24) return formatter.format(deltaHours, "hour")
  const deltaDays = Math.round(deltaHours / 24)
  if (Math.abs(deltaDays) < 7) return formatter.format(deltaDays, "day")
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)
}
