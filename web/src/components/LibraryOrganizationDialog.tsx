import * as Dialog from "@radix-ui/react-dialog"
import {
  BracketsCurly,
  CircleNotch,
  Funnel,
  FolderSimple,
  Plus,
  Tag,
  Trash,
  X,
} from "@phosphor-icons/react"
import { type FormEvent, useState } from "react"

import type { Folder, Rule, SavedFilter, Tag as TagRecord } from "../api/types"
import { useTranslation } from "../lib/i18n"

interface LibraryOrganizationDialogProps {
  open: boolean
  mode?: "all" | "folders"
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
  onCreateRule: (input: {
    name: string
    enabled?: boolean
    priority?: number
    conditions: Record<string, unknown>
    actions: Record<string, unknown>
  }) => void
  onDeleteRule: (ruleID: string) => void
  onCreateSavedFilter: (input: { name: string; query: Record<string, unknown> }) => void
  onDeleteSavedFilter: (filterID: string) => void
}

export function LibraryOrganizationDialog(props: LibraryOrganizationDialogProps) {
  const { t } = useTranslation()
  const [folderName, setFolderName] = useState("")
  const [parentID, setParentID] = useState("")
  const [tagName, setTagName] = useState("")
  const [tagColor, setTagColor] = useState("#167a72")
  const [ruleName, setRuleName] = useState("")
  const [rulePriority, setRulePriority] = useState("0")
  const [conditions, setConditions] = useState('{"title_contains":""}')
  const [actions, setActions] = useState(
    '{"mark_read":false,"star":false,"read_later":false,"add_tag_ids":[]}',
  )
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
      const parsedConditions = parseObject(conditions, t("jsonMustBeObject"))
      const parsedActions = parseObject(actions, t("jsonMustBeObject"))
      if (!ruleName.trim()) return
      setFormError("")
      props.onCreateRule({
        name: ruleName.trim(),
        priority: Number(rulePriority) || 0,
        conditions: parsedConditions,
        actions: parsedActions,
      })
      setRuleName("")
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("jsonMustBeObject"))
    }
  }
  const submitFilter = (event: FormEvent) => {
    event.preventDefault()
    try {
      const query = parseObject(filterQuery, t("jsonMustBeObject"))
      if (!filterName.trim()) return
      setFormError("")
      props.onCreateSavedFilter({ name: filterName.trim(), query })
      setFilterName("")
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("jsonMustBeObject"))
    }
  }

  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={
            props.mode === "folders"
              ? "dialog-content organization-dialog organization-dialog--folders"
              : "dialog-content organization-dialog"
          }
          aria-describedby={undefined}
        >
          <div className="dialog-header">
            <Dialog.Title>
              {props.mode === "folders" ? t("manageFolders") : t("organization")}
            </Dialog.Title>
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
          <div className="organization-dialog__body">
            <section className="organization-section" aria-labelledby="organization-folders">
              <div className="preference-heading">
                <h2 id="organization-folders">
                  <FolderSimple />
                  {t("folders")}
                </h2>
                <span>{props.folders.length}</span>
              </div>
              <form className="organization-form" onSubmit={submitFolder}>
                <input
                  className="text-input"
                  aria-label={t("folderName")}
                  placeholder={t("folderName")}
                  maxLength={120}
                  value={folderName}
                  onChange={(event) => setFolderName(event.target.value)}
                />
                <select
                  className="select-input"
                  aria-label={t("parentFolder")}
                  value={parentID}
                  onChange={(event) => setParentID(event.target.value)}
                >
                  <option value="">{t("noParent")}</option>
                  {props.folders.map((folder) => (
                    <option value={folder.id} key={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
                <button
                  className="button button--secondary"
                  type="submit"
                  disabled={props.pending || !folderName.trim()}
                >
                  <Plus />
                  {t("addFolder")}
                </button>
              </form>
              <OrganizationList
                empty={t("noFolders")}
                items={props.folders.map((folder) => ({ id: folder.id, label: folder.name }))}
                onDelete={props.onDeleteFolder}
              />
            </section>

            {props.mode !== "folders" && (
              <section className="organization-section" aria-labelledby="organization-tags">
                <div className="preference-heading">
                  <h2 id="organization-tags">
                    <Tag />
                    {t("tags")}
                  </h2>
                  <span>{props.tags.length}</span>
                </div>
                <form className="organization-form organization-form--tag" onSubmit={submitTag}>
                  <input
                    className="text-input"
                    aria-label={t("tagName")}
                    placeholder={t("tagName")}
                    maxLength={120}
                    value={tagName}
                    onChange={(event) => setTagName(event.target.value)}
                  />
                  <label className="color-field" title={t("tagColor")}>
                    <input
                      type="color"
                      aria-label={t("tagColor")}
                      value={tagColor}
                      onChange={(event) => setTagColor(event.target.value)}
                    />
                  </label>
                  <button
                    className="button button--secondary"
                    type="submit"
                    disabled={props.pending || !tagName.trim()}
                  >
                    <Plus />
                    {t("addTag")}
                  </button>
                </form>
                <OrganizationList
                  empty={t("noTags")}
                  items={props.tags.map((tag) => ({
                    id: tag.id,
                    label: tag.name,
                    color: tag.color ?? undefined,
                  }))}
                  onDelete={props.onDeleteTag}
                />
              </section>
            )}

            {props.mode !== "folders" && (
              <section className="organization-section" aria-labelledby="organization-rules">
                <div className="preference-heading">
                  <h2 id="organization-rules">
                    <BracketsCurly />
                    {t("automationRules")}
                  </h2>
                  <span>{props.rules.length}</span>
                </div>
                <form
                  className="organization-form organization-form--stacked"
                  onSubmit={submitRule}
                >
                  <input
                    className="text-input"
                    aria-label={t("ruleName")}
                    placeholder={t("ruleName")}
                    maxLength={120}
                    value={ruleName}
                    onChange={(event) => setRuleName(event.target.value)}
                  />
                  <input
                    className="text-input"
                    aria-label={t("rulePriority")}
                    type="number"
                    min="0"
                    max="1000000"
                    value={rulePriority}
                    onChange={(event) => setRulePriority(event.target.value)}
                  />
                  <textarea
                    className="text-input organization-json"
                    aria-label={t("ruleConditionsJSON")}
                    value={conditions}
                    onChange={(event) => setConditions(event.target.value)}
                  />
                  <textarea
                    className="text-input organization-json"
                    aria-label={t("ruleActionsJSON")}
                    value={actions}
                    onChange={(event) => setActions(event.target.value)}
                  />
                  <button
                    className="button button--secondary"
                    type="submit"
                    disabled={props.pending || !ruleName.trim()}
                  >
                    <Plus />
                    {t("addRule")}
                  </button>
                </form>
                <OrganizationList
                  empty={t("noAutomationRules")}
                  items={props.rules.map((rule) => ({
                    id: rule.id,
                    label: `${rule.name} · ${t("priority")} ${rule.priority}`,
                  }))}
                  onDelete={props.onDeleteRule}
                />
              </section>
            )}

            {props.mode !== "folders" && (
              <section className="organization-section" aria-labelledby="organization-filters">
                <div className="preference-heading">
                  <h2 id="organization-filters">
                    <Funnel />
                    {t("savedFilters")}
                  </h2>
                  <span>{props.savedFilters.length}</span>
                </div>
                <form
                  className="organization-form organization-form--stacked"
                  onSubmit={submitFilter}
                >
                  <input
                    className="text-input"
                    aria-label={t("savedFilterName")}
                    placeholder={t("savedFilterName")}
                    maxLength={120}
                    value={filterName}
                    onChange={(event) => setFilterName(event.target.value)}
                  />
                  <textarea
                    className="text-input organization-json"
                    aria-label={t("savedFilterQueryJSON")}
                    value={filterQuery}
                    onChange={(event) => setFilterQuery(event.target.value)}
                  />
                  <button
                    className="button button--secondary"
                    type="submit"
                    disabled={props.pending || !filterName.trim()}
                  >
                    <Plus />
                    {t("addSavedFilter")}
                  </button>
                </form>
                <OrganizationList
                  empty={t("noSavedFilters")}
                  items={props.savedFilters.map((filter) => ({
                    id: filter.id,
                    label: filter.name,
                  }))}
                  onDelete={props.onDeleteSavedFilter}
                />
              </section>
            )}
            {props.pending && (
              <CircleNotch
                className="spin organization-spinner"
                aria-label={t("savingOrganization")}
              />
            )}
            {(props.error || formError) && (
              <p className="form-error" role="alert">
                {formError || props.error?.message}
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function OrganizationList(props: {
  empty: string
  items: Array<{ id: string; label: string; color?: string }>
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="organization-list">
      {props.items.map((item) => (
        <div className="organization-row" key={item.id}>
          <span>
            {item.color && (
              <i
                className="organization-swatch"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
            )}
            {item.label}
          </span>
          <button
            className="icon-button"
            type="button"
            aria-label={`${t("delete")} ${item.label}`}
            title={`${t("delete")} ${item.label}`}
            onClick={() => props.onDelete(item.id)}
          >
            <Trash />
          </button>
        </div>
      ))}
      {props.items.length === 0 && <p className="preference-empty">{props.empty}</p>}
    </div>
  )
}

function parseObject(value: string, errorMessage: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(errorMessage)
  return parsed as Record<string, unknown>
}
