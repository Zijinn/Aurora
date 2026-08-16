import type { AIResult } from "../api/types"

export function formatAIResult(result: AIResult) {
  if (result.operation !== "academic_tags") return result.result_text
  try {
    const value = JSON.parse(result.result_text) as unknown
    const tags = Array.isArray(value)
      ? value
      : value && typeof value === "object" && Array.isArray((value as { tags?: unknown }).tags)
        ? (value as { tags: unknown[] }).tags
        : []
    const names = tags.filter((tag): tag is string => typeof tag === "string")
    return names.length > 0 ? names.join(" / ") : result.result_text
  } catch {
    return result.result_text
  }
}
