import * as Dialog from "@radix-ui/react-dialog"
import { CircleNotch, LinkSimple } from "@phosphor-icons/react"
import { type FormEvent, useState } from "react"

import type { Device } from "../api/types"

interface PairDeviceDialogProps {
  open: boolean
  pending: boolean
  error: Error | null
  onPair: (code: string, name: string, platform: Device["platform"]) => void
}

export function PairDeviceDialog(props: PairDeviceDialogProps) {
  const [code, setCode] = useState("")
  const [name, setName] = useState(() => defaultDeviceName())
  const platform = detectPlatform()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (code.trim() && name.trim()) props.onPair(code.trim().toUpperCase(), name.trim(), platform)
  }
  return (
    <Dialog.Root open={props.open}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content pairing-dialog" aria-describedby={undefined} onEscapeKeyDown={(event) => event.preventDefault()} onPointerDownOutside={(event) => event.preventDefault()}>
          <div className="pairing-header"><span className="pairing-mark"><LinkSimple /></span><Dialog.Title>Pair this device</Dialog.Title></div>
          <form className="dialog-form" onSubmit={submit}>
            <label className="field-label" htmlFor="pairing-code">Pairing code</label>
            <input id="pairing-code" className="text-input pairing-code" value={code} maxLength={8} autoCapitalize="characters" autoComplete="one-time-code" onChange={(event) => setCode(event.target.value.replace(/[^a-z0-9]/gi, ""))} autoFocus />
            <label className="field-label" htmlFor="device-name">Device name</label>
            <input id="device-name" className="text-input" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
            {props.error && <p className="form-error" role="alert">{props.error.message}</p>}
            <button className="button button--primary pairing-submit" type="submit" disabled={props.pending || code.length < 8 || !name.trim()}>{props.pending ? <CircleNotch className="spin" /> : <LinkSimple />}Pair device</button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function detectPlatform(): Device["platform"] {
  const agent = navigator.userAgent.toLowerCase()
  if (agent.includes("ipad") || (agent.includes("macintosh") && navigator.maxTouchPoints > 1)) return "ipad"
  if (agent.includes("windows")) return "windows"
  if (agent.includes("macintosh")) return "macos"
  if (agent.includes("iphone")) return "ios"
  if (agent.includes("android")) return "android"
  return "web"
}

function defaultDeviceName() {
  const platform = detectPlatform()
  return platform === "ipad" ? "iPad" : platform === "macos" ? "Mac" : platform === "windows" ? "Windows PC" : "Web browser"
}
