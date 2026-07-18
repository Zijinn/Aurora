import {
  ArrowLeft,
  ArrowSquareOut,
  BookmarkSimple,
  CheckCircle,
  CircleNotch,
  ClockCountdown,
  HighlighterCircle,
  Minus,
  NotePencil,
  Plus,
  Star,
  Tag as TagIcon,
  TextAa,
  TextAlignLeft,
  TextUnderline,
  Trash,
  Sparkle,
  Translate,
  WarningCircle,
  WaveSine,
  X,
} from "@phosphor-icons/react"
import DOMPurify from "dompurify"
import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import type { AIProfile, Entry, EntryDetail, EntryState, Tag } from "../api/types"
import {
  applyAnnotations,
  serializeSelection,
  type AnnotationStyle,
  type SerializedSelection,
} from "../lib/annotations"
import { useTranslation } from "../lib/i18n"
import { useReaderStore } from "../store/reader"
import { AIWorkbench } from "./AIWorkbench"

interface PendingSelection extends SerializedSelection {
  left: number
  top: number
}

interface ReaderPaneProps {
  summary: Entry | null
  detail?: EntryDetail
  isLoading: boolean
  error: Error | null
  mutationPending: boolean
  readabilityPending: boolean
  aiProfiles: AIProfile[]
  tags: Tag[]
  feedIconURL?: string | null
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
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null)
  const [noteEditorOpen, setNoteEditorOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState("")
  const [sourceLeadImageFailed, setSourceLeadImageFailed] = useState(false)
  const [sourceIconFailed, setSourceIconFailed] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const readerAppearance = useReaderStore((state) => state.readerAppearance)
  const setReaderAppearance = useReaderStore((state) => state.setReaderAppearance)
  const annotations = useReaderStore((state) => state.annotations)
  const addAnnotation = useReaderStore((state) => state.addAnnotation)
  const removeAnnotation = useReaderStore((state) => state.removeAnnotation)
  const entry = props.detail ?? props.summary
  const sourceImage =
    entry?.lead_image_url && !sourceLeadImageFailed
      ? { url: entry.lead_image_url, kind: "lead" as const }
      : props.feedIconURL && !sourceIconFailed
        ? { url: props.feedIconURL, kind: "icon" as const }
        : null
  const entryAnnotations = useMemo(
    () => annotations.filter((annotation) => annotation.entryID === entry?.id),
    [annotations, entry?.id],
  )
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
  useEffect(() => {
    if (contentRef.current) applyAnnotations(contentRef.current, entryAnnotations)
  }, [entryAnnotations, safeHTML])
  const captureSelection = useCallback(() => {
    window.setTimeout(() => {
      const root = contentRef.current
      const selection = window.getSelection()
      if (!root || !selection || selection.isCollapsed || selection.rangeCount === 0) {
        setPendingSelection(null)
        return
      }
      const range = selection.getRangeAt(0)
      const serialized = serializeSelection(root, range)
      if (!serialized) {
        setPendingSelection(null)
        return
      }
      const rect =
        typeof range.getBoundingClientRect === "function"
          ? range.getBoundingClientRect()
          : root.getBoundingClientRect()
      setPendingSelection({
        ...serialized,
        left: Math.min(Math.max(rect.left + rect.width / 2, 150), window.innerWidth - 150),
        top: Math.max(62, rect.top - 10),
      })
      setNoteEditorOpen(false)
      setNoteDraft("")
    }, 0)
  }, [])

  const createAnnotation = (style: AnnotationStyle, note = "") => {
    if (!entry || !pendingSelection) return
    addAnnotation({
      id: window.crypto.randomUUID?.() ?? `${entry.id}-${Date.now()}`,
      entryID: entry.id,
      quote: pendingSelection.quote,
      prefix: pendingSelection.prefix,
      suffix: pendingSelection.suffix,
      style,
      note: note.trim(),
      createdAt: new Date().toISOString(),
    })
    setPendingSelection(null)
    setNoteEditorOpen(false)
    setNoteDraft("")
    window.getSelection()?.removeAllRanges()
  }

  const saveNote = (event: FormEvent) => {
    event.preventDefault()
    if (noteDraft.trim()) createAnnotation("highlight", noteDraft)
  }

  const scrollToAnnotation = (annotationID: string) => {
    const target = Array.from(
      contentRef.current?.querySelectorAll<HTMLElement>("[data-aurora-annotation]") ?? [],
    ).find((element) => element.dataset.auroraAnnotation === annotationID)
    target?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    })
  }

  const readerStyle = {
    "--reader-content-font":
      readerAppearance.fontFamily === "serif" ? "var(--font-reader)" : "var(--font-ui)",
    "--reader-content-size": `${readerAppearance.fontSize}px`,
    "--reader-content-leading": readerAppearance.lineHeight,
  } as CSSProperties
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
    <article
      className={
        appearanceOpen
          ? "reader reader--article reader--inspector-open"
          : "reader reader--article"
      }
      aria-label={t("reader")}
      style={readerStyle}
    >
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
        <button
          className={appearanceOpen ? "icon-button icon-button--active" : "icon-button"}
          type="button"
          aria-label={t("readerAppearance")}
          title={t("readerAppearance")}
          aria-expanded={appearanceOpen}
          onClick={() => setAppearanceOpen((open) => !open)}
        >
          <TextAa />
        </button>
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
      {appearanceOpen && (
        <aside className="reader-inspector" aria-label={t("readerAppearance")}>
          <header className="reader-inspector__header">
            <div>
              <span>{t("readerAppearance")}</span>
              <strong>{entryAnnotations.length}</strong>
            </div>
            <button
              className="icon-button icon-button--small"
              type="button"
              aria-label={t("close")}
              title={t("close")}
              onClick={() => setAppearanceOpen(false)}
            >
              <X />
            </button>
          </header>
          <section className="reader-inspector__section">
            <h2>{t("fontFamily")}</h2>
            <div className="reader-font-choice" role="group" aria-label={t("fontFamily")}>
              <button
                type="button"
                aria-pressed={readerAppearance.fontFamily === "serif"}
                onClick={() => setReaderAppearance({ fontFamily: "serif" })}
              >
                {t("serifFont")}
              </button>
              <button
                type="button"
                aria-pressed={readerAppearance.fontFamily === "sans"}
                onClick={() => setReaderAppearance({ fontFamily: "sans" })}
              >
                {t("sansSerifFont")}
              </button>
            </div>
          </section>
          <section className="reader-inspector__section reader-inspector__range">
            <div>
              <h2>{t("fontSize")}</h2>
              <output>{readerAppearance.fontSize}</output>
            </div>
            <span>
              <Minus />
              <input
                type="range"
                min="16"
                max="24"
                step="1"
                aria-label={t("fontSize")}
                value={readerAppearance.fontSize}
                onChange={(event) =>
                  setReaderAppearance({ fontSize: Number(event.target.value) })
                }
              />
              <Plus />
            </span>
          </section>
          <section className="reader-inspector__section reader-inspector__range">
            <div>
              <h2>{t("lineSpacing")}</h2>
              <output>{readerAppearance.lineHeight.toFixed(1)}</output>
            </div>
            <span>
              <TextAlignLeft />
              <input
                type="range"
                min="1.5"
                max="2.1"
                step="0.1"
                aria-label={t("lineSpacing")}
                value={readerAppearance.lineHeight}
                onChange={(event) =>
                  setReaderAppearance({ lineHeight: Number(event.target.value) })
                }
              />
              <TextAlignLeft />
            </span>
          </section>
          <section className="reader-inspector__section reader-annotation-list">
            <h2>{t("annotations")}</h2>
            {entryAnnotations.map((annotation) => (
              <div className="reader-annotation-item" key={annotation.id}>
                <button type="button" onClick={() => scrollToAnnotation(annotation.id)}>
                  <AnnotationStyleIcon style={annotation.style} />
                  <span>
                    <strong>{annotation.quote}</strong>
                    {annotation.note && <small>{annotation.note}</small>}
                  </span>
                </button>
                <button
                  className="icon-button icon-button--small"
                  type="button"
                  aria-label={t("deleteAnnotation")}
                  title={t("deleteAnnotation")}
                  onClick={() => removeAnnotation(annotation.id)}
                >
                  <Trash />
                </button>
              </div>
            ))}
            {entryAnnotations.length === 0 && (
              <p className="reader-annotation-empty">{t("noAnnotations")}</p>
            )}
          </section>
        </aside>
      )}
      <div className="reader-scroll">
        <header className="article-header">
          <div className="article-header__source-row">
            <span className="article-header__source-mark" aria-hidden="true">
              {sourceImage ? (
                <img
                  src={sourceImage.url}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => {
                    if (sourceImage.kind === "lead") setSourceLeadImageFailed(true)
                    else setSourceIconFailed(true)
                  }}
                />
              ) : (
                entry.feed_title.slice(0, 1).toUpperCase()
              )}
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
          <div
            ref={contentRef}
            className="article-content"
            onPointerUp={captureSelection}
            dangerouslySetInnerHTML={{ __html: safeHTML }}
          />
        ) : (
          <div ref={contentRef} className="article-content" onPointerUp={captureSelection}>
            <p>{entry.summary ?? t("noArticleContent")}</p>
          </div>
        )}
      </div>
      {pendingSelection && (
        <div
          className="reader-selection-tools"
          role="toolbar"
          aria-label={t("annotateSelection")}
          style={{ left: pendingSelection.left, top: pendingSelection.top }}
        >
          {!noteEditorOpen ? (
            <>
              <button
                type="button"
                aria-label={t("highlight")}
                title={t("highlight")}
                onClick={() => createAnnotation("highlight")}
              >
                <HighlighterCircle weight="fill" />
              </button>
              <button
                type="button"
                aria-label={t("underline")}
                title={t("underline")}
                onClick={() => createAnnotation("underline")}
              >
                <TextUnderline />
              </button>
              <button
                type="button"
                aria-label={t("wavyUnderline")}
                title={t("wavyUnderline")}
                onClick={() => createAnnotation("wavy")}
              >
                <WaveSine />
              </button>
              <button
                type="button"
                aria-label={t("addNote")}
                title={t("addNote")}
                onClick={() => setNoteEditorOpen(true)}
              >
                <NotePencil />
              </button>
            </>
          ) : (
            <form className="reader-selection-note" onSubmit={saveNote}>
              <input
                autoFocus
                value={noteDraft}
                placeholder={t("notePlaceholder")}
                aria-label={t("addNote")}
                onChange={(event) => setNoteDraft(event.target.value)}
              />
              <button type="submit" disabled={!noteDraft.trim()}>
                {t("saveNote")}
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  )
}

function AnnotationStyleIcon(props: { style: AnnotationStyle }) {
  if (props.style === "underline") return <TextUnderline />
  if (props.style === "wavy") return <WaveSine />
  return <HighlighterCircle weight="fill" />
}
