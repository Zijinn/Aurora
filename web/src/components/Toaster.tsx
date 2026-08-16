import { X } from "@phosphor-icons/react"

import { useTranslation } from "../lib/i18n"
import { useToastStore } from "../store/toast"

export function Toaster() {
  const { t } = useTranslation()
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)
  if (toasts.length === 0) return null
  return (
    <div className="toast-stack" role="status">
      {toasts.map((item) => (
        <div className="toast" key={item.id}>
          <span>{item.message}</span>
          <button
            className="icon-button icon-button--small"
            type="button"
            aria-label={t("close")}
            title={t("close")}
            onClick={() => dismiss(item.id)}
          >
            <X />
          </button>
        </div>
      ))}
    </div>
  )
}
