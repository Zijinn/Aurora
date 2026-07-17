import {
  ArrowLeft,
  ArrowSquareOut,
  BookmarkSimple,
  CheckCircle,
  CircleNotch,
  ClockCountdown,
  Star,
  Tag as TagIcon,
  TextAlignLeft,
  Sparkle,
  Translate,
  WarningCircle,
} from "@phosphor-icons/react"
import DOMPurify from "dompurify"
import { useEffect, useMemo, useState } from "react"

import type { AIProfile, Entry, EntryDetail, EntryState, Tag } from "../api/types"
import { useTranslation } from "../lib/i18n"
import { AIWorkbench } from "./AIWorkbench"

interface ReaderPaneProps {
  summary: Entry | null
  detail?: EntryDetail
  isLoading: boolean
  error: Error | null
  mutationPending: boolean
  readabilityPending: boolean
  aiProfiles: AIProfile[]
  tags: Tag[]
  onBack: () => void
  onRetry: () => void
  onStateChange: (entry: Entry, patch: Partial<EntryState>) => void
  onTagsChange: (entryID: string, tagIDs: string[]) => void
  onFetchReadability: (entryID: string) => void
  onConfigureAI: () => void
}

export function ReaderPane(props: ReaderPaneProps) {
  const { locale, t } = useTranslation()
  const { detail, onStateChange } = props
  const [preferReadability, setPreferReadability] = useState(true)
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const entry = props.detail ?? props.summary
  const safeHTML = useMemo(
    () =>
      DOMPurify.sanitize(
        (preferReadability ? props.detail?.readability_html : null) ??
          props.detail?.sanitized_html ??
          "",
        { USE_PROFILES: { html: true, mathMl: true } },
      ),
    [preferReadability, props.detail],
  )
  useEffect(() => {
    if (detail && !detail.state.is_read) onStateChange(detail, { is_read: true })
  }, [detail, onStateChange])
  if (!entry) {
    return (
      <article className="reader reader--placeholder" aria-label={t("reader")}>
        <div className="reader__placeholder">
          <BookmarkSimple />
          <p>{t("selectArticle")}</p>
        </div>
      </article>
    )
  }
  if (props.isLoading) {
    return (
      <article className="reader reader--placeholder" aria-label={t("reader")}>
        <CircleNotch className="spin reader__loader" aria-label={t("loadingArticle")} />
      </article>
    )
  }
  if (props.error) {
    return (
      <article className="reader reader--placeholder" aria-label={t("reader")}>
        <div className="pane-state" role="alert">
          <WarningCircle />
          <h2>{t("articleUnavailable")}</h2>
          <p>{props.error.message}</p>
          <button className="button button--secondary" type="button" onClick={props.onRetry}>
            {t("retry")}
          </button>
        </div>
      </article>
    )
  }
  return (
    <article className="reader reader--article" aria-label={t("reader")}>
      <div className="reader-toolbar">
        <button
          className="icon-button reader-back"
          type="button"
          aria-label={t("backToTimeline")}
          title={t("backToTimeline")}
          onClick={props.onBack}
        >
          <ArrowLeft />
        </button>
        <div className="reader-toolbar__spacer" />
        <div className="reader-tag-menu">
          <button
            className={entry.tag_ids.length > 0 ? "icon-button icon-button--active" : "icon-button"}
            type="button"
            aria-label={t("editArticleTags")}
            title={t("tagsTitle")}
            aria-expanded={tagPickerOpen}
            disabled={props.tags.length === 0 || props.mutationPending}
            onClick={() => setTagPickerOpen((open) => !open)}
          >
            <TagIcon weight={entry.tag_ids.length > 0 ? "fill" : "regular"} />
          </button>
          {tagPickerOpen && (
            <div className="reader-tag-picker" role="group" aria-label={t("articleTags")}>
              {props.tags.map((tag) => {
                const checked = entry.tag_ids.includes(tag.id)
                return (
                  <label key={tag.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={props.mutationPending}
                      onChange={() =>
                        props.onTagsChange(
                          entry.id,
                          checked
                            ? entry.tag_ids.filter((tagID) => tagID !== tag.id)
                            : [...entry.tag_ids, tag.id],
                        )
                      }
                    />
                    <span
                      className="organization-swatch"
                      style={tag.color ? { backgroundColor: tag.color } : undefined}
                    />
                    <span>{tag.name}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
        <button
          className={
            detail?.readability_html && preferReadability
              ? "icon-button icon-button--active"
              : "icon-button"
          }
          type="button"
          aria-label={
            detail?.readability_html
              ? preferReadability
                ? t("useFeedContent")
                : t("useFullText")
              : t("fetchFullText")
          }
          title={
            detail?.readability_html
              ? preferReadability
                ? t("useFeedContent")
                : t("useFullText")
              : t("fetchFullText")
          }
          disabled={props.readabilityPending || !entry.canonical_url}
          onClick={() =>
            detail?.readability_html
              ? setPreferReadability((value) => !value)
              : props.onFetchReadability(entry.id)
          }
        >
          {props.readabilityPending ? <CircleNotch className="spin" /> : <TextAlignLeft />}
        </button>
        <button
          className={entry.state.is_starred ? "icon-button icon-button--active" : "icon-button"}
          type="button"
          aria-label={entry.state.is_starred ? t("removeStar") : t("starArticle")}
          title={entry.state.is_starred ? t("removeStar") : t("starArticle")}
          disabled={props.mutationPending}
          onClick={() => props.onStateChange(entry, { is_starred: !entry.state.is_starred })}
        >
          <Star weight={entry.state.is_starred ? "fill" : "regular"} />
        </button>
        <button
          className={entry.state.is_read_later ? "icon-button icon-button--active" : "icon-button"}
          type="button"
          aria-label={entry.state.is_read_later ? t("removeReadLater") : t("readLater")}
          title={entry.state.is_read_later ? t("removeReadLater") : t("readLater")}
          disabled={props.mutationPending}
          onClick={() => props.onStateChange(entry, { is_read_later: !entry.state.is_read_later })}
        >
          <ClockCountdown weight={entry.state.is_read_later ? "fill" : "regular"} />
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label={entry.state.is_read ? t("markUnread") : t("markRead")}
          title={entry.state.is_read ? t("markUnread") : t("markRead")}
          disabled={props.mutationPending}
          onClick={() => props.onStateChange(entry, { is_read: !entry.state.is_read })}
        >
          <CheckCircle weight={entry.state.is_read ? "fill" : "regular"} />
        </button>
        {entry.canonical_url && (
          <a
            className="icon-button"
            href={entry.canonical_url}
            target="_blank"
            rel="noreferrer"
            aria-label={t("openOriginalArticle")}
            title={t("openOriginal")}
          >
            <ArrowSquareOut />
          </a>
        )}
      </div>
      <div className="reader-scroll">
        <header className="article-header">
          <div className="article-header__source-row">
            <span className="article-header__source-mark" aria-hidden="true">
              {entry.feed_title.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="article-header__source">{entry.feed_title}</p>
              <div className="article-header__meta">
                {entry.author && <span>{entry.author}</span>}
                <time dateTime={entry.published_at}>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(entry.published_at))}
                </time>
              </div>
            </div>
          </div>
          <h1>{entry.title || t("untitled")}</h1>
          {entry.ai_translated_title && (
            <p className="article-header__translation">
              <Translate />
              {entry.ai_translated_title}
            </p>
          )}
          {(entry.ai_summary || entry.summary) && (
            <div
              className={
                entry.ai_summary
                  ? "article-header__summary article-header__summary--ai"
                  : "article-header__summary"
              }
            >
              {entry.ai_summary && (
                <strong>
                  <Sparkle weight="fill" />
                  {t("aiSummary")}
                </strong>
              )}
              <p>{entry.ai_summary ?? entry.summary}</p>
            </div>
          )}
        </header>
        <AIWorkbench
          key={entry.id}
          entryID={entry.id}
          profiles={props.aiProfiles}
          onConfigure={props.onConfigureAI}
        />
        {safeHTML ? (
          <div className="article-content" dangerouslySetInnerHTML={{ __html: safeHTML }} />
        ) : (
          <div className="article-content">
            <p>{entry.summary ?? t("noArticleContent")}</p>
          </div>
        )}
      </div>
    </article>
  )
}
