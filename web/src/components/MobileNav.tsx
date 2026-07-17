import { Books, GearSix, House, Star, Tray } from "@phosphor-icons/react"

import type { LibraryScope } from "../api/types"

interface MobileNavProps {
  scope: LibraryScope
  onScopeChange: (scope: LibraryScope) => void
  onLibrary: () => void
  onPreferences: () => void
}

export function MobileNav(props: MobileNavProps) {
  const items: Array<{ scope: LibraryScope; icon: typeof House }> = [
    { scope: { kind: "today", title: "Today" }, icon: House },
    { scope: { kind: "unread", title: "Unread" }, icon: Tray },
    { scope: { kind: "saved", title: "Saved" }, icon: Star },
  ]
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {items.map(({ scope, icon: Icon }) => {
        const active = props.scope.kind === scope.kind
        return <button className={active ? "mobile-nav__item mobile-nav__item--active" : "mobile-nav__item"} type="button" aria-current={active ? "page" : undefined} key={scope.kind} onClick={() => props.onScopeChange(scope)}><Icon weight={active ? "fill" : "regular"} /><span>{scope.title}</span></button>
      })}
      <button className="mobile-nav__item" type="button" onClick={props.onLibrary}><Books /><span>Library</span></button>
      <button className="mobile-nav__item" type="button" onClick={props.onPreferences}><GearSix /><span>Settings</span></button>
    </nav>
  )
}
