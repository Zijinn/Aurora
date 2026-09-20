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
