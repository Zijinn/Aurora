import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Books,
  CalendarBlank,
  ChartPieSlice,
  NotePencil,
  PaperPlaneTilt,
} from "@phosphor-icons/react"
import { useCallback, useMemo, useState } from "react"

import {
  createResearchPaper,
  deleteResearchPaper,
  fetchResearchCitation,
  listPreferences,
  listResearchPapers,
  moveResearchPaper,
  putPreference,
  reorderResearchPapers,
  updateResearchPaper,
} from "../../api/client"
import type { ResearchKind, ResearchPaperPatch } from "../../api/types"
import { useTranslation } from "../../lib/i18n"
import { useOnlineState } from "../../lib/online"
import { isEnglishPaper, normalizeDoi } from "../../lib/research"
import { toast } from "../../store/toast"
import { ConfirmDialog } from "../ConfirmDialog"
import { CalendarPage } from "./CalendarPage"
import { Dashboard } from "./Dashboard"
import { PublishedPage } from "./PublishedPage"
import { ResearchPage } from "./ResearchPage"
import { SubmittedPage } from "./SubmittedPage"

type WorkbenchTab = "dashboard" | "research" | "submitted" | "published" | "calendar"

const TABS: Array<{ id: WorkbenchTab; labelKey: string; Icon: typeof Books }> = [
  { id: "dashboard", labelKey: "researchOverview", Icon: ChartPieSlice },
  { id: "research", labelKey: "workingPapers", Icon: NotePencil },
  { id: "submitted", labelKey: "submissions", Icon: PaperPlaneTilt },
  { id: "published", labelKey: "publications", Icon: Books },
  { id: "calendar", labelKey: "calendar", Icon: CalendarBlank },
]

