import * as Dialog from "@radix-ui/react-dialog"
import { AppleLogo, CircleNotch, CloudArrowDown, CloudArrowUp, X } from "@phosphor-icons/react"
import { type FormEvent, useMemo, useState } from "react"

import type { CreateSyncAccountInput } from "../api/client"
import type { SyncProvider, SyncProviderID } from "../api/types"
import { useTranslation } from "../lib/i18n"

interface SyncAccountDialogProps {
  open: boolean
  providers: SyncProvider[]
  initialProvider?: SyncProviderID
  pending: boolean
  error: Error | null
  onOpenChange: (open: boolean) => void
  onCreate: (input: CreateSyncAccountInput) => void
}

const defaultEndpoints: Partial<Record<SyncProviderID, string>> = {
  feedbin: "https://api.feedbin.com",
}

export function SyncAccountDialog(props: SyncAccountDialogProps) {
  const { t } = useTranslation()
  const fallbackProvider = props.initialProvider ?? props.providers[0]?.id ?? "webdav"
  const [provider, setProvider] = useState<SyncProviderID>(fallbackProvider)
  const [name, setName] = useState("")
  const [endpoint, setEndpoint] = useState(defaultEndpoints[fallbackProvider] ?? "")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [token, setToken] = useState("")
  const [apiKey, setAPIKey] = useState("")
  const [interval, setInterval] = useState(30)
  const [allowPrivate, setAllowPrivate] = useState(false)
  const providerName = useMemo(
    () => props.providers.find((item) => item.id === provider)?.name ?? provider,
    [props.providers, provider],
  )
  const usesAPIKey = provider === "fever"
  const isWebDAV = provider === "webdav"
  const isICloud = provider === "icloud"
  const isLibraryCloud = isWebDAV || isICloud
  const usesBasicAuth = provider === "feedbin" || provider === "nextcloud_news" || isWebDAV

  const changeProvider = (value: SyncProviderID) => {
    setProvider(value)
    setEndpoint(defaultEndpoints[value] ?? "")
    setName("")
    setUsername("")
    setPassword("")
    setToken("")
    setAPIKey("")
  }
  const credentialsReady = isLibraryCloud
    ? true
    : usesAPIKey
      ? apiKey.trim() !== ""
      : usesBasicAuth
        ? username.trim() !== ""
        : token.trim() !== "" || username.trim() !== ""
  const endpointReady = isICloud || endpoint.trim() !== ""
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!endpointReady || !credentialsReady) return
    props.onCreate({
      provider,
      name: name.trim() || providerName,
      endpoint: endpoint.trim(),
      credentials: {
        username: username.trim() || undefined,
        password: password || undefined,
        token: token.trim() || undefined,
        api_key: apiKey.trim() || undefined,
      },
      allow_private_network: allowPrivate,
      sync_interval_minutes: interval,
    })
  }

  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" aria-describedby={undefined}>
          <div className="dialog-header">
            <Dialog.Title>{t("addSyncAccount")}</Dialog.Title>
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
          <form className="dialog-form sync-dialog-form" onSubmit={submit}>
            <label className="field-label" htmlFor="sync-provider">
              {t("provider")}
            </label>
            <select
              id="sync-provider"
              className="select-input"
              value={provider}
              onChange={(event) => changeProvider(event.target.value as SyncProviderID)}
            >
              <optgroup label={t("libraryCloudSync")}>
                {props.providers
                  .filter((item) => item.id === "webdav" || item.id === "icloud")
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label={t("readingServiceSync")}>
                {props.providers
                  .filter((item) => item.id !== "webdav" && item.id !== "icloud")
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
              </optgroup>
            </select>
            {isLibraryCloud && (
              <div className="sync-provider-note">
                {isICloud ? <AppleLogo /> : <CloudArrowUp />}
                <span>
                  <strong>{isICloud ? t("icloudDrive") : "WebDAV"}</strong>
                  <small>
                    {isICloud ? t("icloudSyncDescription") : t("webdavSyncDescription")}
                  </small>
                </span>
              </div>
            )}
            <label className="field-label" htmlFor="sync-name">
              {t("accountName")}
            </label>
            <input
              id="sync-name"
              className="text-input"
              value={name}
              placeholder={providerName}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
            />
            <label className="field-label" htmlFor="sync-endpoint">
              {isICloud ? t("icloudPath") : isWebDAV ? t("snapshotFileURL") : t("serverURL")}
            </label>
            <input
              id="sync-endpoint"
              className="text-input"
              type={isICloud ? "text" : "url"}
              inputMode={isICloud ? undefined : "url"}
              autoComplete={isICloud ? "off" : "url"}
              placeholder={
                isICloud
                  ? t("icloudPathPlaceholder")
                  : isWebDAV
                    ? "https://dav.example.com/Aurora/aurora-library.json"
                    : "https://reader.example.com"
              }
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
            />
            {isICloud && <p className="field-hint">{t("icloudDefaultPathHint")}</p>}
            {usesAPIKey ? (
              <>
                <label className="field-label" htmlFor="sync-api-key">
                  {t("apiKey")}
                </label>
                <input
                  id="sync-api-key"
                  className="text-input"
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(event) => setAPIKey(event.target.value)}
                />
              </>
            ) : usesBasicAuth ? (
              <>
                <label className="field-label" htmlFor="sync-username">
                  {t("username")}
                </label>
                <input
                  id="sync-username"
                  className="text-input"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
                <label className="field-label" htmlFor="sync-password">
                  {t("password")}
                  {isWebDAV ? ` (${t("optional")})` : ""}
                </label>
                <input
                  id="sync-password"
                  className="text-input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </>
            ) : isICloud ? null : (
              <>
                <label className="field-label" htmlFor="sync-token">
                  {t("accessToken")}
                </label>
                <input
                  id="sync-token"
                  className="text-input"
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                />
                <label className="field-label" htmlFor="sync-username">
                  {t("username")}
                </label>
                <input
                  id="sync-username"
                  className="text-input"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
                <label className="field-label" htmlFor="sync-password">
                  {t("password")}
                </label>
                <input
                  id="sync-password"
                  className="text-input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </>
            )}
            <label className="field-label" htmlFor="sync-interval">
              {t("syncInterval")}
            </label>
            <select
              id="sync-interval"
              className="select-input"
              value={interval}
              onChange={(event) => setInterval(Number(event.target.value))}
            >
              <option value={15}>{t("minutes15")}</option>
              <option value={30}>{t("minutes30")}</option>
              <option value={60}>{t("hour1")}</option>
              <option value={180}>{t("hours3")}</option>
              <option value={720}>{t("hours12")}</option>
              <option value={1440}>{t("day1")}</option>
            </select>
            {!isICloud && (
              <label className="checkbox-row" htmlFor="sync-private-network">
                <input
                  id="sync-private-network"
                  type="checkbox"
                  checked={allowPrivate}
                  onChange={(event) => setAllowPrivate(event.target.checked)}
                />
                <span>{t("allowPrivateEndpoint")}</span>
              </label>
            )}
            {props.error && (
              <p className="form-error" role="alert">
                {props.error.message}
              </p>
            )}
            <div className="dialog-actions dialog-actions--end">
              <button
                className="button button--primary"
                type="submit"
                disabled={props.pending || !endpointReady || !credentialsReady}
              >
                {props.pending ? <CircleNotch className="spin" /> : <CloudArrowDown />}
                {t("addAccount")}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
