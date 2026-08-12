// Helpers for bibliographic metadata that arrives from feeds in loose shapes.
// Journal feeds (CNKI in particular) pack multiple authors into one string and
// repeat the abstract in both the summary and content fields.

// Mirrors SplitZoteroAuthors in internal/storage/zotero.go so display and
// Zotero export agree on what counts as a separator.
const AUTHOR_SEPARATORS = /[;；\n]/

/** Splits a feed author string into individual names, dropping empty segments. */
export function splitAuthors(value: string | null | undefined): string[] {
  if (!value) return []
  const seen = new Set<string>()
  const authors: string[] = []
  for (const part of value.split(AUTHOR_SEPARATORS)) {
    const cleaned = part.trim()
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned)
      authors.push(cleaned)
    }
  }
  return authors
}

/**
 * Formats a feed author string for display. CNKI emits "李世杰;吴楚豪;" with a
 * trailing separator, which renders verbatim without this cleanup.
 */
export function formatAuthors(value: string | null | undefined): string | null {
  const authors = splitAuthors(value)
  return authors.length > 0 ? authors.join(" · ") : null
}

function normalizeForCompare(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase()
}

/** Strips tags from feed HTML so its text can be compared with a summary. */
export function htmlToText(html: string): string {
  if (!html) return ""
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]*>/g, " ")
  return new DOMParser().parseFromString(html, "text/html").body.textContent ?? ""
}

/**
 * Reports whether a summary merely repeats the start of the article body.
 *
 * The backend derives summary as the first 360 runes of the plain text
 * (internal/feed/parser.go), so for abstract-only journal feeds the summary is a
 * prefix of the content and showing both duplicates the whole abstract.
 */
export function summaryDuplicatesContent(
  summary: string | null | undefined,
  contentHTML: string | null | undefined,
): boolean {
  if (!summary || !contentHTML) return false
  // Drop the ellipsis truncateText appends before comparing.
  const normalizedSummary = normalizeForCompare(summary.replace(/(\.{3}|…)$/, ""))
  if (normalizedSummary.length === 0) return false
  const normalizedContent = normalizeForCompare(htmlToText(contentHTML))
  if (normalizedContent.length === 0) return false
  return normalizedContent.startsWith(normalizedSummary) || normalizedContent === normalizedSummary
}
