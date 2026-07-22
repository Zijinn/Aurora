import { FolderOpen, PencilSimple } from "@phosphor-icons/react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import type { Folder } from "../api/types"
import { useTranslation } from "../lib/i18n"

interface FolderContextMenuProps {
  folder: Folder
  position: { x: number; y: number }
  onClose: () => void
  onRename: () => void
}

export function FolderContextMenu(props: FolderContextMenuProps) {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)
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

  const menu = (
    <div
      ref={menuRef}
      className="subscription-context-menu"
      role="menu"
      aria-label={props.folder.name}
      style={{ left: position.x, top: position.y }}
    >
      <div
        className="subscription-context-menu__title subscription-context-menu__title--folder"
        title={props.folder.name}
      >
        <FolderOpen aria-hidden="true" />
        {props.folder.name}
      </div>
      <button
        className="subscription-context-menu__item"
        type="button"
        role="menuitem"
        onClick={() => {
          props.onRename()
          props.onClose()
        }}
      >
        <PencilSimple aria-hidden="true" />
        <span>{t("rename")}</span>
      </button>
    </div>
  )

  return createPortal(menu, document.body)
}
