import {
  Article,
  ArrowsClockwise,
  CircleNotch,
  Plus,
  Sparkle,
  Star,
  WarningCircle,
} from "@phosphor-icons/react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useRef } from "react"

import type { Entry, LibraryScope, Subscription, ViewMode } from "../api/types"
import { localizedScopeTitle, useTranslation, type Locale, type Translator } from "../lib/i18n"

interface TimelinePaneProps {
  scope: LibraryScope
  entries: Entry[]
  subscriptions: Subscription[]
  selectedEntryID: string | null
  viewMode: ViewMode
  isLoading: boolean
  isFetchingNext: boolean
  hasNextPage: boolean
  error: Error | null
  markReadPending: boolean
  refreshPending: boolean
  onScopeChange: (scope: LibraryScope) => void
  onSelect: (entryID: string) => void
  onAdd: () => void
  onRetry: () => void
  onLoadMore: () => void
  onMarkAllRead: () => void
  onRefresh: (feedID: string) => void
  onToggleStar: (entry: Entry) => void
}

export function TimelinePane(props: TimelinePaneProps) {
  const { locale, t } = useTranslation()
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
      <header className="pane-header library-page-header">
        <div className="pane-header__titles">
          <p className="pane-header__context">{scopeContext(props.scope, t)}</p>
          <h1 id="timeline-title">{localizedScopeTitle(props.scope, locale)}</h1>
          <p className="pane-header__description">{scopeDescription(props.scope, t)}</p>
        </div>
        <div className="pane-header__actions">
          {selectedFeedID && (
            <button
              className="icon-button"
              type="button"
              aria-label={t("refreshFeed")}
              title={t("refreshFeed")}
              disabled={props.refreshPending}
              onClick={() => props.onRefresh(selectedFeedID)}
            >
              {props.refreshPending ? <CircleNotch className="spin" /> : <ArrowsClockwise />}
            </button>
          )}
        </div>
      </header>
      <div className="timeline-filterbar">
        <div className="timeline-filterbar__scopes" aria-label={t("articleFilters")}>
          <button className={props.scope.kind === "all" ? "filter-chip filter-chip--active" : "filter-chip"} type="button" onClick={() => props.onScopeChange({ kind: "all", title: "All feeds" })}>{t("all")}</button>
          <button className={props.scope.kind === "unread" ? "filter-chip filter-chip--active" : "filter-chip"} type="button" onClick={() => props.onScopeChange({ kind: "unread", title: "Unread" })}>{t("unread")}</button>
          <button className={props.scope.kind === "saved" ? "filter-chip filter-chip--active" : "filter-chip"} type="button" onClick={() => props.onScopeChange({ kind: "saved", title: "Saved" })}>{t("saved")}</button>
        </div>
        <button
          className="button button--quiet timeline-mark-read"
          type="button"
          disabled={props.entries.length === 0 || props.markReadPending}
          onClick={props.onMarkAllRead}
        >
          {props.markReadPending ? <CircleNotch className="spin" /> : <Article />}
          <span>{t("markAllRead")}</span>
        </button>
      </div>
      {props.scope.kind === "today" && <TodayOverview entries={props.entries} subscriptions={props.subscriptions} />}
      {props.isLoading ? (
        <TimelineSkeleton />
      ) : props.error ? (
        <div className="pane-state" role="alert">
          <WarningCircle aria-hidden="true" />
          <h2>{t("timelineUnavailable")}</h2>
          <p>{props.error.message}</p>
          <button className="button button--secondary" type="button" onClick={props.onRetry}>{t("retry")}</button>
        </div>
      ) : props.entries.length === 0 ? (
        <div className="timeline__empty">
          <div className="empty-mark" aria-hidden="true"><span /><span /><span /></div>
          <h2>{props.scope.kind === "unread" ? t("caughtUp") : t("readingTrailStarts")}</h2>
          <p>{props.scope.kind === "unread" ? t("unreadWillAppear") : t("addFeedOrImport")}</p>
          <button className="button button--primary" type="button" onClick={props.onAdd}><Plus />{t("addFeed")}</button>
        </div>
      ) : (
        <div className="timeline-results">
          <div className="timeline-group-label"><span>{t("latestStories")}</span><i /></div>
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
                    index={virtualItem.index}
                    selected={entry.id === props.selectedEntryID}
                    viewMode={props.viewMode}
                    locale={locale}
                    t={t}
                    onSelect={() => props.onSelect(entry.id)}
                    onToggleStar={() => props.onToggleStar(entry)}
                  />
                </div>
              )
            })}
          </div>
          {props.isFetchingNext && <div className="timeline-loading-more"><CircleNotch className="spin" />{t("loading")}</div>}
          </div>
        </div>
      )}
    </section>
  )
}

