import { readFile } from "node:fs/promises"

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8")
const entry = html.match(/<script\b[^>]*\bsrc="\/assets\/[^"]+\.js"[^>]*>/)?.[0]

if (!entry || !entry.includes(" defer")) {
  throw new Error("production HTML must load the bundled entry as a deferred classic script")
}
if (/\btype="module"/.test(entry) || /\bcrossorigin\b/.test(entry)) {
  throw new Error("production HTML entry is not compatible with the Wails WebView")
}
if (/<link\b[^>]*\brel="stylesheet"[^>]*\bcrossorigin\b/.test(html)) {
  throw new Error("production stylesheet must not use crossorigin in the Wails WebView")
}

const entryPath = entry.match(/\bsrc="([^"]+)"/)?.[1]
const javascript = await readFile(new URL(`../dist${entryPath}`, import.meta.url), "utf8")
if (/(^|[;}])\s*(import|export)(\s|[{*])/.test(javascript) || /\bimport\.meta\b/.test(javascript)) {
  throw new Error("production entry contains ESM syntax that cannot run as a classic script")
}
