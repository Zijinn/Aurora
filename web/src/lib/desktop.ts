export type DesktopPlatform = "macos" | "windows" | null
export type DesktopWindowAction = "minimise" | "maximise" | "close"

interface WailsHostWindow extends Window {
  _wails?: {
    environment?: {
      OS?: string
    }
  }
}

export function desktopPlatform(host: WailsHostWindow = window): DesktopPlatform {
  const os = host._wails?.environment?.OS
  if (os === "darwin") return "macos"
  if (os === "windows") return "windows"
  return null
}

export function applyDesktopPlatform() {
  const platform = desktopPlatform()
  if (platform) document.documentElement.dataset.desktop = platform
}

export async function controlDesktopWindow(action: DesktopWindowAction) {
  if (desktopPlatform() !== "windows") return

  const { Window: desktopWindow } = await import("@wailsio/runtime")
  if (action === "minimise") await desktopWindow.Minimise()
  if (action === "maximise") await desktopWindow.ToggleMaximise()
  if (action === "close") await desktopWindow.Close()
}
