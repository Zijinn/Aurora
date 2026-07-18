import {
  ArrowSquareOut,
  ArrowsClockwise,
  CaretRight,
  Check,
  CopySimple,
  FolderSimple,
  Timer,
  Trash,
} from "@phosphor-icons/react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import type { Folder, Subscription, ViewMode } from "../api/types"
import { useTranslation } from "../lib/i18n"

interface SubscriptionContextMenuProps {
  subscription: Subscription
  folders: Folder[]
  position: { x: number; y: number }
  onClose: () => void
  onMarkRead: () => void
  onRefresh: () => void
  onMove: (folderID: string | null) => void
  onDelete: () => void
  onOpenSource: () => void
  onOpenWebsite: () => void
  onCopyID: () => void
  onChangeView: (viewMode: ViewMode) => void
  onChangeRefresh: (policy: Subscription["refresh_policy"], intervalMinutes: number) => void
}

const viewModes: Array<{ value: ViewMode; labelKey: string }> = [
  { value: "compact", labelKey: "compact" },
  { value: "standard", labelKey: "standard" },
  { value: "card", labelKey: "cards" },
  { value: "magazine", labelKey: "magazine" },
  { value: "image", labelKey: "images" },
]

export function SubscriptionContextMenu(props: SubscriptionContextMenuProps) {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [refreshOpen, setRefreshOpen] = useState(false)
  const [position, setPosition] = useState(props.position)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) props.onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose()
    }
    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [props])

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const inset = 10
    setPosition({
      x: Math.max(inset, Math.min(props.position.x, window.innerWidth - menu.offsetWidth - inset)),
      y: Math.max(
        inset,
        Math.min(props.position.y, window.innerHeight - menu.offsetHeight - inset),
      ),
    })
  }, [props.position])

  const run = (action: () => void) => {
    action()
    props.onClose()
  }

  const menu = (
    <div
      ref={menuRef}
      className="subscription-context-menu"
      role="menu"
      aria-label={props.subscription.title}
      style={{ left: position.x, top: position.y }}
    >
      <div className="subscription-context-menu__title" title={props.subscription.title}>
        {props.subscription.title}
      </div>
      <button
        className="subscription-context-menu__item"
        type="button"
        role="menuitem"
        onClick={() => run(props.onMarkRead)}
      >
        <Check aria-hidden="true" />
        <span>{t("markAllRead")}</span>
      </button>
      <button
        className="subscription-context-menu__item"
        type="button"
        role="menuitem"
        onClick={() => run(props.onRefresh)}
      >
        <ArrowsClockwise aria-hidden="true" />
        <span>{t("refreshFeed")}</span>
      </button>
      <div className="subscription-context-menu__separator" />
      <div className="subscription-context-menu__submenu">
        <button
          className="subscription-context-menu__item"
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={refreshOpen}
          onPointerEnter={() => setRefreshOpen(true)}
          onClick={() => setRefreshOpen((open) => !open)}
        >
          <Timer aria-hidden="true" />
          <span>{t("refreshPolicy")}</span>
          <CaretRight className="subscription-context-menu__caret" aria-hidden="true" />
        </button>
        {refreshOpen && (
          <div className="subscription-context-menu__submenu-panel" role="menu">
            {[
              { policy: "inherit" as const, interval: 0, label: "refreshAutomatic" },
              { policy: "fixed" as const, interval: 15, label: "refreshEvery15Minutes" },
              { policy: "fixed" as const, interval: 30, label: "refreshEvery30Minutes" },
              { policy: "fixed" as const, interval: 60, label: "refreshEveryHour" },
              { policy: "never" as const, interval: 0, label: "refreshManualOnly" },
            ].map((option) => {
              const active =
                props.subscription.refresh_policy === option.policy &&
                (option.policy !== "fixed" || props.subscription.refresh_interval_minutes === option.interval)
              return (
                <button
                  className="subscription-context-menu__item"
                  type="button"
                  role="menuitem"
                  key={`${option.policy}-${option.interval}`}
                  onClick={() => run(() => props.onChangeRefresh(option.policy, option.interval))}
                >
                  {active ? <Check aria-hidden="true" /> : <span className="subscription-context-menu__icon-spacer" />}
                  <span>{t(option.label)}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div className="subscription-context-menu__separator" />
      <div className="subscription-context-menu__submenu">
        <button
          className="subscription-context-menu__item"
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={folderOpen}
          onPointerEnter={() => setFolderOpen(true)}
          onClick={() => setFolderOpen((open) => !open)}
        >
          <FolderSimple aria-hidden="true" />
          <span>{t("moveToFolder")}</span>
          <CaretRight className="subscription-context-menu__caret" aria-hidden="true" />
        </button>
        {folderOpen && (
          <div className="subscription-context-menu__submenu-panel" role="menu">
            <button
              className="subscription-context-menu__item"
              type="button"
              role="menuitem"
              onClick={() => run(() => props.onMove(null))}
            >
              <span className="subscription-context-menu__folder-indent">{t("noFolder")}</span>
            </button>
            {props.folders.map((folder) => (
              <button
                className="subscription-context-menu__item"
                type="button"
                role="menuitem"
                key={folder.id}
                onClick={() => run(() => props.onMove(folder.id))}
              >
                <span className="subscription-context-menu__folder-indent">{folder.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="subscription-context-menu__separator" />
      <button
        className="subscription-context-menu__item"
        type="button"
        role="menuitem"
        onClick={() => run(props.onOpenSource)}
      >
        <ArrowSquareOut aria-hidden="true" />
        <span>{t("openFeedSource")}</span>
      </button>
      {props.subscription.site_url && (
        <button
          className="subscription-context-menu__item"
          type="button"
          role="menuitem"
          onClick={() => run(props.onOpenWebsite)}
        >
          <ArrowSquareOut aria-hidden="true" />
          <span>{t("openFeedWebsite")}</span>
        </button>
      )}
      <button
        className="subscription-context-menu__item"
        type="button"
        role="menuitem"
        onClick={() => run(props.onCopyID)}
      >
        <CopySimple aria-hidden="true" />
        <span>{t("copyFeedID")}</span>
      </button>
      <div className="subscription-context-menu__separator" />
      <div className="subscription-context-menu__submenu">
        <button
          className="subscription-context-menu__item"
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={viewOpen}
          onPointerEnter={() => setViewOpen(true)}
          onClick={() => setViewOpen((open) => !open)}
        >
          <span className="subscription-context-menu__icon-spacer" />
          <span>{t("changeView")}</span>
          <CaretRight className="subscription-context-menu__caret" aria-hidden="true" />
        </button>
        {viewOpen && (
          <div className="subscription-context-menu__submenu-panel" role="menu">
            {viewModes.map((mode) => (
              <button
                className="subscription-context-menu__item"
                type="button"
                role="menuitem"
                key={mode.value}
                onClick={() => run(() => props.onChangeView(mode.value))}
              >
                {props.subscription.view_mode === mode.value ? (
                  <Check aria-hidden="true" />
                ) : (
                  <span className="subscription-context-menu__icon-spacer" />
                )}
                <span>{t(mode.labelKey)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="subscription-context-menu__separator" />
      <button
        className="subscription-context-menu__item subscription-context-menu__item--danger"
        type="button"
        role="menuitem"
        onClick={() => run(props.onDelete)}
      >
        <Trash aria-hidden="true" />
        <span>{t("unsubscribe")}</span>
      </button>
    </div>
  )

  return createPortal(menu, document.body)
}
