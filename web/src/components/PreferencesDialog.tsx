import * as Dialog from "@radix-ui/react-dialog"
import { ArrowCounterClockwise, ArrowsClockwise, Brain, Check, CircleNotch, DownloadSimple, LinkSimple, Plus, Trash, UploadSimple, X } from "@phosphor-icons/react"
import { type KeyboardEvent, useRef, useState } from "react"

import type { AIProfile, AIUsage, Device, ServerStatus, SyncAccount, ViewMode } from "../api/types"
import { displayShortcut, keyboardChord } from "../lib/shortcuts"
import { defaultShortcuts, type ShortcutAction, useReaderStore } from "../store/reader"

interface PreferencesDialogProps {
  open: boolean
  status?: ServerStatus
  restorePending: boolean
  error: Error | null
  devices: Device[]
  syncAccounts: SyncAccount[]
  syncPendingID?: string
  aiProfiles: AIProfile[]
  aiUsage?: AIUsage
  pairingCode?: { code: string; expires_at: string }
  pairingCodePending: boolean
  onOpenChange: (open: boolean) => void
  onRestore: (file: File) => void
  onCreatePairingCode: () => void
  onRevokeDevice: (deviceID: string) => void
  onAddSyncAccount: () => void
  onToggleSyncAccount: (accountID: string, enabled: boolean) => void
  onRunSyncAccount: (accountID: string) => void
  onDeleteSyncAccount: (accountID: string) => void
  onOrganizeLibrary: () => void
  onAddAIProfile: () => void
  onToggleAIProfile: (profileID: string, enabled: boolean) => void
  onDefaultAIProfile: (profileID: string) => void
  onDeleteAIProfile: (profileID: string) => void
}

const viewModes: Array<{ value: ViewMode; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "standard", label: "Standard" },
  { value: "card", label: "Cards" },
  { value: "magazine", label: "Magazine" },
  { value: "image", label: "Images" },
]

const shortcutLabels: Record<ShortcutAction, string> = {
  palette: "Command palette",
  search: "Search",
  next: "Next article",
  previous: "Previous article",
  toggleStar: "Toggle star",
  toggleRead: "Toggle read",
}

