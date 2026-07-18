import * as Dialog from "@radix-ui/react-dialog"
import { CircleNotch, Plus, UploadSimple, X } from "@phosphor-icons/react"
import { type FormEvent, useRef, useState } from "react"

import type { Folder } from "../api/types"
import { APIError } from "../api/client"
import { useTranslation } from "../lib/i18n"

interface AddFeedDialogProps {
  open: boolean
  folders: Folder[]
  addPending: boolean
  importPending: boolean
  error: Error | null
  onOpenChange: (open: boolean) => void
  onAdd: (url: string, folderID?: string) => void
  onImport: (file: File) => void
}

export function AddFeedDialog(props: AddFeedDialogProps) {
  const { t } = useTranslation()
  const [url, setURL] = useState("")
  const [folderID, setFolderID] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!url.trim()) return
    props.onAdd(url.trim(), folderID || undefined)
  }
  const onFile = (file?: File) => {
    if (file) props.onImport(file)
    if (fileInput.current) fileInput.current.value = ""
  }
  const errorMessage = props.error instanceof APIError && props.error.code === "invalid_opml"
    ? t("invalidOPML")
    : props.error?.message
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" aria-describedby={undefined}>
          <div className="dialog-header">
            <Dialog.Title>{t("addSubscriptionTitle")}</Dialog.Title>
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
          <form className="dialog-form" onSubmit={submit}>
            <label className="field-label" htmlFor="feed-url">
              {t("feedOrWebsiteURL")}
            </label>
            <input
              id="feed-url"
              className="text-input"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="https://example.com/feed.xml"
              value={url}
              onChange={(event) => setURL(event.target.value)}
              autoFocus
            />
            <p className="field-hint">{t("rssHubHint")}</p>
            <label className="field-label" htmlFor="feed-folder">
              {t("folder")}
            </label>
            <select
              id="feed-folder"
              className="select-input"
              value={folderID}
              onChange={(event) => setFolderID(event.target.value)}
            >
              <option value="">{t("noFolder")}</option>
              {props.folders.map((folder) => (
                <option value={folder.id} key={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
            {errorMessage && (
              <p className="form-error" role="alert">
                {errorMessage}
              </p>
            )}
            <div className="dialog-actions">
              <input
                ref={fileInput}
                className="sr-only"
                type="file"
                accept=".opml,.xml,text/xml,application/xml"
                onChange={(event) => onFile(event.target.files?.[0])}
              />
              <button
                className="button button--secondary"
                type="button"
                disabled={props.importPending}
                onClick={() => fileInput.current?.click()}
              >
                {props.importPending ? <CircleNotch className="spin" /> : <UploadSimple />}
                {t("importOPML")}
              </button>
              <button
                className="button button--primary"
                type="submit"
                disabled={!url.trim() || props.addPending}
              >
                {props.addPending ? <CircleNotch className="spin" /> : <Plus />}
                {t("addFeed")}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
