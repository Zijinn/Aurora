import { describe, expect, it } from "vitest"

import { formatAuthors, splitAuthors, summaryDuplicatesContent } from "./metadata"

describe("splitAuthors", () => {
  it("splits CNKI semicolon lists and drops the trailing separator", () => {
    expect(splitAuthors("李世杰;吴楚豪;")).toEqual(["李世杰", "吴楚豪"])
  })

  it("handles fullwidth semicolons and newlines", () => {
    expect(splitAuthors("张三；李四\n王五")).toEqual(["张三", "李四", "王五"])
  })

  it("removes duplicates and blank segments", () => {
    expect(splitAuthors("Alice;;Alice; Bob ")).toEqual(["Alice", "Bob"])
  })

  it("returns an empty list for absent values", () => {
    expect(splitAuthors(null)).toEqual([])
    expect(splitAuthors("  ")).toEqual([])
  })
})

describe("formatAuthors", () => {
  it("joins names with a middle dot", () => {
    expect(formatAuthors("李世杰;吴楚豪;")).toBe("李世杰 · 吴楚豪")
  })

  it("returns null when nothing usable remains", () => {
    expect(formatAuthors(";;")).toBeNull()
    expect(formatAuthors(undefined)).toBeNull()
  })
})

describe("summaryDuplicatesContent", () => {
  it("detects a truncated summary that prefixes the content", () => {
    const summary = "数据流动是数字经济的核心特征之一,厘清数据流动过程中..."
    const content = "<p>数据流动是数字经济的核心特征之一,厘清数据流动过程中数据价值的实现机制及其对数据产业发展的影响。</p>"
    expect(summaryDuplicatesContent(summary, content)).toBe(true)
  })

  it("treats an identical summary and content as duplicated", () => {
    expect(summaryDuplicatesContent("Same text", "<p>Same text</p>")).toBe(true)
  })

  it("keeps a summary that is not a prefix of the body", () => {
    expect(summaryDuplicatesContent("A distinct editorial note", "<p>The article body.</p>")).toBe(
      false,
    )
  })

  it("ignores whitespace and tag differences", () => {
    expect(summaryDuplicatesContent("One two three", "<p>One  two</p><p>three four</p>")).toBe(true)
  })

  it("returns false when either side is missing", () => {
    expect(summaryDuplicatesContent(null, "<p>Body</p>")).toBe(false)
    expect(summaryDuplicatesContent("Summary", "")).toBe(false)
    expect(summaryDuplicatesContent("...", "<p>Body</p>")).toBe(false)
  })
})
