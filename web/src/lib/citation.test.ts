import { expect, it } from "vitest"

import type { Entry } from "../api/types"
import { formatBibTeX, formatGBT7714 } from "./citation"

const entry: Entry = {
  id: "entry-1",
  feed_id: "feed-1",
  feed_title: "经济研究",
  canonical_url: "https://journal.example.com/article/1",
  title: "数据要素市场化配置与福利效应研究",
  author: "李世杰; 吴楚豪",
  summary: null,
  published_at: "2026-03-15T00:00:00Z",
  discovered_at: "2026-03-16T00:00:00Z",
  lead_image_url: null,
  doi: "10.12345/jer.2026.03.01",
  tag_ids: [],
  state: { is_read: false, is_starred: false, is_read_later: false, updated_at: "" },
}

it("formats a BibTeX article entry with DOI", () => {
  const bib = formatBibTeX(entry)
  expect(bib).toContain("@article{entry2026,")
  expect(bib).toContain('author = {李世杰 and 吴楚豪}')
  expect(bib).toContain("journaltitle = {经济研究}")
  expect(bib).toContain("year = {2026}")
  expect(bib).toContain("doi = {10.12345/jer.2026.03.01}")
  expect(bib).toContain("url = {https://journal.example.com/article/1}")
})

it("formats GB/T 7714 with the DOI resolver URL", () => {
  expect(formatGBT7714(entry)).toBe(
    "李世杰, 吴楚豪. 数据要素市场化配置与福利效应研究[J/OL]. 经济研究, 2026. https://doi.org/10.12345/jer.2026.03.01.",
  )
})

it("falls back to the canonical URL when no DOI is present", () => {
  const withoutDOI = { ...entry, doi: undefined }
  expect(formatBibTeX(withoutDOI)).not.toContain("doi =")
  expect(formatGBT7714(withoutDOI)).toContain("https://journal.example.com/article/1.")
})
