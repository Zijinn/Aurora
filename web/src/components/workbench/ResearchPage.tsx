import { useMemo, useState } from "react"

import type { ResearchPaper, ResearchPaperPatch } from "../../api/types"
import { useTranslation } from "../../lib/i18n"
import { toast } from "../../store/toast"
import { Card, ChipEditor, InlineText } from "./shared"
import { displayID, matchesPaperQuery, reorderList } from "./utils"
import { StageTree } from "./StageTree"

const PRIORITIES = ["High", "Medium", "Average"]

export function ResearchPage(props: {
  papers: ResearchPaper[]
  offline?: boolean
  onCreate: () => void
  onUpdate: (id: string, patch: ResearchPaperPatch) => void
  onDelete: (id: string) => void
  onReorder: (orderedIDs: string[]) => void
  onMove: (id: string) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [priority, setPriority] = useState("")

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim()
    return props.papers.filter((paper) => {
      if (priority && paper.priority !== priority) return false
      if (!query) return true
      return matchesPaperQuery(paper, query)
    })
  }, [props.papers, search, priority])

  const reorder = (fromID: string, toID: string, before: boolean) => {
    props.onReorder(reorderList(props.papers, fromID, toID, before).map((p) => p.id))
  }

  const copyPath = (path: string) => {
    if (!path) return
    void navigator.clipboard?.writeText(path).then(() => toast(t("pathCopied")))
  }

  return (
    <div>
      <div className="wb-toolbar">
        <input
          className="wb-search"
          placeholder={t("searchPapers")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="wb-select"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="">{t("allPriorities")}</option>
          {PRIORITIES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
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
      <div className="wb-cards-grid">
        {filtered.length === 0 ? (
          <div className="wb-empty">{t("noMatchingPapers")}</div>
        ) : (
          filtered.map((paper) => {
            const index = props.papers.findIndex((p) => p.id === paper.id)
            return (
              <Card key={paper.id} id={paper.id} onReorder={reorder}>
                <div className="wb-card-top">
                  <div>
                    <div className="wb-card-eyebrow">
                      {displayID("research", index)} · {t("eyebrowResearchProject")}
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
                    <select
                      className={`wb-select wb-priority wb-priority--${paper.priority || "Medium"}`}
                      value={paper.priority || "Medium"}
                      onChange={(e) => props.onUpdate(paper.id, { priority: e.target.value })}
                    >
                      {PRIORITIES.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="wb-icon-btn"
                      title={t("delete")}
                      aria-label={`${t("delete")}: ${paper.title || displayID("research", index)}`}
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
                  <span className="wb-muted">{t("targetJournal")}</span>
                  <strong>
                    <InlineText
                      value={paper.target_journal}
                      placeholder={t("fillPlaceholder")}
                      onCommit={(value) => props.onUpdate(paper.id, { target_journal: value })}
                    />
                  </strong>
                </div>
                <div className="wb-card-line">
                  <span className="wb-muted">{t("lastUpdatedLabel")}</span>
                  <strong>{paper.last_updated || "—"}</strong>
                </div>
                <StageTree
                  stages={paper.stages}
                  onChange={(stages) => props.onUpdate(paper.id, { stages })}
                />
                <div className="wb-next-action">
                  <b>{t("nextAction")}</b>
                  <InlineText
                    value={paper.next_action}
                    placeholder={t("fillPlaceholder")}
                    onCommit={(value) => props.onUpdate(paper.id, { next_action: value })}
                  />
                </div>
                <div className="wb-path-row">
                  <span className="wb-muted">{t("folderLabel")}</span>
                  <InlineText
                    className="wb-path-text"
                    value={paper.file_path}
                    placeholder={t("fillPlaceholder")}
                    onCommit={(value) => props.onUpdate(paper.id, { file_path: value })}
                  />
                  <button
                    type="button"
                    className="wb-btn"
                    onClick={() => copyPath(paper.file_path)}
                  >
                    {t("copyPath")}
                  </button>
                </div>
                <button
                  type="button"
                  className="wb-btn wb-flow-btn"
                  disabled={props.offline}
                  title={props.offline ? t("workbenchOfflineHint") : undefined}
                  onClick={() => props.onMove(paper.id)}
                >
                  {t("flowToSubmitted")}
                </button>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
