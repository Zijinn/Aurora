import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react"

import { useTranslation } from "../../lib/i18n"

// InlineText renders a value that becomes an input on double-click (or Enter
// when focused) and commits on blur/Enter (Escape cancels). It mirrors the
// original dashboard's inline editing without the global event-delegation hack.
export function InlineText(props: {
  value: string
  placeholder: string
  className?: string
  multiline?: boolean
  onCommit: (value: string) => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(props.value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const startEdit = () => {
    setDraft(props.value)
    setEditing(true)
  }
  const commit = () => {
    setEditing(false)
    // Only PATCH when the trimmed draft actually differs from the stored
    // value, so a no-op blur never writes to the server.
    const next = draft.trim()
    if (next !== props.value) props.onCommit(next)
  }

  if (editing) {
    const shared = {
      ref: (node: HTMLTextAreaElement | HTMLInputElement | null) => {
        inputRef.current = node
      },
      className: "wb-inline-input",
      value: draft,
      onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !props.multiline) {
          e.preventDefault()
          commit()
        }
        if (e.key === "Escape") {
          setDraft(props.value)
          setEditing(false)
        }
      },
    }
    return props.multiline ? <textarea {...shared} rows={4} /> : <input {...shared} type="text" />
  }

  return (
    <span
      className={`wb-editable ${props.className ?? ""}`}
      title={t("editHint")}
      role="button"
      tabIndex={0}
      onDoubleClick={startEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          startEdit()
        }
      }}
    >
      {props.value ? props.value : <span className="wb-muted">{props.placeholder}</span>}
    </span>
  )
}

// ChipEditor edits a list of strings (authors / keywords) as removable,
// reorderable pills. New chips are typed inline (window.prompt never works in
// the desktop WKWebView shell).
export function ChipEditor(props: {
  label: string
  items: string[]
  addPrompt: string
  onChange: (items: string[]) => void
}) {
  const { t } = useTranslation()
  const dragIndex = useRef<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [chipDraft, setChipDraft] = useState("")

  const submitAdd = () => {
    setAdding(false)
    const value = chipDraft.trim()
    setChipDraft("")
    if (!value) return
    props.onChange([...props.items, value])
  }
  const remove = (index: number) => {
    const next = props.items.slice()
    next.splice(index, 1)
    props.onChange(next)
  }
  const onDrop = (event: DragEvent, targetIndex: number) => {
    event.preventDefault()
    event.stopPropagation()
    const from = dragIndex.current
    dragIndex.current = null
    if (from === null || from === targetIndex) return
    const next = props.items.slice()
    const rect = event.currentTarget.getBoundingClientRect()
    const before = event.clientX < rect.left + rect.width / 2
    const [node] = next.splice(from, 1)
    let to = targetIndex
    if (from < to) to -= 1
    next.splice(before ? to : to + 1, 0, node!)
    props.onChange(next)
  }

  return (
    <div className="wb-chip-editor">
      <span className="wb-chip-label">{props.label}</span>
      <span className="wb-chip-list">
        {props.items.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="wb-chip"
            draggable
            onDragStart={(e) => {
              dragIndex.current = index
              e.stopPropagation()
              e.dataTransfer.effectAllowed = "move"
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDrop={(e) => onDrop(e, index)}
          >
            {item}
            <button
              type="button"
              className="wb-chip-del"
              title={t("delete")}
              aria-label={`${t("delete")}: ${item}`}
              onClick={() => remove(index)}
            >
              ✕
            </button>
          </span>
        ))}
        {adding && (
          <input
            className="wb-inline-input"
            autoFocus
            type="text"
            value={chipDraft}
            placeholder={props.addPrompt}
            aria-label={props.addPrompt}
            onChange={(e) => setChipDraft(e.target.value)}
            onBlur={submitAdd}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                submitAdd()
              }
              if (e.key === "Escape") {
                setChipDraft("")
                setAdding(false)
              }
            }}
          />
        )}
      </span>
      <button
        type="button"
        className="wb-chip-add"
        title={t("add")}
        aria-label={t("add")}
        onClick={() => setAdding(true)}
      >
        ＋
      </button>
    </div>
  )
}

// Card is a draggable paper card with reorder support shared across all three
// workbench pages.
export function Card(props: {
  id: string
  onReorder: (fromID: string, toID: string, before: boolean) => void
  children: ReactNode
}) {
  const [dropHint, setDropHint] = useState<"top" | "bottom" | null>(null)
  return (
    <article
      className={`wb-card ${dropHint ? `wb-card--drop-${dropHint}` : ""}`}
      draggable
      onDragStart={(e) => {
        const target = e.target as HTMLElement
        if (target.closest("button, select, input, textarea, .wb-editable, .wb-chip, a")) {
          e.preventDefault()
          return
        }
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/wb-card", props.id)
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("text/wb-card")) return
        e.preventDefault()
        const rect = e.currentTarget.getBoundingClientRect()
        setDropHint(e.clientY < rect.top + rect.height / 2 ? "top" : "bottom")
      }}
      onDragLeave={() => setDropHint(null)}
      onDrop={(e) => {
        const fromID = e.dataTransfer.getData("text/wb-card")
        setDropHint(null)
        if (!fromID || fromID === props.id) return
        e.preventDefault()
        const rect = e.currentTarget.getBoundingClientRect()
        props.onReorder(fromID, props.id, e.clientY < rect.top + rect.height / 2)
      }}
    >
      {props.children}
    </article>
  )
}
