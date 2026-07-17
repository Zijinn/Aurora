import * as Dialog from "@radix-ui/react-dialog"
import { ArrowCounterClockwise, ArrowsClockwise, Brain, Check, CircleNotch, DownloadSimple, LinkSimple, Plus, Trash, UploadSimple, X } from "@phosphor-icons/react"
import { type KeyboardEvent, useRef, useState } from "react"

import type { AIProfile, AIUsage, Device, ServerStatus, SyncAccount, ViewMode } from "../api/types"
import { useTranslation } from "../lib/i18n"
import { displayShortcut, keyboardChord } from "../lib/shortcuts"
import { defaultShortcuts, type ShortcutAction, type ThemeMode, useReaderStore } from "../store/reader"

interface PreferencesDialogProps {
  open: boolean
  theme: ThemeMode
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

const viewModes: Array<{ value: ViewMode; labelKey: string }> = [
  { value: "compact", labelKey: "compact" },
  { value: "standard", labelKey: "standard" },
  { value: "card", labelKey: "cards" },
  { value: "magazine", labelKey: "magazine" },
  { value: "image", labelKey: "images" },
]

const shortcutLabelKeys: Record<ShortcutAction, string> = {
  palette: "commandPaletteShortcut",
  search: "search",
  next: "nextArticle",
  previous: "previousArticle",
  toggleStar: "toggleStar",
  toggleRead: "toggleRead",
}

export function PreferencesDialog(props: PreferencesDialogProps) {
  const { locale, t } = useTranslation()
  const viewMode = useReaderStore((state) => state.viewMode)
  const setViewMode = useReaderStore((state) => state.setViewMode)
  const setLocale = useReaderStore((state) => state.setLocale)
  const setTheme = useReaderStore((state) => state.setTheme)
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
      setConflict(`${displayShortcut(chord)} ${t("alreadyAssigned")} ${t(shortcutLabelKeys[duplicate[0]])}${locale === "zh-CN" ? "。" : "."}`)
      return
    }
    setConflict("")
    setShortcut(action, chord)
  }
  const selectBackup = (file?: File) => {
    if (file && window.confirm(t("restoreConfirmation"))) props.onRestore(file)
    if (restoreInput.current) restoreInput.current.value = ""
  }
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content preferences-dialog" aria-describedby={undefined}>
          <div className="dialog-header">
            <Dialog.Title>{t("preferencesTitle")}</Dialog.Title>
            <Dialog.Close asChild><button className="icon-button" type="button" aria-label={t("close")} title={t("close")}><X /></button></Dialog.Close>
          </div>
          <section className="preference-section preference-section--row">
            <div><h2>{t("language")}</h2><p>{t("languageDescription")}</p></div>
            <select className="select-input preference-language" aria-label={t("language")} value={locale} onChange={(event) => setLocale(event.target.value as "zh-CN" | "en-US")}>
              <option value="zh-CN">{t("chinese")}</option>
              <option value="en-US">{t("english")}</option>
            </select>
          </section>
          <section className="preference-section preference-section--row">
            <div><h2>{t("theme")}</h2><p>{t("themeDescription")}</p></div>
            <select className="select-input preference-language" aria-label={t("theme")} value={props.theme} onChange={(event) => setTheme(event.target.value as ThemeMode)}>
              <option value="system">{t("themeSystem")}</option>
              <option value="light">{t("themeLight")}</option>
              <option value="dark">{t("themeDark")}</option>
            </select>
          </section>
          <section className="preference-section">
            <h2>{t("timelineView")}</h2>
            <div className="segmented-control" role="group" aria-label={t("timelineView")}>
              {viewModes.map((mode) => <button className={viewMode === mode.value ? "segmented-control__item segmented-control__item--active" : "segmented-control__item"} type="button" key={mode.value} onClick={() => setViewMode(mode.value)}>{t(mode.labelKey)}</button>)}
            </div>
          </section>
          <section className="preference-section">
            <div className="preference-heading"><h2>{t("keyboard")}</h2><button className="button button--quiet" type="button" onClick={() => { resetShortcuts(); setConflict("") }}><ArrowCounterClockwise />{t("reset")}</button></div>
            <div className="shortcut-list">
              {(Object.keys(defaultShortcuts) as ShortcutAction[]).map((action) => <div className="shortcut-row" key={action}><span>{t(shortcutLabelKeys[action])}</span><button className="shortcut-key" type="button" title={t("shortcutHint")} onKeyDown={(event) => captureShortcut(action, event)}>{displayShortcut(shortcuts[action])}</button></div>)}
            </div>
            {conflict && <p className="form-error" role="alert">{conflict}</p>}
          </section>
          <section className="preference-section">
            <div className="preference-heading"><h2>{t("externalSync")}</h2><button className="button button--secondary" type="button" onClick={props.onAddSyncAccount}><Plus />{t("add")}</button></div>
            <div className="sync-account-list">
              {props.syncAccounts.map((account) => (
                <div className="sync-account-row" key={account.id}>
                  <label className="sync-account-toggle" title={account.enabled ? t("disableAccount") : t("enableAccount")}>
                    <input type="checkbox" checked={account.enabled} onChange={(event) => props.onToggleSyncAccount(account.id, event.target.checked)} />
                    <span className="sr-only">{t("enable")} {account.name}</span>
                  </label>
                  <span className="sync-account-copy">
                    <strong>{account.name}</strong>
                    <small className={account.last_error_message ? "sync-account-error" : undefined}>
                      {account.last_error_message ?? (account.last_sync_at ? `${t("synced")} ${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(account.last_sync_at))}` : t("notSyncedYet"))}
                    </small>
                  </span>
                  <span className="sync-account-actions">
                    <button className="icon-button" type="button" aria-label={`${t("syncNow")} ${account.name}`} title={t("syncNow")} disabled={!account.enabled || props.syncPendingID === account.id} onClick={() => props.onRunSyncAccount(account.id)}>{props.syncPendingID === account.id ? <CircleNotch className="spin" /> : <ArrowsClockwise />}</button>
                    <button className="icon-button" type="button" aria-label={`${t("delete")} ${account.name}`} title={t("deleteSyncAccount")} onClick={() => props.onDeleteSyncAccount(account.id)}><Trash /></button>
                  </span>
                </div>
              ))}
              {props.syncAccounts.length === 0 && <p className="preference-empty">{t("noSyncAccounts")}</p>}
            </div>
          </section>
          <section className="preference-section">
            <div className="preference-heading"><h2>{t("aiProviders")}</h2><button className="button button--secondary" type="button" onClick={props.onAddAIProfile}><Plus />{t("add")}</button></div>
            <div className="sync-account-list">
              {props.aiProfiles.map((profile) => (
                <div className="sync-account-row" key={profile.id}>
                  <label className="sync-account-toggle" title={profile.enabled ? t("disableProvider") : t("enableProvider")}>
                    <input type="checkbox" checked={profile.enabled} onChange={(event) => props.onToggleAIProfile(profile.id, event.target.checked)} />
                    <span className="sr-only">{t("enable")} {profile.name}</span>
                  </label>
                  <span className="sync-account-copy">
                    <strong><Brain />{profile.name}</strong>
                    <small className={profile.last_error_message ? "sync-account-error" : undefined}>{profile.last_error_message ?? `${profile.model}${profile.is_default ? ` · ${t("default")}` : ""}`}</small>
                  </span>
                  <span className="sync-account-actions">
                    <button className={profile.is_default ? "icon-button icon-button--active" : "icon-button"} type="button" aria-label={`${t("useByDefault")} ${profile.name}`} title={t("makeDefault")} disabled={profile.is_default} onClick={() => props.onDefaultAIProfile(profile.id)}><Check /></button>
                    <button className="icon-button" type="button" aria-label={`${t("delete")} ${profile.name}`} title={t("deleteAIProvider")} onClick={() => props.onDeleteAIProfile(profile.id)}><Trash /></button>
                  </span>
                </div>
              ))}
              {props.aiProfiles.length === 0 && <p className="preference-empty">{t("noAIProviders")}</p>}
            </div>
            {props.aiUsage && <p className="ai-usage">{new Intl.NumberFormat(locale).format(props.aiUsage.total_tokens)} {t("tokensUsed")}</p>}
          </section>
          <section className="preference-section preference-section--row">
            <div><h2>{t("subscriptions")}</h2><p>{t("subscriptionsDescription")}</p></div>
            <div className="button-group"><button className="button button--secondary" type="button" onClick={props.onOrganizeLibrary}><Brain />{t("manage")}</button><a className="button button--secondary" href="/api/v1/exports/opml" download><DownloadSimple />{t("export")}</a></div>
          </section>
          <section className="preference-section">
            <div className="preference-heading"><h2>{t("devices")}</h2><button className="button button--secondary" type="button" disabled={props.pairingCodePending} onClick={props.onCreatePairingCode}>{props.pairingCodePending ? <CircleNotch className="spin" /> : <LinkSimple />}{t("pair")}</button></div>
            {props.pairingCode && <div className="pairing-code-display"><strong>{props.pairingCode.code}</strong><time dateTime={props.pairingCode.expires_at}>{t("expires")} {new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(new Date(props.pairingCode.expires_at))}</time></div>}
            <div className="device-list">
              {props.devices.filter((device) => !device.revoked_at).map((device) => <div className="device-row" key={device.id}><span className="device-row__platform">{device.platform.slice(0, 1).toUpperCase()}</span><span><strong>{device.name}</strong><small>{device.last_seen_at ? `${t("seen")} ${new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(device.last_seen_at))}` : t("notConnectedYet")}</small></span><button className="icon-button" type="button" aria-label={`${t("revokeDevice")} ${device.name}`} title={t("revokeDevice")} onClick={() => props.onRevokeDevice(device.id)}><Trash /></button></div>)}
              {props.devices.filter((device) => !device.revoked_at).length === 0 && <p className="preference-empty">{t("noPairedDevices")}</p>}
            </div>
          </section>
          <section className="preference-section preference-section--row">
            <div><h2>{t("libraryBackup")}</h2><p>{t("backupDescription")}</p></div>
            <div className="button-group">
              <a className="button button--secondary" href="/api/v1/backup" download><DownloadSimple />{t("backup")}</a>
              <input ref={restoreInput} className="sr-only" type="file" accept="application/json,.json" onChange={(event) => selectBackup(event.target.files?.[0])} />
              <button className="button button--secondary" type="button" disabled={props.restorePending} onClick={() => restoreInput.current?.click()}>{props.restorePending ? <CircleNotch className="spin" /> : <UploadSimple />}{t("restore")}</button>
            </div>
          </section>
          {props.error && <p className="form-error preferences-error" role="alert">{props.error.message}</p>}
          <footer className="dialog-meta">Aurora {props.status?.version ?? ""} · API {props.status?.api_version ?? "v1"}</footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
