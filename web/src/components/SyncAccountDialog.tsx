import * as Dialog from "@radix-ui/react-dialog"
import { CircleNotch, CloudArrowDown, X } from "@phosphor-icons/react"
import { type FormEvent, useMemo, useState } from "react"

import type { CreateSyncAccountInput } from "../api/client"
import type { SyncProvider, SyncProviderID } from "../api/types"

interface SyncAccountDialogProps {
  open: boolean
  providers: SyncProvider[]
  pending: boolean
  error: Error | null
  onOpenChange: (open: boolean) => void
  onCreate: (input: CreateSyncAccountInput) => void
}

const defaultEndpoints: Partial<Record<SyncProviderID, string>> = {
  feedbin: "https://api.feedbin.com",
}

export function SyncAccountDialog(props: SyncAccountDialogProps) {
  const fallbackProvider = props.providers[0]?.id ?? "freshrss"
  const [provider, setProvider] = useState<SyncProviderID>(fallbackProvider)
  const [name, setName] = useState("")
  const [endpoint, setEndpoint] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [token, setToken] = useState("")
  const [apiKey, setAPIKey] = useState("")
  const [interval, setInterval] = useState(30)
  const [allowPrivate, setAllowPrivate] = useState(false)
  const providerName = useMemo(() => props.providers.find((item) => item.id === provider)?.name ?? provider, [props.providers, provider])
  const usesAPIKey = provider === "fever"
  const usesBasicAuth = provider === "feedbin" || provider === "nextcloud_news"

  const changeProvider = (value: SyncProviderID) => {
    setProvider(value)
    setEndpoint(defaultEndpoints[value] ?? "")
    setName("")
    setUsername("")
    setPassword("")
    setToken("")
    setAPIKey("")
  }
  const credentialsReady = usesAPIKey ? apiKey.trim() !== "" : usesBasicAuth ? username.trim() !== "" : token.trim() !== "" || username.trim() !== ""
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!endpoint.trim() || !credentialsReady) return
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
            <Dialog.Title>Add sync account</Dialog.Title>
            <Dialog.Close asChild><button className="icon-button" type="button" aria-label="Close" title="Close"><X /></button></Dialog.Close>
          </div>
          <form className="dialog-form" onSubmit={submit}>
            <label className="field-label" htmlFor="sync-provider">Provider</label>
            <select id="sync-provider" className="select-input" value={provider} onChange={(event) => changeProvider(event.target.value as SyncProviderID)}>
              {props.providers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
            <label className="field-label" htmlFor="sync-name">Account name</label>
            <input id="sync-name" className="text-input" value={name} placeholder={providerName} maxLength={120} onChange={(event) => setName(event.target.value)} />
            <label className="field-label" htmlFor="sync-endpoint">Server URL</label>
            <input id="sync-endpoint" className="text-input" type="url" inputMode="url" autoComplete="url" placeholder="https://reader.example.com" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
            {usesAPIKey ? (
              <>
                <label className="field-label" htmlFor="sync-api-key">API key</label>
                <input id="sync-api-key" className="text-input" type="password" autoComplete="off" value={apiKey} onChange={(event) => setAPIKey(event.target.value)} />
              </>
            ) : usesBasicAuth ? (
              <>
                <label className="field-label" htmlFor="sync-username">Username</label>
                <input id="sync-username" className="text-input" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
                <label className="field-label" htmlFor="sync-password">Password</label>
                <input id="sync-password" className="text-input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </>
            ) : (
              <>
                <label className="field-label" htmlFor="sync-token">Access token</label>
                <input id="sync-token" className="text-input" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} />
                <label className="field-label" htmlFor="sync-username">Username</label>
                <input id="sync-username" className="text-input" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} />
                <label className="field-label" htmlFor="sync-password">Password</label>
                <input id="sync-password" className="text-input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </>
            )}
            <label className="field-label" htmlFor="sync-interval">Sync interval</label>
            <select id="sync-interval" className="select-input" value={interval} onChange={(event) => setInterval(Number(event.target.value))}>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={180}>3 hours</option>
              <option value={720}>12 hours</option>
              <option value={1440}>1 day</option>
            </select>
            <label className="checkbox-row" htmlFor="sync-private-network">
              <input id="sync-private-network" type="checkbox" checked={allowPrivate} onChange={(event) => setAllowPrivate(event.target.checked)} />
              <span>Allow private network endpoint</span>
            </label>
            {props.error && <p className="form-error" role="alert">{props.error.message}</p>}
            <div className="dialog-actions dialog-actions--end">
              <button className="button button--primary" type="submit" disabled={props.pending || !endpoint.trim() || !credentialsReady}>
                {props.pending ? <CircleNotch className="spin" /> : <CloudArrowDown />}Add account
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
