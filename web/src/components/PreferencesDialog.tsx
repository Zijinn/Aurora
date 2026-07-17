import * as Dialog from "@radix-ui/react-dialog"
import {
  ArrowCounterClockwise,
  ArrowsClockwise,
  Books,
  Brain,
  Check,
  CircleNotch,
  Cloud,
  CloudArrowDown,
  CloudArrowUp,
  Devices,
  DownloadSimple,
  LinkSimple,
  Palette,
  Plus,
  Trash,
  UploadSimple,
  X,
} from "@phosphor-icons/react"
import { type KeyboardEvent, useRef, useState } from "react"

import type { AIProfile, AIUsage, Device, ServerStatus, SyncAccount, ViewMode } from "../api/types"
import { useTranslation, type Locale, type Translator } from "../lib/i18n"
import { displayShortcut, keyboardChord } from "../lib/shortcuts"
import {
  defaultShortcuts,
  type ShortcutAction,
  type ThemeMode,
  useReaderStore,
} from "../store/reader"

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
  onRunSyncAccount: (accountID: string, mode: "auto" | "push" | "pull") => void
  onDeleteSyncAccount: (accountID: string) => void
  onOrganizeLibrary: () => void
  onAddAIProfile: () => void
  onToggleAIProfile: (profileID: string, enabled: boolean) => void
  onDefaultAIProfile: (profileID: string) => void
  onDeleteAIProfile: (profileID: string) => void
}

type PreferenceTab = "interface" | "ai" | "sync" | "library" | "devices"

