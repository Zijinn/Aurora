import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Brain, ChatCircle, CircleNotch, ListBullets, Stop, TextAlignLeft, Translate } from "@phosphor-icons/react"
import { type FormEvent, useEffect, useState } from "react"

import { cancelJob, getAIChat, getJob, listAIResults, runAIOperation, startAIChat } from "../api/client"
import type { AIChatSession, AIOperation, AIProfile, AIResult, ListResponse } from "../api/types"

interface AIWorkbenchProps {
  entryID: string
  profiles: AIProfile[]
  onConfigure: () => void
}

const operations: Array<{ id: AIOperation; label: string; icon: typeof Brain }> = [
  { id: "summary", label: "Summary", icon: TextAlignLeft },
  { id: "translation", label: "Translate", icon: Translate },
  { id: "key_points", label: "Key points", icon: ListBullets },
]

export function AIWorkbench(props: AIWorkbenchProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<AIOperation | "chat">("summary")
  const [profileID, setProfileID] = useState("")
  const [language, setLanguage] = useState(() => navigator.language.toLowerCase().startsWith("zh") ? "Chinese" : "English")
  const [pendingJobID, setPendingJobID] = useState("")
  const [pendingOperation, setPendingOperation] = useState<AIOperation | null>(null)
  const [sessionID, setSessionID] = useState("")
  const [message, setMessage] = useState("")
  const activeProfile = props.profiles.find((profile) => profile.id === profileID && profile.enabled)
    ?? props.profiles.find((profile) => profile.is_default && profile.enabled)
    ?? props.profiles.find((profile) => profile.enabled)
  const activeProfileID = activeProfile?.id ?? ""

  const job = useQuery({
    queryKey: ["job", pendingJobID],
    queryFn: ({ signal }) => getJob(pendingJobID, signal),
    enabled: pendingJobID !== "",
    refetchInterval: (query) => query.state.data?.state === "queued" || query.state.data?.state === "running" ? 700 : false,
  })
  const jobActive = job.data?.state === "queued" || job.data?.state === "running"
  const results = useQuery({
    queryKey: ["ai-results", props.entryID],
    queryFn: ({ signal }) => listAIResults(props.entryID, signal),
    enabled: open && props.profiles.length > 0,
  })
  const chat = useQuery({
    queryKey: ["ai-chat", sessionID],
    queryFn: ({ signal }) => getAIChat(sessionID, signal),
    enabled: sessionID !== "",
  })

  useEffect(() => {
    if (!pendingJobID || !job.data || jobActive || job.data.state === "failed") return
    if (job.data.state === "succeeded") {
      if (pendingOperation) void queryClient.invalidateQueries({ queryKey: ["ai-results", props.entryID] })
      else if (sessionID) void queryClient.invalidateQueries({ queryKey: ["ai-chat", sessionID] })
      void queryClient.invalidateQueries({ queryKey: ["ai-usage"] })
    }
  }, [job.data, jobActive, pendingJobID, pendingOperation, props.entryID, queryClient, sessionID])

  const operationMutation = useMutation({
    mutationFn: ({ operation, profile, targetLanguage }: { operation: AIOperation; profile: string; targetLanguage: string }) =>
      runAIOperation(props.entryID, operation, profile, targetLanguage),
    onSuccess: (response, variables) => {
      setPendingOperation(response.job ? variables.operation : null)
      if (response.result) {
        queryClient.setQueryData<ListResponse<AIResult>>(["ai-results", props.entryID], (current) => ({ items: [response.result!, ...(current?.items.filter((item) => item.id !== response.result!.id) ?? [])] }))
      }
      setPendingJobID(response.job?.id ?? "")
      void queryClient.invalidateQueries({ queryKey: ["ai-results", props.entryID] })
    },
  })
  const chatMutation = useMutation({
    mutationFn: (input: { profile: string; text: string }) => startAIChat(props.entryID, input.profile, sessionID || undefined, input.text),
    onSuccess: (response) => {
      setSessionID(response.session.id)
      setPendingJobID(response.job.id)
      setPendingOperation(null)
      setMessage("")
      queryClient.setQueryData<AIChatSession>(["ai-chat", response.session.id], response.session)
    },
  })
  const cancelMutation = useMutation({
    mutationFn: cancelJob,
    onSuccess: () => void job.refetch(),
  })
  const latestResult = results.data?.items.find((item) => item.operation === mode)
  const error = operationMutation.error ?? chatMutation.error ?? cancelMutation.error ?? (job.data?.state === "failed" ? new Error(job.data.error_message ?? "AI task failed") : null)
  const startOperation = (operation: AIOperation) => {
    if (!activeProfileID) return
    operationMutation.mutate({ operation, profile: activeProfileID, targetLanguage: operation === "translation" ? language : language })
  }
  const submitChat = (event: FormEvent) => {
    event.preventDefault()
    if (!activeProfileID || !message.trim() || jobActive) return
    chatMutation.mutate({ profile: activeProfileID, text: message.trim() })
  }

  return (
    <section className={open ? "ai-workbench ai-workbench--open" : "ai-workbench"} aria-label="AI assistant" aria-busy={jobActive}>
      <button className="ai-workbench__toggle" type="button" aria-expanded={open} aria-controls="ai-workbench-panel" onClick={() => setOpen((value) => !value)}><Brain /><span>AI</span></button>
      {open && <div className="ai-workbench__body" id="ai-workbench-panel">
        {!activeProfile ? <button className="button button--secondary" type="button" onClick={props.onConfigure}><Brain />Configure AI</button> : <>
          <div className="ai-workbench__controls">
            <select className="select-input ai-profile-select" aria-label="AI provider" value={activeProfileID} onChange={(event) => setProfileID(event.target.value)}>
              {props.profiles.filter((profile) => profile.enabled).map((profile) => <option value={profile.id} key={profile.id}>{profile.name}</option>)}
            </select>
            <select className="select-input ai-language-select" aria-label="AI response language" value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="English">English</option>
              <option value="Chinese">Chinese</option>
              <option value="Japanese">Japanese</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
            </select>
          </div>
          <div className="ai-mode-tabs" role="tablist" aria-label="AI tools">
            {operations.map((operation) => { const Icon = operation.icon; return <button className={mode === operation.id ? "ai-mode-tab ai-mode-tab--active" : "ai-mode-tab"} id={`ai-tab-${operation.id}`} type="button" role="tab" aria-controls="ai-tool-panel" aria-selected={mode === operation.id} key={operation.id} onClick={() => setMode(operation.id)}><Icon />{operation.label}</button> })}
            <button className={mode === "chat" ? "ai-mode-tab ai-mode-tab--active" : "ai-mode-tab"} id="ai-tab-chat" type="button" role="tab" aria-controls="ai-tool-panel" aria-selected={mode === "chat"} onClick={() => setMode("chat")}><ChatCircle />Chat</button>
          </div>
          {mode === "chat" ? <div className="ai-chat" id="ai-tool-panel" role="tabpanel" aria-labelledby="ai-tab-chat">
            <div className="ai-chat__messages" aria-live="polite">
              {chat.data?.messages.map((item) => <div className={`ai-chat__message ai-chat__message--${item.role}`} key={item.id}><strong>{item.role === "user" ? "You" : activeProfile?.name ?? "AI"}</strong><p>{item.content}</p></div>)}
            </div>
            <form className="ai-chat__form" onSubmit={submitChat}>
              <textarea className="text-input" aria-label="Ask about this article" placeholder="Ask about this article" maxLength={4000} value={message} onChange={(event) => setMessage(event.target.value)} />
              <button className="button button--primary" type="submit" disabled={!message.trim() || !activeProfileID || jobActive || chatMutation.isPending}>{chatMutation.isPending || jobActive ? <CircleNotch className="spin" /> : <ChatCircle />}Ask</button>
            </form>
          </div> : <div className="ai-operation" id="ai-tool-panel" role="tabpanel" aria-labelledby={`ai-tab-${mode}`}>
            <button className="button button--primary" type="button" disabled={!activeProfileID || jobActive || operationMutation.isPending} onClick={() => startOperation(mode)}>{operationMutation.isPending || (jobActive && pendingOperation === mode) ? <CircleNotch className="spin" /> : <Brain />}Run {operations.find((item) => item.id === mode)?.label}</button>
            {latestResult && <div className="ai-result" aria-live="polite"><p>{latestResult.result_text}</p><small>{latestResult.usage.total_tokens ?? 0} tokens</small></div>}
          </div>}
          {jobActive && <button className="button button--quiet ai-cancel" type="button" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate(pendingJobID)}><Stop />Cancel</button>}
          {error && <p className="form-error" role="alert">{error.message}</p>}
        </>}
      </div>}
    </section>
  )
}
