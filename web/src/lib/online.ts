import { useEffect, useState } from "react"

// Browser connectivity state, shared by AppShell's offline banner and the
// workbench's write guards. Server reachability is handled separately via
// the SSE state in the reader store.
export function useOnlineState(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    }
  }, [])
  return online
}