export function Workbench() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const online = useOnlineState()
  const [tab, setTab] = useState<WorkbenchTab>("dashboard")
  const [focusPaperID, setFocusPaperID] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ message: string; action: () => void } | null>(null)
  const [batchPending, setBatchPending] = useState(false)
  // Stable so the submissions page's jump effect does not re-run every render.
  const clearFocus = useCallback(() => setFocusPaperID(null), [])

  const kinds: ResearchKind[] = ["research", "submitted", "published"]
  const results = useQueries({
    queries: kinds.map((kind) => ({
      queryKey: ["research", kind],
      queryFn: ({ signal }: { signal: AbortSignal }) => listResearchPapers(kind, signal),
    })),
  })
  const research = results[0]?.data?.items ?? []
  const submitted = results[1]?.data?.items ?? []
  const published = results[2]?.data?.items ?? []
  const isLoading = results.some((result) => result.isPending)
  const hasError = results.some((result) => result.isError)
  const retryAll = () => {
    for (const result of results) void result.refetch()
  }

  const preferences = useQuery({
    queryKey: ["preferences"],
    queryFn: ({ signal }) => listPreferences(signal),
  })
  const crossrefEmail = useMemo(() => {
    const raw = preferences.data?.items?.["crossref_email"]
    return typeof raw === "string" ? raw : ""
  }, [preferences.data])

  const invalidate = (kind: ResearchKind) =>
    queryClient.invalidateQueries({ queryKey: ["research", kind] })
  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: ["research"] })

  // The workbench has no offline outbox: writes must reach the server
  // immediately, so guard mutating entry points and tell the user why an
  // action did nothing while the browser is offline.
  const requireOnline = (): boolean => {
    if (online) return true
    toast(t("workbenchOfflineHint"))
    return false
  }

  const createMutation = useMutation({
    mutationFn: (kind: ResearchKind) => createResearchPaper({ kind }),
    onSuccess: (_paper, kind) => void invalidate(kind),
    onError: () => toast(t("createPaperFailed")),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ResearchPaperPatch }) =>
      updateResearchPaper(id, patch),
    onSuccess: (paper) => void invalidate(paper.kind),
    onError: () => toast(t("updatePaperFailed")),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteResearchPaper(id),
    onSuccess: () => void invalidateAll(),
    onError: () => toast(t("deletePaperFailed")),
  })
  const reorderMutation = useMutation({
    mutationFn: ({ kind, ids }: { kind: ResearchKind; ids: string[] }) =>
      reorderResearchPapers(kind, ids),
    onSuccess: (_result, { kind }) => void invalidate(kind),
    onError: () => toast(t("reorderFailed")),
  })
  const moveMutation = useMutation({
    mutationFn: (id: string) => {
      const kind: ResearchKind = tab === "research" ? "submitted" : "published"
      return moveResearchPaper(id, kind)
    },
    onSuccess: () => void invalidateAll(),
    onError: () => toast(t("moveFailed")),
  })
  const citationMutation = useMutation({
    mutationFn: (id: string) => fetchResearchCitation(id),
    onSuccess: (paper) => {
      void invalidate(paper.kind)
      toast(t("citationUpdated"))
    },
    onError: () => toast(t("citationFetchFailed")),
  })
  const emailMutation = useMutation({
    mutationFn: (email: string) => putPreference("crossref_email", email),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["preferences"] }),
    onError: () => toast(t("emailSaveFailed")),
  })

  const requestConfirm = (message: string, action: () => void) => setConfirm({ message, action })

  const create = (kind: ResearchKind) => {
    if (!requireOnline()) return
    createMutation.mutate(kind)
  }
  const update = (id: string, patch: ResearchPaperPatch) => {
    if (!requireOnline()) return
    updateMutation.mutate({ id, patch })
  }
  const remove = (id: string) => {
    if (!requireOnline()) return
    requestConfirm(t("deletePaperConfirm"), () => deleteMutation.mutate(id))
  }
  const reorder = (kind: ResearchKind, ids: string[]) => {
    if (!requireOnline()) return
    reorderMutation.mutate({ kind, ids })
  }
  const move = (id: string) => {
    if (!requireOnline()) return
    const message = tab === "research" ? t("flowToSubmittedConfirm") : t("flowToPublishedConfirm")
    requestConfirm(message, () => moveMutation.mutate(id))
  }
  const fetchCitation = (id: string) => {
    if (!requireOnline()) return
    citationMutation.mutate(id)
  }
  const creating = createMutation.isPending
  const fetchAllCitations = async () => {
    if (!requireOnline()) return
    if (!crossrefEmail) {
      toast(t("citationNoEmail"))
      return
    }
    const eligible = published.filter((p) => isEnglishPaper(p) && normalizeDoi(p.doi))
    if (eligible.length === 0) {
      toast(t("citationsBatchNoneEligible"))
      return
    }
    setBatchPending(true)
    let ok = 0
    let failed = 0
    // Sequential on purpose: Crossref is rate-limited and the polite pool
    // expects modest concurrency.
    for (const paper of eligible) {
      try {
        await fetchResearchCitation(paper.id)
        ok += 1
      } catch {
        failed += 1
      }
    }
    setBatchPending(false)
    void invalidate("published")
    const message =
      failed > 0
        ? `${ok} ${t("citationsBatchUpdated")} · ${failed} ${t("citationsBatchFailed")}`
        : `${ok} ${t("citationsBatchUpdated")}`
    toast(message)
  }
  const saveEmail = (email: string) => {
    if (!requireOnline()) return
    emailMutation.mutate(email)
  }

  const subtitle: Record<WorkbenchTab, string> = {
    dashboard: t("researchOverviewSubtitle"),
    research: t("workingPapersSubtitle"),
    submitted: t("submissionsSubtitle"),
    published: t("publicationsSubtitle"),
    calendar: t("calendarSubtitle"),
  }
  const title: Record<WorkbenchTab, string> = {
    dashboard: t("researchOverview"),
    research: t("workingPapers"),
    submitted: t("submissions"),
    published: t("publications"),
    calendar: t("calendar"),
  }

  return (
    <div className="wb-shell">
      <div className="wb-main">
        <nav className="wb-nav" aria-label={t("workbench")}>
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`wb-nav-item ${tab === entry.id ? "wb-nav-item--active" : ""}`}
              aria-current={tab === entry.id ? "page" : undefined}
              onClick={() => setTab(entry.id)}
            >
              <entry.Icon size={15} weight={tab === entry.id ? "fill" : "regular"} />
              <span>{t(entry.labelKey)}</span>
            </button>
          ))}
        </nav>
        {!online && (
          <div className="offline-banner" role="status">
            {t("workbenchOfflineHint")}
          </div>
        )}
        <header className="wb-header">
          <div>
            <div className="wb-eyebrow">{t("eyebrowPersonalManagement")}</div>
            <h1>{title[tab]}</h1>
            <p>{subtitle[tab]}</p>
          </div>
          <div className="wb-status-bar">
            <div className="wb-status-item">
              <strong>{research.length}</strong>
              <span>{t("researchCount")}</span>
            </div>
            <div className="wb-status-item">
              <strong>{submitted.length}</strong>
              <span>{t("submittedCount")}</span>
            </div>
            <div className="wb-status-item">
              <strong>{published.length}</strong>
              <span>{t("publishedCount")}</span>
            </div>
          </div>
        </header>
        <section className="wb-content">
          {hasError ? (
            <div className="wb-empty" role="alert">
              <p>{t("papersLoadFailed")}</p>
              <button type="button" className="wb-btn" onClick={retryAll}>
                {t("retry")}
              </button>
            </div>
          ) : isLoading ? (
            <div className="wb-empty">{t("loading")}</div>
          ) : (
            <>
              {tab === "dashboard" && (
                <Dashboard research={research} submitted={submitted} published={published} />
              )}
              {tab === "research" && (
                <ResearchPage
                  papers={research}
                  offline={!online}
                  creating={creating}
                  onCreate={() => create("research")}
                  onUpdate={update}
                  onDelete={remove}
                  onReorder={(ids) => reorder("research", ids)}
                  onMove={move}
                />
              )}
              {tab === "submitted" && (
                <SubmittedPage
                  papers={submitted}
                  offline={!online}
                  creating={creating}
                  focusPaperID={focusPaperID}
                  onFocusConsumed={clearFocus}
                  onCreate={() => create("submitted")}
                  onUpdate={update}
                  onDelete={remove}
                  onReorder={(ids) => reorder("submitted", ids)}
                  onMove={move}
                />
              )}
              {tab === "published" && (
                <PublishedPage
                  papers={published}
                  offline={!online}
                  creating={creating}
                  crossrefEmail={crossrefEmail}
                  citationPendingID={
                    citationMutation.isPending ? (citationMutation.variables ?? null) : null
                  }
                  onCreate={() => create("published")}
                  onUpdate={update}
                  onDelete={remove}
                  onReorder={(ids) => reorder("published", ids)}
                  onFetchCitation={fetchCitation}
                  onFetchAllCitations={() => void fetchAllCitations()}
                  batchCitationPending={batchPending}
                  onCrossrefEmailChange={saveEmail}
                />
              )}
              {tab === "calendar" && (
                <CalendarPage
                  papers={submitted}
                  onSelectPaper={(id) => {
                    setFocusPaperID(id)
                    setTab("submitted")
                  }}
                />
              )}
            </>
          )}
        </section>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        message={confirm?.message ?? ""}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        onConfirm={() => {
          const action = confirm?.action
          setConfirm(null)
          action?.()
        }}
      />
    </div>
  )
}
