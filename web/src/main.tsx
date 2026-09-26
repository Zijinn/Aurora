// Source Serif 4 backs the optional serif reading mode. Manrope was dropped: it
// sat after the system faces in --font-ui, so it never rendered a glyph.
import "@fontsource-variable/source-serif-4"
import "./styles.css"
import "./components/workbench/phase3-research.css"
import "./components/workbench/phase3-published.css"
import "./components/workbench/phase3-submitted.css"
import "./components/workbench/phase4.css"
import "./components/workbench/phase5.css"
import "./components/workbench/phase6.css"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { registerSW } from "virtual:pwa-register"

import App from "./App"
import { applyDesktopPlatform } from "./lib/desktop"

applyDesktopPlatform()
applyPersistedTheme()

// Apply the persisted theme before first paint so a dark/light preference does
// not flash the wrong palette while React boots. The AppShell effect owns the
// attribute once mounted; "system" is resolved here via matchMedia and the
// effect restores the media-query-driven behavior on mount.
function applyPersistedTheme() {
  let persisted: { theme?: unknown; accentTheme?: unknown } | null
  try {
    persisted = (
      JSON.parse(localStorage.getItem("cairn-reader-preferences") ?? "null") as {
        state?: { theme?: unknown; accentTheme?: unknown }
      } | null
    )?.state ?? null
  } catch {
    persisted = null
  }
  const theme = persisted?.theme
  const resolved =
    theme === "light" || theme === "dark"
      ? theme
      : (window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false)
        ? "dark"
        : "light"
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
  const accentThemes = [
    "academic-blue",
    "graphite",
    "forest",
    "wine",
    "indigo",
    "warm-paper",
  ] as const
  const accentTheme = persisted?.accentTheme
  document.documentElement.dataset.accent = accentThemes.includes(
    accentTheme as (typeof accentThemes)[number],
  )
    ? (accentTheme as string)
    : "academic-blue"
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  },
})

registerSW({ immediate: true })

const root = document.getElementById("root")
if (!root) throw new Error("Missing root element")

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
