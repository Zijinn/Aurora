import { useMemo, useState } from "react"

import type { ResearchPaper, ResearchPaperPatch } from "../../api/types"
import { useTranslation } from "../../lib/i18n"
import {
  buildGb7714Reference,
  citationSourceKey,
  isEnglishPaper,
  MANUAL_CITATION_SOURCE,
  normalizeDoi,
  sortReferences,
  type ReferenceSort,
} from "../../lib/research"
import { downloadPublicationsExport } from "../../lib/researchExport"
import { toast } from "../../store/toast"
import { Card, ChipEditor, InlineText } from "./shared"
import { displayID, matchesPaperQuery, reorderList } from "./utils"

const SORT_OPTIONS: Array<{ value: ReferenceSort; key: string }> = [
  { value: "year-desc", key: "sortYearDesc" },
  { value: "year-asc", key: "sortYearAsc" },
  { value: "solo-first", key: "sortSoloFirst" },
  { value: "coauthor-first", key: "sortCoauthorFirst" },
  { value: "author", key: "sortByAuthor" },
]

export function PublishedPage(props: {
  papers: ResearchPaper[]
  crossrefEmail: string
  citationPendingID: string | null
  offline?: boolean
  onCreate: () => void
  onUpdate: (id: string, patch: ResearchPaperPatch) => void
  onDelete: (id: string) => void
  onReorder: (orderedIDs: string[]) => void
  onFetchCitation: (id: string) => void
  onCrossrefEmailChange: (email: string) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [view, setView] = useState<"cards" | "references">("cards")
  const [sortZh, setSortZh] = useState<ReferenceSort>("year-desc")
  const [sortEn, setSortEn] = useState<ReferenceSort>("year-desc")
  // null means "no local edits yet": the input mirrors the async prop until
  // the user types, so a late-arriving crossrefEmail backfills correctly.
  const [emailDraft, setEmailDraft] = useState<string | null>(null)

  const commitEmail = (raw: string) => {
    const next = raw.trim()
    setEmailDraft(null)
    // Never PUT an empty string: that would silently wipe the stored email.
    if (!next) return
    if (next === props.crossrefEmail.trim()) return
    props.onCrossrefEmailChange(next)
  }

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim()
    if (!query) return props.papers
    return props.papers.filter((paper) => matchesPaperQuery(paper, query))
  }, [props.papers, search])

  const reorder = (fromID: string, toID: string, before: boolean) => {
    props.onReorder(reorderList(props.papers, fromID, toID, before).map((p) => p.id))
  }

  const copyAllReferences = () => {
    const zh = sortReferences(
      props.papers.filter((p) => !isEnglishPaper(p)),
      sortZh,
    )
    const en = sortReferences(
      props.papers.filter((p) => isEnglishPaper(p)),
      sortEn,
    )
    const format = (list: ResearchPaper[]) =>
      list.map((p, i) => `[${i + 1}] ${buildGb7714Reference(p)}`).join("\n")
    const parts: string[] = []
    if (zh.length) parts.push(`${t("chinesePublications")}\n${format(zh)}`)
    if (en.length) parts.push(`${t("englishPublications")}\n${format(en)}`)
    const text = parts.join("\n\n")
    if (!text) return
    void navigator.clipboard?.writeText(text).then(() => toast(t("referencesCopied")))
  }

  const exportPublications = () => {
    if (props.papers.length === 0) {
      toast(t("exportEmpty"))
      return
    }
    downloadPublicationsExport(props.papers)
    toast(t("exportDone"))
  }

  const renderCard = (paper: ResearchPaper) => {
    const index = props.papers.findIndex((p) => p.id === paper.id)
    const english = isEnglishPaper(paper)
    const doi = normalizeDoi(paper.doi)
    const combinedVolumeIssue = paper.issue ? `${paper.volume}(${paper.issue})` : paper.volume
    return (
      <Card key={paper.id} id={paper.id} onReorder={reorder}>
        <div className="wb-card-top">
          <div>
            <div className="wb-card-eyebrow">
              {displayID("published", index)} · {t("eyebrowPublication")}
            </div>
            <div className="wb-card-title">
              <InlineText
                value={paper.title}
                placeholder={t("fillPlaceholder")}
                onCommit={(title) => props.onUpdate(paper.id, { title })}
              />
            </div>
          </div>
          <div className="wb-card-actions">
            <span className="wb-badge wb-badge--green">
              <InlineText
                value={paper.year}
                placeholder={t("yearLabel")}
                onCommit={(value) => props.onUpdate(paper.id, { year: value })}
              />
            </span>
            <button
              type="button"
              className="wb-icon-btn"
              title={t("delete")}
              aria-label={`${t("delete")}: ${paper.title || displayID("published", index)}`}
              disabled={props.offline}
              onClick={() => props.onDelete(paper.id)}
            >
              ✕
            </button>
          </div>
        </div>
        <ChipEditor
          label={t("authors")}
          items={paper.authors}
          addPrompt={t("addAuthorPrompt")}
          onChange={(authors) => props.onUpdate(paper.id, { authors })}
        />
        <div className="wb-card-line">
          <span className="wb-muted">{t("journalLabel")}</span>
          <strong>
            <InlineText
              value={paper.journal}
              placeholder={t("fillPlaceholder")}
              onCommit={(value) => props.onUpdate(paper.id, { journal: value })}
            />
          </strong>
        </div>
        <div className="wb-card-line">
          <span className="wb-muted">{t("volumeIssueLabel")}</span>
          <strong>
            <InlineText
              value={combinedVolumeIssue}
              placeholder={t("fillPlaceholder")}
              onCommit={(value) => {
                const match = value.match(/^\s*([^(]*?)\s*(?:\(([^()]*)\)\s*)?$/)
                props.onUpdate(paper.id, {
                  volume: (match?.[1] ?? "").trim(),
                  issue: (match?.[2] ?? "").trim(),
                })
              }}
            />
          </strong>
        </div>
        <div className="wb-card-line">
          <span className="wb-muted">{t("pagesLabel")}</span>
          <strong>
            <InlineText
              value={paper.pages}
              placeholder={t("fillPlaceholder")}
              onCommit={(value) => props.onUpdate(paper.id, { pages: value })}
            />
          </strong>
        </div>
        <div className="wb-card-line">
          <span className="wb-muted">{t("doiLabel")}</span>
          <strong>
            <InlineText
              value={paper.doi}
              placeholder={t("fillPlaceholder")}
              onCommit={(value) => props.onUpdate(paper.id, { doi: value })}
            />
          </strong>
        </div>
        <div className={`wb-citation-box ${english ? "wb-citation--live" : "wb-citation--static"}`}>
          <div className="wb-citation-number">
            <InlineText
              value={paper.citations == null ? "" : String(paper.citations)}
              placeholder={t("fillPlaceholder")}
              onCommit={(value) =>
                props.onUpdate(paper.id, {
                  citations: value === "" ? null : Number(value) || 0,
                  // Stable enum key; the UI maps it via i18n (legacy rows may
                  // still hold the literal Chinese label).
                  citation_source: MANUAL_CITATION_SOURCE,
                })
              }
            />
          </div>
          <div className="wb-citation-label">
            {t("citationsLabel")} ·{" "}
            {english
              ? citationSourceKey(paper.citation_source) === "crossref" && paper.citation_updated_at
                ? `Crossref (${paper.citation_updated_at.slice(0, 10)})`
                : t("citationLiveHint")
              : t("citationManualHint")}
          </div>
          {english && (
            <div className="wb-citation-actions">
              <button
                type="button"
                className="wb-btn"
                disabled={props.citationPendingID === paper.id || props.offline === true}
                title={props.offline ? t("workbenchOfflineHint") : undefined}
                onClick={() => {
                  // The button only renders for English papers; non-English
                  // guidance (citationNotEnglish) is surfaced elsewhere.
                  if (!doi) {
                    toast(t("citationNoDoi"))
                    return
                  }
                  if (!props.crossrefEmail) {
                    toast(t("citationNoEmail"))
                    return
                  }
                  props.onFetchCitation(paper.id)
                }}
              >
                {props.citationPendingID === paper.id
                  ? t("updatingCrossref")
                  : t("fetchFromCrossref")}
              </button>
            </div>
          )}
        </div>
        <div>
          <div className="wb-muted wb-abstract-label">{t("abstractLabel")}</div>
          <div className="wb-abstract">
            <InlineText
              value={paper.abstract}
              placeholder={t("fillPlaceholder")}
              multiline
              onCommit={(value) => props.onUpdate(paper.id, { abstract: value })}
            />
          </div>
        </div>
        <ChipEditor
          label={t("keywords")}
          items={paper.keywords}
          addPrompt={t("addKeywordPrompt")}
          onChange={(keywords) => props.onUpdate(paper.id, { keywords })}
        />
      </Card>
    )
  }

  const renderReferenceColumn = (
    title: string,
    language: "zh" | "en",
    sortMode: ReferenceSort,
    setSort: (mode: ReferenceSort) => void,
  ) => {
    const source = props.papers.filter((p) =>
      language === "zh" ? !isEnglishPaper(p) : isEnglishPaper(p),
    )
    const list = sortReferences(source, sortMode)
    return (
      <section className="wb-reference-column">
        <div className="wb-reference-column-head">
          <div>
            <h2>{title}</h2>
            <p>
              {list.length} · {t("sequentialCoding")}
            </p>
          </div>
          <select
            className="wb-select"
            value={sortMode}
            onChange={(e) => setSort(e.target.value as ReferenceSort)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.key)}
              </option>
            ))}
          </select>
        </div>
        <ol className="wb-reference-list">
          {list.length ? (
            list.map((paper) => (
              <li key={paper.id}>
                <span className="wb-reference-text">{buildGb7714Reference(paper)}</span>
                <span className="wb-reference-meta">
                  {paper.authors.length === 1 ? t("solo") : t("coauthor")}
                </span>
              </li>
            ))
          ) : (
            <li className="wb-reference-empty">
              {language === "zh" ? t("noChinesePublications") : t("noEnglishPublications")}
            </li>
          )}
        </ol>
      </section>
    )
  }

  return (
    <div>
      <div className="wb-toolbar">
        <input
          className="wb-search"
          placeholder={t("searchPublications")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="wb-view-switch">
          <button
            type="button"
            className={`wb-view-btn ${view === "cards" ? "wb-view-btn--active" : ""}`}
            onClick={() => setView("cards")}
          >
            {t("cardsView")}
          </button>
          <button
            type="button"
            className={`wb-view-btn ${view === "references" ? "wb-view-btn--active" : ""}`}
            onClick={() => setView("references")}
          >
            {t("referenceView")}
          </button>
        </div>
        <button
          type="button"
          className="wb-btn"
          disabled={props.offline}
          title={props.offline ? t("workbenchOfflineHint") : undefined}
          onClick={exportPublications}
        >
          {t("exportPublications")}
        </button>
        <button
          type="button"
          className="wb-btn wb-btn--primary"
          disabled={props.offline}
          title={props.offline ? t("workbenchOfflineHint") : undefined}
          onClick={props.onCreate}
        >
          {t("addPaper")}
        </button>
      </div>
      <div className="wb-helper-note">{t("referenceNote")}</div>
      <div className="wb-email-row">
        <span className="wb-muted">{t("crossrefEmail")}</span>
        <input
          className="wb-email-input"
          placeholder={t("crossrefEmailPlaceholder")}
          aria-label={t("crossrefEmail")}
          value={emailDraft ?? props.crossrefEmail}
          onChange={(e) => setEmailDraft(e.target.value)}
          onBlur={(e) => commitEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEmail(e.currentTarget.value)
          }}
        />
        <span className="wb-muted">
          {props.crossrefEmail ? t("crossrefEmailSaved") : t("crossrefEmailUnset")}
        </span>
      </div>
      <div className="wb-reference-copy-row">
        <button type="button" className="wb-btn wb-btn--primary" onClick={copyAllReferences}>
          {t("copyReferences")}
        </button>
      </div>
      {view === "cards" ? (
        <div className="wb-cards-grid">
          {filtered.length === 0 ? (
            <div className="wb-empty">{t("noMatchingPapers")}</div>
          ) : (
            filtered.map(renderCard)
          )}
        </div>
      ) : (
        <div className="wb-reference-layout">
          {renderReferenceColumn(t("chinesePublications"), "zh", sortZh, setSortZh)}
          {renderReferenceColumn(t("englishPublications"), "en", sortEn, setSortEn)}
        </div>
      )}
    </div>
  )
}