const tabs: Array<{
  id: PreferenceTab
  labelKey: string
  descriptionKey: string
  icon: typeof Brain
}> = [
  {
    id: "interface",
    labelKey: "interface",
    descriptionKey: "interfaceSettingsDescription",
    icon: Palette,
  },
  { id: "ai", labelKey: "aiAndLanguage", descriptionKey: "aiSettingsDescription", icon: Brain },
  { id: "sync", labelKey: "sync", descriptionKey: "syncSettingsDescription", icon: Cloud },
  { id: "library", labelKey: "library", descriptionKey: "librarySettingsDescription", icon: Books },
  {
    id: "devices",
    labelKey: "devices",
    descriptionKey: "deviceSettingsDescription",
    icon: Devices,
  },
]

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
  const [activeTab, setActiveTab] = useState<PreferenceTab>("interface")
  const [conflict, setConflict] = useState("")
  const restoreInput = useRef<HTMLInputElement>(null)
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0]!
  const serviceAccounts = props.syncAccounts.filter(
    (account) => account.provider !== "webdav" && account.provider !== "icloud",
  )
  const cloudAccounts = props.syncAccounts.filter(
    (account) => account.provider === "webdav" || account.provider === "icloud",
  )
  const activeDevices = props.devices.filter((device) => !device.revoked_at)

  const captureShortcut = (action: ShortcutAction, event: KeyboardEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const chord = keyboardChord(event)
    if (!chord || chord === "mod" || chord === "alt" || chord === "shift") return
    const duplicate = (Object.entries(shortcuts) as Array<[ShortcutAction, string]>).find(
      ([candidate, value]) => candidate !== action && value === chord,
    )
    if (duplicate) {
      setConflict(
        `${displayShortcut(chord)} ${t("alreadyAssigned")} ${t(shortcutLabelKeys[duplicate[0]])}${locale === "zh-CN" ? "。" : "."}`,
      )
      return
    }
    setConflict("")
    setShortcut(action, chord)
  }
  const selectBackup = (file?: File) => {
    if (file && window.confirm(t("restoreConfirmation"))) props.onRestore(file)
    if (restoreInput.current) restoreInput.current.value = ""
  }
  const runCloudSync = (account: SyncAccount, mode: "auto" | "push" | "pull") => {
    if (mode === "push" && !window.confirm(t("cloudPushConfirmation"))) return
    if (mode === "pull" && !window.confirm(t("cloudPullConfirmation"))) return
    props.onRunSyncAccount(account.id, mode)
  }

  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content preferences-dialog" aria-describedby={undefined}>
          <div className="preferences-layout">
            <aside className="preferences-nav">
              <div className="preferences-nav__brand">
                <img src="/icons/aurora-192.png" alt="" draggable={false} />
                <span>
                  <strong>Aurora</strong>
                  <small>{t("preferencesTitle")}</small>
                </span>
              </div>
              <nav aria-label={t("preferencesTitle")}>
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      className={
                        activeTab === tab.id
                          ? "preferences-nav__item preferences-nav__item--active"
                          : "preferences-nav__item"
                      }
                      type="button"
                      key={tab.id}
                      aria-current={activeTab === tab.id ? "page" : undefined}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <Icon />
                      <span>{t(tab.labelKey)}</span>
                    </button>
                  )
                })}
              </nav>
              <small>Aurora {props.status?.version ?? ""}</small>
            </aside>

            <main className="preferences-main">
              <div className="dialog-header preferences-header">
                <div>
                  <Dialog.Title>{t(active.labelKey)}</Dialog.Title>
                  <p>{t(active.descriptionKey)}</p>
                </div>
                <Dialog.Close asChild>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t("close")}
                    title={t("close")}
                  >
                    <X />
                  </button>
                </Dialog.Close>
              </div>
              <div className="preferences-scroll">
                {activeTab === "interface" && (
                  <>
                    <section className="preference-section preference-section--row">
                      <div>
                        <h2>{t("language")}</h2>
                        <p>{t("languageDescription")}</p>
                      </div>
                      <select
                        className="select-input preference-language"
                        aria-label={t("language")}
                        value={locale}
                        onChange={(event) => setLocale(event.target.value as "zh-CN" | "en-US")}
                      >
                        <option value="zh-CN">{t("chinese")}</option>
                        <option value="en-US">{t("english")}</option>
                      </select>
                    </section>
                    <section className="preference-section preference-section--row">
                      <div>
                        <h2>{t("theme")}</h2>
                        <p>{t("themeDescription")}</p>
                      </div>
                      <select
                        className="select-input preference-language"
                        aria-label={t("theme")}
                        value={props.theme}
                        onChange={(event) => setTheme(event.target.value as ThemeMode)}
                      >
                        <option value="system">{t("themeSystem")}</option>
                        <option value="light">{t("themeLight")}</option>
                        <option value="dark">{t("themeDark")}</option>
                      </select>
                    </section>
                    <section className="preference-section">
                      <h2>{t("timelineView")}</h2>
                      <div
                        className="segmented-control"
                        role="group"
                        aria-label={t("timelineView")}
                      >
                        {viewModes.map((mode) => (
                          <button
                            className={
                              viewMode === mode.value
                                ? "segmented-control__item segmented-control__item--active"
                                : "segmented-control__item"
                            }
                            type="button"
                            key={mode.value}
                            onClick={() => setViewMode(mode.value)}
                          >
                            {t(mode.labelKey)}
                          </button>
                        ))}
                      </div>
                    </section>
                    <section className="preference-section">
                      <div className="preference-heading">
                        <h2>{t("keyboard")}</h2>
                        <button
                          className="button button--quiet"
                          type="button"
                          onClick={() => {
                            resetShortcuts()
                            setConflict("")
                          }}
                        >
                          <ArrowCounterClockwise />
                          {t("reset")}
                        </button>
                      </div>
                      <div className="shortcut-list">
                        {(Object.keys(defaultShortcuts) as ShortcutAction[]).map((action) => (
                          <div className="shortcut-row" key={action}>
                            <span>{t(shortcutLabelKeys[action])}</span>
                            <button
                              className="shortcut-key"
                              type="button"
                              title={t("shortcutHint")}
                              onKeyDown={(event) => captureShortcut(action, event)}
                            >
                              {displayShortcut(shortcuts[action])}
                            </button>
                          </div>
                        ))}
                      </div>
                      {conflict && (
                        <p className="form-error" role="alert">
                          {conflict}
                        </p>
                      )}
                    </section>
                  </>
                )}

                {activeTab === "ai" && (
                  <section className="preference-section preference-section--flush">
                    <div className="preference-heading preference-heading--intro">
                      <div>
                        <h2>{t("aiProviders")}</h2>
                        <p>{t("aiProviderDescription")}</p>
                      </div>
                      <button
                        className="button button--secondary"
                        type="button"
                        onClick={props.onAddAIProfile}
                      >
                        <Plus />
                        {t("add")}
                      </button>
                    </div>
                    <div className="sync-account-list">
                      {props.aiProfiles.map((profile) => (
                        <div className="sync-account-row" key={profile.id}>
                          <label
                            className="sync-account-toggle"
                            title={profile.enabled ? t("disableProvider") : t("enableProvider")}
                          >
                            <input
                              type="checkbox"
                              checked={profile.enabled}
                              onChange={(event) =>
                                props.onToggleAIProfile(profile.id, event.target.checked)
                              }
                            />
                            <span className="sr-only">
                              {t("enable")} {profile.name}
                            </span>
                          </label>
                          <span className="sync-account-copy">
                            <strong>
                              <Brain />
                              {profile.name}
                            </strong>
                            <small
                              className={
                                profile.last_error_message ? "sync-account-error" : undefined
                              }
                            >
                              {profile.last_error_message ??
                                `${profile.model}${profile.is_default ? ` · ${t("default")}` : ""}`}
                            </small>
                          </span>
                          <span className="sync-account-actions">
                            <button
                              className={
                                profile.is_default
                                  ? "icon-button icon-button--active"
                                  : "icon-button"
                              }
                              type="button"
                              aria-label={`${t("useByDefault")} ${profile.name}`}
                              title={t("makeDefault")}
                              disabled={profile.is_default}
                              onClick={() => props.onDefaultAIProfile(profile.id)}
                            >
                              <Check />
                            </button>
                            <button
                              className="icon-button"
                              type="button"
                              aria-label={`${t("delete")} ${profile.name}`}
                              title={t("deleteAIProvider")}
                              onClick={() => props.onDeleteAIProfile(profile.id)}
                            >
                              <Trash />
                            </button>
                          </span>
                        </div>
                      ))}
                      {props.aiProfiles.length === 0 && (
                        <p className="preference-empty">{t("noAIProviders")}</p>
                      )}
                    </div>
                    {props.aiUsage && (
                      <p className="ai-usage">
                        {new Intl.NumberFormat(locale).format(props.aiUsage.total_tokens)}{" "}
                        {t("tokensUsed")}
                      </p>
                    )}
                  </section>
                )}

                {activeTab === "sync" && (
                  <>
                    <SyncAccountSection
                      title={t("libraryCloudSync")}
                      description={t("libraryCloudSyncDescription")}
                      empty={t("noCloudSyncAccounts")}
                      accounts={cloudAccounts}
                      locale={locale}
                      t={t}
                      pendingID={props.syncPendingID}
                      onAdd={props.onAddSyncAccount}
                      onToggle={props.onToggleSyncAccount}
                      onRun={runCloudSync}
                      onDelete={props.onDeleteSyncAccount}
                      cloud
                    />
                    <SyncAccountSection
                      title={t("readingServiceSync")}
                      description={t("readingServiceSyncDescription")}
                      empty={t("noServiceSyncAccounts")}
                      accounts={serviceAccounts}
                      locale={locale}
                      t={t}
                      pendingID={props.syncPendingID}
                      onAdd={props.onAddSyncAccount}
                      onToggle={props.onToggleSyncAccount}
                      onRun={(account) => props.onRunSyncAccount(account.id, "auto")}
                      onDelete={props.onDeleteSyncAccount}
                    />
                  </>
                )}

                {activeTab === "library" && (
                  <>
                    <section className="preference-section preference-section--row">
                      <div>
                        <h2>{t("subscriptions")}</h2>
                        <p>{t("subscriptionsDescription")}</p>
                      </div>
                      <div className="button-group">
                        <button
                          className="button button--secondary"
                          type="button"
                          onClick={props.onOrganizeLibrary}
                        >
                          <Books />
                          {t("manage")}
                        </button>
                        <a
                          className="button button--secondary"
                          href="/api/v1/exports/opml"
                          download
                        >
                          <DownloadSimple />
                          {t("export")}
                        </a>
                      </div>
                    </section>
                    <section className="preference-section preference-section--row">
                      <div>
                        <h2>{t("libraryBackup")}</h2>
                        <p>{t("backupDescription")}</p>
                      </div>
                      <div className="button-group">
                        <a className="button button--secondary" href="/api/v1/backup" download>
                          <DownloadSimple />
                          {t("backup")}
                        </a>
                        <input
                          ref={restoreInput}
                          className="sr-only"
                          type="file"
                          accept="application/json,.json"
                          onChange={(event) => selectBackup(event.target.files?.[0])}
                        />
                        <button
                          className="button button--secondary"
                          type="button"
                          disabled={props.restorePending}
                          onClick={() => restoreInput.current?.click()}
                        >
                          {props.restorePending ? (
                            <CircleNotch className="spin" />
                          ) : (
                            <UploadSimple />
                          )}
                          {t("restore")}
                        </button>
                      </div>
                    </section>
                  </>
                )}

                {activeTab === "devices" && (
                  <section className="preference-section preference-section--flush">
                    <div className="preference-heading preference-heading--intro">
                      <div>
                        <h2>{t("devices")}</h2>
                        <p>{t("devicesDescription")}</p>
                      </div>
                      <button
                        className="button button--secondary"
                        type="button"
                        disabled={props.pairingCodePending}
                        onClick={props.onCreatePairingCode}
                      >
                        {props.pairingCodePending ? (
                          <CircleNotch className="spin" />
                        ) : (
                          <LinkSimple />
                        )}
                        {t("pair")}
                      </button>
                    </div>
                    {props.pairingCode && (
                      <div className="pairing-code-display">
                        <strong>{props.pairingCode.code}</strong>
                        <time dateTime={props.pairingCode.expires_at}>
                          {t("expires")}{" "}
                          {new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(
                            new Date(props.pairingCode.expires_at),
                          )}
                        </time>
                      </div>
                    )}
                    <div className="device-list">
                      {activeDevices.map((device) => (
                        <div className="device-row" key={device.id}>
                          <span className="device-row__platform">
                            {device.platform.slice(0, 1).toUpperCase()}
                          </span>
                          <span>
                            <strong>{device.name}</strong>
                            <small>
                              {device.last_seen_at
                                ? `${t("seen")} ${new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(device.last_seen_at))}`
                                : t("notConnectedYet")}
                            </small>
                          </span>
                          <button
                            className="icon-button"
                            type="button"
                            aria-label={`${t("revokeDevice")} ${device.name}`}
                            title={t("revokeDevice")}
                            onClick={() => props.onRevokeDevice(device.id)}
                          >
                            <Trash />
                          </button>
                        </div>
                      ))}
                    </div>
                    {activeDevices.length === 0 && (
                      <p className="preference-empty">{t("noPairedDevices")}</p>
                    )}
                  </section>
                )}
              </div>
              {props.error && (
                <p className="form-error preferences-error" role="alert">
                  {props.error.message}
                </p>
              )}
              <footer className="dialog-meta">API {props.status?.api_version ?? "v1"}</footer>
            </main>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function SyncAccountSection(props: {
  title: string
  description: string
  empty: string
  accounts: SyncAccount[]
  locale: Locale
  t: Translator
  pendingID?: string
  cloud?: boolean
  onAdd: () => void
  onToggle: (accountID: string, enabled: boolean) => void
  onRun: (account: SyncAccount, mode: "auto" | "push" | "pull") => void
  onDelete: (accountID: string) => void
}) {
  return (
    <section className="preference-section preference-section--flush">
      <div className="preference-heading preference-heading--intro">
        <div>
          <h2>{props.title}</h2>
          <p>{props.description}</p>
        </div>
        <button className="button button--secondary" type="button" onClick={props.onAdd}>
          <Plus />
          {props.t("add")}
        </button>
      </div>
      <div className="sync-account-list">
        {props.accounts.map((account) => {
          const pending = props.pendingID === account.id
          const conflict = account.last_error_code === "conflict"
          return (
            <div
              className={
                conflict ? "sync-account-row sync-account-row--conflict" : "sync-account-row"
              }
              key={account.id}
            >
              <label
                className="sync-account-toggle"
                title={account.enabled ? props.t("disableAccount") : props.t("enableAccount")}
              >
                <input
                  type="checkbox"
                  checked={account.enabled}
                  onChange={(event) => props.onToggle(account.id, event.target.checked)}
                />
                <span className="sr-only">
                  {props.t("enable")} {account.name}
                </span>
              </label>
              <span className="sync-account-copy">
                <strong>
                  {props.cloud && <Cloud />}
                  {account.name}
                </strong>
                <small className={account.last_error_message ? "sync-account-error" : undefined}>
                  {conflict
                    ? props.t("cloudConflict")
                    : (account.last_error_message ??
                      (account.last_sync_at
                        ? `${props.t("synced")} ${new Intl.DateTimeFormat(props.locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(account.last_sync_at))}`
                        : props.t("notSyncedYet")))}
                </small>
              </span>
              <span className="sync-account-actions">
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`${props.t("syncNow")} ${account.name}`}
                  title={props.t("syncNow")}
                  disabled={!account.enabled || pending}
                  onClick={() => props.onRun(account, "auto")}
                >
                  {pending ? <CircleNotch className="spin" /> : <ArrowsClockwise />}
                </button>
                {props.cloud && (
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`${props.t("uploadLocalLibrary")} ${account.name}`}
                    title={props.t("uploadLocalLibrary")}
                    disabled={!account.enabled || pending}
                    onClick={() => props.onRun(account, "push")}
                  >
                    <CloudArrowUp />
                  </button>
                )}
                {props.cloud && (
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`${props.t("restoreFromCloud")} ${account.name}`}
                    title={props.t("restoreFromCloud")}
                    disabled={!account.enabled || pending}
                    onClick={() => props.onRun(account, "pull")}
                  >
                    <CloudArrowDown />
                  </button>
                )}
                <button
                  className="icon-button"
                  type="button"
                  aria-label={`${props.t("delete")} ${account.name}`}
                  title={props.t("deleteSyncAccount")}
                  onClick={() => props.onDelete(account.id)}
                >
                  <Trash />
                </button>
              </span>
            </div>
          )
        })}
        {props.accounts.length === 0 && <p className="preference-empty">{props.empty}</p>}
      </div>
    </section>
  )
}
