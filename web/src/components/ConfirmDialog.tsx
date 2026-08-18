import * as Dialog from "@radix-ui/react-dialog"

import { useTranslation } from "../lib/i18n"

interface ConfirmDialogProps {
  open: boolean
  message: string
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

// Replaces window.confirm: the desktop WKWebView never shows native JS
// dialogs and answers false, which silently swallowed every guarded action.
export function ConfirmDialog(props: ConfirmDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content dialog-content--confirm"
          aria-describedby={undefined}
        >
          <div className="dialog-header">
            <Dialog.Title>{t("confirmTitle")}</Dialog.Title>
          </div>
          <p className="confirm-dialog__message">{props.message}</p>
          <div className="dialog-actions">
            <Dialog.Close asChild>
              <button className="button button--secondary" type="button">
                {t("cancel")}
              </button>
            </Dialog.Close>
            <button
              className="button button--danger"
              type="button"
              autoFocus
              onClick={props.onConfirm}
            >
              {t("confirm")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