function TimelineEntry({
  entry,
  index,
  selected,
  viewMode,
  locale,
  t,
  onSelect,
  onToggleStar,
}: {
  entry: Entry
  index: number
  selected: boolean
  viewMode: ViewMode
  locale: Locale
  t: Translator
  onSelect: () => void
  onToggleStar: () => void
}) {
  return (
    <article className={`timeline-entry timeline-entry--${viewMode}${selected ? " timeline-entry--selected" : ""}${entry.state.is_read ? " timeline-entry--read" : ""}`}>
      <span className="timeline-entry__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
      <span className="timeline-entry__image" aria-hidden="true">
        <span>{entry.feed_title.slice(0, 1).toUpperCase()}</span>
        {entry.lead_image_url && <img src={entry.lead_image_url} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      </span>
      <button className="timeline-entry__main" type="button" aria-current={selected ? "true" : undefined} onClick={onSelect}>
        <div className="timeline-entry__meta">
          <span className="timeline-entry__feed"><span className="unread-dot" />{entry.feed_title}</span>
          <time dateTime={entry.published_at}>{formatRelativeTime(entry.published_at, locale)}</time>
        </div>
        <h2>{entry.title || t("untitled")}</h2>
        {entry.summary && <p className="timeline-entry__summary">{entry.summary}</p>}
        {entry.author && <span className="timeline-entry__author">{entry.author}</span>}
      </button>
      <button
        className={entry.state.is_starred ? "entry-star entry-star--active" : "entry-star"}
        type="button"
        aria-label={entry.state.is_starred ? t("removeStar") : t("starArticle")}
        title={entry.state.is_starred ? t("removeStar") : t("starArticle")}
        onClick={onToggleStar}
      >
        <Star weight={entry.state.is_starred ? "fill" : "regular"} />
      </button>
    </article>
  )
}

function TodayOverview({ entries, subscriptions }: { entries: Entry[]; subscriptions: Subscription[] }) {
  const { t } = useTranslation()
  const unread = entries.filter((entry) => !entry.state.is_read).length
  const activeSources = subscriptions.filter((subscription) => subscription.unread_count > 0)
  const topSources = [...activeSources].sort((left, right) => right.unread_count - left.unread_count).slice(0, 5)
  const peakUnread = Math.max(1, ...topSources.map((source) => source.unread_count))
  return (
    <section className="today-overview" aria-label={t("dailySignal")}>
      <div className="daily-signal">
        <div className="daily-signal__heading">
          <span className="daily-signal__icon" aria-hidden="true"><Sparkle weight="fill" /></span>
          <div><p>{t("dailySignal")}</p><h2>{t("todayBriefing")}</h2></div>
        </div>
        <p className="daily-signal__description">{t("todayBriefingDescription")}</p>
        <dl>
          <div><dt>{t("stories")}</dt><dd>{entries.length}</dd></div>
          <div><dt>{t("sources")}</dt><dd>{activeSources.length}</dd></div>
          <div><dt>{t("unread")}</dt><dd>{unread}</dd></div>
        </dl>
      </div>
      <div className="source-overview">
        <div className="source-overview__heading"><span><i />{t("sourceOverview")}</span><small>{t("orderedByActivity")}</small></div>
        {topSources.length > 0 ? <div className="source-overview__list">{topSources.map((source) => (
          <div className="source-overview__row" key={source.id}>
            <span className="source-overview__mark">{source.title.slice(0, 1).toUpperCase()}</span>
            <strong>{source.title}</strong>
            <span className="source-overview__bar"><i style={{ width: `${Math.max(8, (source.unread_count / peakUnread) * 100)}%` }} /></span>
            <small>{source.unread_count}</small>
          </div>
        ))}</div> : <p className="source-overview__empty">{t("sourceOverviewEmpty")}</p>}
      </div>
    </section>
  )
}

function TimelineSkeleton() {
  const { t } = useTranslation()
  return <div className="timeline-skeleton" aria-label={t("loadingArticles")}>{Array.from({ length: 7 }, (_, index) => <div className="skeleton-row" key={index}><span /><span /><span /></div>)}</div>
}

function scopeContext(scope: LibraryScope, t: Translator) {
  switch (scope.kind) {
    case "feed": return t("feed")
    case "folder": return t("folder")
    case "today": return t("library")
    default: return t("smartView")
  }
}

function scopeDescription(scope: LibraryScope, t: Translator) {
  switch (scope.kind) {
    case "today": return t("todayDescription")
    case "unread": return t("unreadDescription")
    case "saved": return t("savedDescription")
    default: return t("allFeedsDescription")
  }
}

function formatRelativeTime(value: string, locale: Locale) {
  const date = new Date(value)
  const deltaMinutes = Math.round((date.getTime() - Date.now()) / 60_000)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  if (Math.abs(deltaMinutes) < 60) return formatter.format(deltaMinutes, "minute")
  const deltaHours = Math.round(deltaMinutes / 60)
  if (Math.abs(deltaHours) < 24) return formatter.format(deltaHours, "hour")
  const deltaDays = Math.round(deltaHours / 24)
  if (Math.abs(deltaDays) < 7) return formatter.format(deltaDays, "day")
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date)
}
