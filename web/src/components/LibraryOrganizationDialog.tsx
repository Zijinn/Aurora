import * as Dialog from "@radix-ui/react-dialog"
import { BracketsCurly, CircleNotch, Funnel, FolderSimple, Plus, Tag, Trash, X } from "@phosphor-icons/react"
import { type FormEvent, useState } from "react"

import type { Folder, Rule, SavedFilter, Tag as TagRecord } from "../api/types"

interface LibraryOrganizationDialogProps {
  open: boolean
  folders: Folder[]
  tags: TagRecord[]
  rules: Rule[]
  savedFilters: SavedFilter[]
  pending: boolean
  error: Error | null
  onOpenChange: (open: boolean) => void
  onCreateFolder: (input: { name: string; parent_id?: string | null }) => void
  onDeleteFolder: (folderID: string) => void
  onCreateTag: (input: { name: string; color?: string | null }) => void
  onDeleteTag: (tagID: string) => void
  onCreateRule: (input: { name: string; enabled?: boolean; priority?: number; conditions: Record<string, unknown>; actions: Record<string, unknown> }) => void
  onDeleteRule: (ruleID: string) => void
  onCreateSavedFilter: (input: { name: string; query: Record<string, unknown> }) => void
  onDeleteSavedFilter: (filterID: string) => void
}