export function PreferencesDialog(props: PreferencesDialogProps) {
  const viewMode = useReaderStore((state) => state.viewMode)
  const setViewMode = useReaderStore((state) => state.setViewMode)
  const shortcuts = useReaderStore((state) => state.shortcuts)
  const setShortcut = useReaderStore((state) => state.setShortcut)
  const resetShortcuts = useReaderStore((state) => state.resetShortcuts)
  const [conflict, setConflict] = useState("")
  const restoreInput = useRef<HTMLInputElement>(null)
  const captureShortcut = (action: ShortcutAction, event: KeyboardEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const chord = keyboardChord(event)
    if (!chord || chord === "mod" || chord === "alt" || chord === "shift") return
    const duplicate = (Object.entries(shortcuts) as Array<[ShortcutAction, string]>).find(([candidate, value]) => candidate !== action && value === chord)
    if (duplicate) {
      setConflict(`${displayShortcut(chord)} is already assigned to ${shortcutLabels[duplicate[0]]}.`)
      return
    }
    setConflict("")
    setShortcut(action, chord)
  }
  const selectBackup = (file?: File) => {
    if (file && window.confirm("Restore this backup and replace the current Cairn library?")) props.onRestore(file)
    if (restoreInput.current) restoreInput.current.value = ""
  }
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content preferences-dialog" aria-describedby={undefined}>
          <div className="dialog-header">
            <Dialog.Title>Preferences</Dialog.Title>
            <Dialog.Close asChild><button className="icon-button" type="button" aria-label="Close" title="Close"><X /></button></Dialog.Close>
          </div>
          <section className="preference-section">
            <h2>Timeline view</h2>
            <div className="segmented-control" role="group" aria-label="Timeline view">
              {viewModes.map((mode) => <button className={viewMode === mode.value ? "segmented-control__item segmented-control__item--active" : "segmented-control__item"} type="button" key={mode.value} onClick={() => setViewMode(mode.value)}>{mode.label}</button>)}
            </div>
          </section>
          <section className="preference-section">
            <div className="preference-heading"><h2>Keyboard</h2><button className="button button--quiet" type="button" onClick={() => { resetShortcuts(); setConflict("") }}><ArrowCounterClockwise />Reset</button></div>
            <div className="shortcut-list">
              {(Object.keys(defaultShortcuts) as ShortcutAction[]).map((action) => <div className="shortcut-row" key={action}><span>{shortcutLabels[action]}</span><button className="shortcut-key" type="button" title="Focus, then press a shortcut" onKeyDown={(event) => captureShortcut(action, event)}>{displayShortcut(shortcuts[action])}</button></div>)}
            </div>
            {conflict && <p className="form-error" role="alert">{conflict}</p>}
          </section>
          <section className="preference-section">
            <div className="preference-heading"><h2>External sync</h2><button className="button button--secondary" type="button" onClick={props.onAddSyncAccount}><Plus />Add</button></div>
            <div className="sync-account-list">
              {props.syncAccounts.map((account) => (
                <div className="sync-account-row" key={account.id}>
                  <label className="sync-account-toggle" title={account.enabled ? "Disable account" : "Enable account"}>
                    <input type="checkbox" checked={account.enabled} onChange={(event) => props.onToggleSyncAccount(account.id, event.target.checked)} />
                    <span className="sr-only">Enable {account.name}</span>
                  </label>
                  <span className="sync-account-copy">
                    <strong>{account.name}</strong>
                    <small className={account.last_error_message ? "sync-account-error" : undefined}>
                      {account.last_error_message ?? (account.last_sync_at ? `Synced ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(account.last_sync_at))}` : "Not synced yet")}
                    </small>
                  </span>
                  <span className="sync-account-actions">
                    <button className="icon-button" type="button" aria-label={`Sync ${account.name}`} title="Sync now" disabled={!account.enabled || props.syncPendingID === account.id} onClick={() => props.onRunSyncAccount(account.id)}>{props.syncPendingID === account.id ? <CircleNotch className="spin" /> : <ArrowsClockwise />}</button>
                    <button className="icon-button" type="button" aria-label={`Delete ${account.name}`} title="Delete sync account" onClick={() => props.onDeleteSyncAccount(account.id)}><Trash /></button>
                  </span>
                </div>
              ))}
              {props.syncAccounts.length === 0 && <p className="preference-empty">No sync accounts</p>}
            </div>
          </section>
          <section className="preference-section">
            <div className="preference-heading"><h2>AI providers</h2><button className="button button--secondary" type="button" onClick={props.onAddAIProfile}><Plus />Add</button></div>
            <div className="sync-account-list">
              {props.aiProfiles.map((profile) => (
                <div className="sync-account-row" key={profile.id}>
                  <label className="sync-account-toggle" title={profile.enabled ? "Disable provider" : "Enable provider"}>
                    <input type="checkbox" checked={profile.enabled} onChange={(event) => props.onToggleAIProfile(profile.id, event.target.checked)} />
                    <span className="sr-only">Enable {profile.name}</span>
                  </label>
                  <span className="sync-account-copy">
                    <strong><Brain />{profile.name}</strong>
                    <small className={profile.last_error_message ? "sync-account-error" : undefined}>{profile.last_error_message ?? `${profile.model}${profile.is_default ? " · Default" : ""}`}</small>
                  </span>
                  <span className="sync-account-actions">
                    <button className={profile.is_default ? "icon-button icon-button--active" : "icon-button"} type="button" aria-label={`Use ${profile.name} by default`} title="Make default" disabled={profile.is_default} onClick={() => props.onDefaultAIProfile(profile.id)}><Check /></button>
                    <button className="icon-button" type="button" aria-label={`Delete ${profile.name}`} title="Delete AI provider" onClick={() => props.onDeleteAIProfile(profile.id)}><Trash /></button>
                  </span>
                </div>
              ))}
              {props.aiProfiles.length === 0 && <p className="preference-empty">No AI providers</p>}
            </div>
            {props.aiUsage && <p className="ai-usage">{new Intl.NumberFormat().format(props.aiUsage.total_tokens)} tokens used</p>}
          </section>
          <section className="preference-section preference-section--row">
            <div><h2>Subscriptions</h2><p>OPML outline and library organization</p></div>
            <div className="button-group"><button className="button button--secondary" type="button" onClick={props.onOrganizeLibrary}><Brain />Manage</button><a className="button button--secondary" href="/api/v1/exports/opml" download><DownloadSimple />Export</a></div>
          </section>
          <section className="preference-section">
            <div className="preference-heading"><h2>Devices</h2><button className="button button--secondary" type="button" disabled={props.pairingCodePending} onClick={props.onCreatePairingCode}>{props.pairingCodePending ? <CircleNotch className="spin" /> : <LinkSimple />}Pair</button></div>
            {props.pairingCode && <div className="pairing-code-display"><strong>{props.pairingCode.code}</strong><time dateTime={props.pairingCode.expires_at}>Expires {new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(new Date(props.pairingCode.expires_at))}</time></div>}
            <div className="device-list">
              {props.devices.filter((device) => !device.revoked_at).map((device) => <div className="device-row" key={device.id}><span className="device-row__platform">{device.platform.slice(0, 1).toUpperCase()}</span><span><strong>{device.name}</strong><small>{device.last_seen_at ? `Seen ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(device.last_seen_at))}` : "Not connected yet"}</small></span><button className="icon-button" type="button" aria-label={`Revoke ${device.name}`} title="Revoke device" onClick={() => props.onRevokeDevice(device.id)}><Trash /></button></div>)}
              {props.devices.filter((device) => !device.revoked_at).length === 0 && <p className="preference-empty">No paired devices</p>}
            </div>
          </section>
          <section className="preference-section preference-section--row">
            <div><h2>Library backup</h2><p>Feeds, articles, states, rules, and settings</p></div>
            <div className="button-group">
              <a className="button button--secondary" href="/api/v1/backup" download><DownloadSimple />Backup</a>
              <input ref={restoreInput} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => selectBackup(event.target.files?.[0])} />
              <button className="button button--secondary" type="button" disabled={props.restorePending} onClick={() => restoreInput.current?.click()}>{props.restorePending ? <CircleNotch className="spin" /> : <UploadSimple />}Restore</button>
            </div>
          </section>
          {props.error && <p className="form-error preferences-error" role="alert">{props.error.message}</p>}
          <footer className="dialog-meta">Cairn {props.status?.version ?? ""} · API {props.status?.api_version ?? "v1"}</footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
