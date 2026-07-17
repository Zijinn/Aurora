import * as Dialog from "@radix-ui/react-dialog"
import { Books, FolderSimple, Funnel, RssSimple, Tag as TagIcon, X } from "@phosphor-icons/react"

import type { Folder, LibraryScope, SavedFilter, Subscription, Tag } from "../api/types"
import { useTranslation } from "../lib/i18n"

interface MobileLibraryDialogProps {
  open: boolean
  scope: LibraryScope
  folders: Folder[]
  subscriptions: Subscription[]
  tags: Tag[]
  savedFilters: SavedFilter[]
  onOpenChange: (open: boolean) => void
  onScopeChange: (scope: LibraryScope) => void
}

export function MobileLibraryDialog(props: MobileLibraryDialogProps) {
  const { t } = useTranslation()
  const select = (scope: LibraryScope) => {
    props.onScopeChange(scope)
    props.onOpenChange(false)
  }
  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content mobile-library-dialog" aria-describedby={undefined}>
          <div className="dialog-header">
            <Dialog.Title>{t("library")}</Dialog.Title>
            <Dialog.Close asChild><button className="icon-button" type="button" aria-label={t("close")} title={t("close")}><X /></button></Dialog.Close>
          </div>
          <nav className="mobile-library-nav" aria-label={t("librarySources")}>
            <LibraryGroup title={t("library")}>
              <ScopeButton active={props.scope.kind === "all"} icon={Books} label={t("allFeeds")} onClick={() => select({ kind: "all", title: "All feeds" })} />
            </LibraryGroup>
            {props.savedFilters.length > 0 && <LibraryGroup title={t("filters")}>{props.savedFilters.map((filter) => <ScopeButton active={props.scope.kind === "filter" && props.scope.id === filter.id} icon={Funnel} key={filter.id} label={filter.name} onClick={() => select({ kind: "filter", id: filter.id, title: filter.name, query: filter.query })} />)}</LibraryGroup>}
            {props.tags.length > 0 && <LibraryGroup title={t("tags")}>{props.tags.map((tag) => <ScopeButton active={props.scope.kind === "tag" && props.scope.id === tag.id} icon={TagIcon} key={tag.id} label={tag.name} color={tag.color} onClick={() => select({ kind: "tag", id: tag.id, title: tag.name })} />)}</LibraryGroup>}
            {props.folders.length > 0 && <LibraryGroup title={t("folders")}>{props.folders.map((folder) => <ScopeButton active={props.scope.kind === "folder" && props.scope.id === folder.id} icon={FolderSimple} key={folder.id} label={folder.name} onClick={() => select({ kind: "folder", id: folder.id, title: folder.name })} />)}</LibraryGroup>}
            {props.subscriptions.length > 0 && <LibraryGroup title={t("subscriptions")}>{props.subscriptions.map((subscription) => <ScopeButton active={props.scope.kind === "feed" && props.scope.id === subscription.feed_id} icon={RssSimple} key={subscription.id} label={subscription.title} count={subscription.unread_count} onClick={() => select({ kind: "feed", id: subscription.feed_id, title: subscription.title })} />)}</LibraryGroup>}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function LibraryGroup(props: { title: string; children: React.ReactNode }) {
  return <section className="mobile-library-group"><h3>{props.title}</h3>{props.children}</section>
}

function ScopeButton(props: { active: boolean; icon: typeof Books; label: string; color?: string | null; count?: number; onClick: () => void }) {
  const Icon = props.icon
  return <button className={props.active ? "mobile-library-row mobile-library-row--active" : "mobile-library-row"} type="button" aria-current={props.active ? "page" : undefined} onClick={props.onClick}><span className="mobile-library-row__icon" style={props.color ? { backgroundColor: props.color, color: "#fff" } : undefined}><Icon /></span><span>{props.label}</span>{props.count !== undefined && <small>{props.count}</small>}</button>
}