export function LibraryOrganizationDialog(props: LibraryOrganizationDialogProps) {
  const [folderName, setFolderName] = useState("")
  const [parentID, setParentID] = useState("")
  const [tagName, setTagName] = useState("")
  const [tagColor, setTagColor] = useState("#167a72")
  const [ruleName, setRuleName] = useState("")
  const [rulePriority, setRulePriority] = useState("0")
  const [conditions, setConditions] = useState('{"title_contains":""}')
  const [actions, setActions] = useState('{"mark_read":false,"star":false,"read_later":false,"add_tag_ids":[]}')
  const [filterName, setFilterName] = useState("")
  const [filterQuery, setFilterQuery] = useState('{"state":"starred"}')
  const [formError, setFormError] = useState("")

  const submitFolder = (event: FormEvent) => {
    event.preventDefault()
    if (!folderName.trim()) return
    props.onCreateFolder({ name: folderName.trim(), parent_id: parentID || null })
    setFolderName("")
  }
  const submitTag = (event: FormEvent) => {
    event.preventDefault()
    if (!tagName.trim()) return
    props.onCreateTag({ name: tagName.trim(), color: tagColor || null })
    setTagName("")
  }
  const submitRule = (event: FormEvent) => {
    event.preventDefault()
    try {
      const parsedConditions = parseObject(conditions)
      const parsedActions = parseObject(actions)
      if (!ruleName.trim()) return
      setFormError("")
      props.onCreateRule({ name: ruleName.trim(), priority: Number(rulePriority) || 0, conditions: parsedConditions, actions: parsedActions })
      setRuleName("")
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Rule JSON must be an object.")
    }
  }
  const submitFilter = (event: FormEvent) => {
    event.preventDefault()
    try {
      const query = parseObject(filterQuery)
      if (!filterName.trim()) return
      setFormError("")
      props.onCreateSavedFilter({ name: filterName.trim(), query })
      setFilterName("")
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Filter JSON must be an object.")
    }
  }

  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content organization-dialog" aria-describedby={undefined}>
          <div className="dialog-header">
            <Dialog.Title>Library organization</Dialog.Title>
            <Dialog.Close asChild><button className="icon-button" type="button" aria-label="Close" title="Close"><X /></button></Dialog.Close>
          </div>
          <div className="organization-dialog__body">
            <section className="organization-section" aria-labelledby="organization-folders">
              <div className="preference-heading"><h2 id="organization-folders"><FolderSimple />Folders</h2><span>{props.folders.length}</span></div>
              <form className="organization-form" onSubmit={submitFolder}>
                <input className="text-input" aria-label="Folder name" placeholder="Folder name" maxLength={120} value={folderName} onChange={(event) => setFolderName(event.target.value)} />
                <select className="select-input" aria-label="Parent folder" value={parentID} onChange={(event) => setParentID(event.target.value)}>
                  <option value="">No parent</option>
                  {props.folders.map((folder) => <option value={folder.id} key={folder.id}>{folder.name}</option>)}
                </select>
                <button className="button button--secondary" type="submit" disabled={props.pending || !folderName.trim()}><Plus />Add folder</button>
              </form>
              <OrganizationList empty="No folders" items={props.folders.map((folder) => ({ id: folder.id, label: folder.name }))} onDelete={props.onDeleteFolder} />
            </section>

            <section className="organization-section" aria-labelledby="organization-tags">
              <div className="preference-heading"><h2 id="organization-tags"><Tag />Tags</h2><span>{props.tags.length}</span></div>
              <form className="organization-form organization-form--tag" onSubmit={submitTag}>
                <input className="text-input" aria-label="Tag name" placeholder="Tag name" maxLength={120} value={tagName} onChange={(event) => setTagName(event.target.value)} />
                <label className="color-field" title="Tag color"><input type="color" aria-label="Tag color" value={tagColor} onChange={(event) => setTagColor(event.target.value)} /></label>
                <button className="button button--secondary" type="submit" disabled={props.pending || !tagName.trim()}><Plus />Add tag</button>
              </form>
              <OrganizationList empty="No tags" items={props.tags.map((tag) => ({ id: tag.id, label: tag.name, color: tag.color ?? undefined }))} onDelete={props.onDeleteTag} />
            </section>

            <section className="organization-section" aria-labelledby="organization-rules">
              <div className="preference-heading"><h2 id="organization-rules"><BracketsCurly />Automation rules</h2><span>{props.rules.length}</span></div>
              <form className="organization-form organization-form--stacked" onSubmit={submitRule}>
                <input className="text-input" aria-label="Rule name" placeholder="Rule name" maxLength={120} value={ruleName} onChange={(event) => setRuleName(event.target.value)} />
                <input className="text-input" aria-label="Rule priority" type="number" min="0" max="1000000" value={rulePriority} onChange={(event) => setRulePriority(event.target.value)} />
                <textarea className="text-input organization-json" aria-label="Rule conditions JSON" value={conditions} onChange={(event) => setConditions(event.target.value)} />
                <textarea className="text-input organization-json" aria-label="Rule actions JSON" value={actions} onChange={(event) => setActions(event.target.value)} />
                <button className="button button--secondary" type="submit" disabled={props.pending || !ruleName.trim()}><Plus />Add rule</button>
              </form>
              <OrganizationList empty="No automation rules" items={props.rules.map((rule) => ({ id: rule.id, label: `${rule.name} · priority ${rule.priority}` }))} onDelete={props.onDeleteRule} />
            </section>

            <section className="organization-section" aria-labelledby="organization-filters">
              <div className="preference-heading"><h2 id="organization-filters"><Funnel />Saved filters</h2><span>{props.savedFilters.length}</span></div>
              <form className="organization-form organization-form--stacked" onSubmit={submitFilter}>
                <input className="text-input" aria-label="Saved filter name" placeholder="Filter name" maxLength={120} value={filterName} onChange={(event) => setFilterName(event.target.value)} />
                <textarea className="text-input organization-json" aria-label="Saved filter query JSON" value={filterQuery} onChange={(event) => setFilterQuery(event.target.value)} />
                <button className="button button--secondary" type="submit" disabled={props.pending || !filterName.trim()}><Plus />Add saved filter</button>
              </form>
              <OrganizationList empty="No saved filters" items={props.savedFilters.map((filter) => ({ id: filter.id, label: filter.name }))} onDelete={props.onDeleteSavedFilter} />
            </section>
            {props.pending && <CircleNotch className="spin organization-spinner" aria-label="Saving organization" />}
            {(props.error || formError) && <p className="form-error" role="alert">{formError || props.error?.message}</p>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function OrganizationList(props: { empty: string; items: Array<{ id: string; label: string; color?: string }>; onDelete: (id: string) => void }) {
  return <div className="organization-list">
    {props.items.map((item) => <div className="organization-row" key={item.id}><span>{item.color && <i className="organization-swatch" style={{ backgroundColor: item.color }} aria-hidden="true" />}{item.label}</span><button className="icon-button" type="button" aria-label={`Delete ${item.label}`} title={`Delete ${item.label}`} onClick={() => props.onDelete(item.id)}><Trash /></button></div>)}
    {props.items.length === 0 && <p className="preference-empty">{props.empty}</p>}
  </div>
}

function parseObject(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON must be an object.")
  return parsed as Record<string, unknown>
}
