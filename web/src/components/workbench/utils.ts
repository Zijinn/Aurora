import type { ResearchPaper } from "../../api/types"

// Whitelisted free-text fields for the workbench search boxes. JSON.stringify
// over the whole paper also matched ids, timestamps and booleans, which made
// results unpredictable (and leaked stage/history internals).
export function matchesPaperQuery(paper: ResearchPaper, query: string): boolean {
  const haystack = [
    paper.title,
    paper.authors.join(" "),
    paper.keywords.join(" "),
    paper.notes,
    paper.research_area,
    paper.target_journal,
    paper.current_journal,
    paper.journal,
    paper.manuscript_id,
    paper.next_action,
    paper.doi,
  ]
    .join("\n")
    .toLowerCase()
  return haystack.includes(query)
}

export function reorderList<T extends { id: string }>(
  list: T[],
  fromID: string,
  toID: string,
  before: boolean,
): T[] {
  const from = list.findIndex((item) => item.id === fromID)
  let to = list.findIndex((item) => item.id === toID)
  if (from < 0 || to < 0 || from === to) return list
  const next = list.slice()
  const [node] = next.splice(from, 1)
  if (from < to) to -= 1
  next.splice(before ? to : to + 1, 0, node!)
  return next
}

export function displayID(kind: string, index: number): string {
  const prefix = kind === "research" ? "R" : kind === "submitted" ? "S" : "P"
  return prefix + String(index + 1).padStart(3, "0")
}

// Deadlines are free text like submission_date; the calendar only trusts an
// explicit calendar date and ignores anything else (e.g. "下周三是死线").
export function parseDeadline(raw: string): Date | null {
  const match = /^\s*(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\s*$/.exec(raw ?? "")
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

export function formatDeadline(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Keeps a typed deadline storable and calendar-readable; unparseable input is
// returned trimmed so the user sees what they wrote instead of a silent wipe.
export function normalizeDeadlineInput(raw: string): string {
  const trimmed = (raw ?? "").trim()
  const date = parseDeadline(trimmed)
  return date ? formatDeadline(date) : trimmed
}

export function daysUntil(date: Date, now: Date = new Date()): number {
  const startOf = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  return Math.round((startOf(date) - startOf(now)) / 86_400_000)
}
