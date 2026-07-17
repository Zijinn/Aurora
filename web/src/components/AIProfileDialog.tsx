import * as Dialog from "@radix-ui/react-dialog"
import { Brain, CircleNotch, X } from "@phosphor-icons/react"
import { type FormEvent, useMemo, useState } from "react"

import type { CreateAIProfileInput } from "../api/client"
import type { AIProvider, AIProviderID } from "../api/types"
import { useTranslation } from "../lib/i18n"

interface AIProfileDialogProps {
  open: boolean
  providers: AIProvider[]
  pending: boolean
  error: Error | null
  onOpenChange: (open: boolean) => void
  onCreate: (input: CreateAIProfileInput) => void
}

const defaults: Record<AIProviderID, { endpoint: string; model: string }> = {
  openai_compatible: { endpoint: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  ollama: { endpoint: "http://127.0.0.1:11434", model: "qwen3:8b" },
}

export function AIProfileDialog(props: AIProfileDialogProps) {
  const { t } = useTranslation()
  const [provider, setProvider] = useState<AIProviderID>("openai_compatible")
  const [name, setName] = useState("")
  const [endpoint, setEndpoint] = useState(defaults.openai_compatible.endpoint)
  const [model, setModel] = useState(defaults.openai_compatible.model)
  const [apiKey, setAPIKey] = useState("")
  const [temperature, setTemperature] = useState(0.2)
  const [allowPrivate, setAllowPrivate] = useState(false)
  const [privacyApproved, setPrivacyApproved] = useState(false)
  const [isDefault, setIsDefault] = useState(true)
  const providerName = useMemo(() => props.providers.find((item) => item.id === provider)?.name ?? provider, [props.providers, provider])
  const remote = isRemoteEndpoint(endpoint)
  const changeProvider = (value: AIProviderID) => {
    setProvider(value)
    setEndpoint(defaults[value].endpoint)
    setModel(defaults[value].model)
    setAPIKey("")
    setAllowPrivate(value === "ollama")
    setPrivacyApproved(false)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!endpoint.trim() || !model.trim() || (remote && !privacyApproved)) return
    props.onCreate({
      provider,
      name: name.trim() || providerName,
      endpoint: endpoint.trim(),
      model: model.trim(),
      api_key: apiKey.trim(),
      settings: { temperature },
      allow_private_network: allowPrivate,
      remote_content_approved: privacyApproved,
      is_default: isDefault,
    })
  }
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" aria-describedby={undefined}>
          <div className="dialog-header">
            <Dialog.Title>{t("addAIProvider")}</Dialog.Title>
            <Dialog.Close asChild><button className="icon-button" type="button" aria-label={t("close")} title={t("close")}><X /></button></Dialog.Close>
          </div>
          <form className="dialog-form" onSubmit={submit}>
            <label className="field-label" htmlFor="ai-provider">{t("provider")}</label>
            <select id="ai-provider" className="select-input" value={provider} onChange={(event) => changeProvider(event.target.value as AIProviderID)}>
              {props.providers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
            <label className="field-label" htmlFor="ai-name">{t("profileName")}</label>
            <input id="ai-name" className="text-input" value={name} placeholder={providerName} maxLength={120} onChange={(event) => setName(event.target.value)} />
            <label className="field-label" htmlFor="ai-endpoint">{t("serverURL")}</label>
            <input id="ai-endpoint" className="text-input" type="url" inputMode="url" autoComplete="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
            <label className="field-label" htmlFor="ai-model">{t("model")}</label>
            <input id="ai-model" className="text-input" value={model} maxLength={200} onChange={(event) => setModel(event.target.value)} />
            {provider === "openai_compatible" && <><label className="field-label" htmlFor="ai-api-key">{t("apiKey")}</label><input id="ai-api-key" className="text-input" type="password" autoComplete="off" value={apiKey} onChange={(event) => setAPIKey(event.target.value)} /></>}
            <label className="field-label" htmlFor="ai-temperature">{t("temperature")}</label>
            <input id="ai-temperature" className="range-input" type="range" min="0" max="2" step="0.1" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} />
            <output className="range-output" htmlFor="ai-temperature">{temperature.toFixed(1)}</output>
            <label className="checkbox-row" htmlFor="ai-private-network"><input id="ai-private-network" type="checkbox" checked={allowPrivate} onChange={(event) => setAllowPrivate(event.target.checked)} /><span>{t("allowPrivateEndpoint")}</span></label>
            <label className="checkbox-row privacy-confirmation" htmlFor="ai-privacy"><input id="ai-privacy" type="checkbox" checked={privacyApproved} onChange={(event) => setPrivacyApproved(event.target.checked)} /><span>{t("articleMayBeSent")}</span></label>
            <label className="checkbox-row" htmlFor="ai-default"><input id="ai-default" type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} /><span>{t("defaultAIProvider")}</span></label>
            {props.error && <p className="form-error" role="alert">{props.error.message}</p>}
            <div className="dialog-actions dialog-actions--end">
              <button className="button button--primary" type="submit" disabled={props.pending || !endpoint.trim() || !model.trim() || (remote && !privacyApproved)}>{props.pending ? <CircleNotch className="spin" /> : <Brain />}{t("addProvider")}</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function isRemoteEndpoint(endpoint: string) {
  try {
    const host = new URL(endpoint).hostname
    return host !== "localhost" && host !== "127.0.0.1" && host !== "::1"
  } catch {
    return true
  }
}
