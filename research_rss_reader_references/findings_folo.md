# Folo RSS reader research

Research date: 2026-07-18  
Scope: public navigation, source/folder organization, context preservation, and UI interaction patterns. Sources are Folo's public product pages and open-source repository (branch `dev`).

## 1. Product-level navigation and information architecture

Source: [Folo landing page](https://folo.is)  
Source: [Folo README / feature overview](https://github.com/RSSNext/Folo/blob/dev/README.md)

- Folo positions itself as an "AI RSS Reader" and describes a single timeline that organizes subscribed feeds and curated lists. The README calls out "one timeline," favorites, shared lists, collections, and distraction-free browsing.
- The README presents four product surfaces: a customized information hub (subscriptions and curated lists), AI features (translation/summary), dynamic media support (articles, videos, images, audio), and an open community layer. This suggests navigation is centered on reading timelines, with discovery and AI as adjacent modes rather than separate products.
- Public product supports browser, iOS, Android, macOS, Windows and Linux. The same repository contains desktop/web/mobile responsive layouts, so navigation is intended to persist across form factors.

## 2. Desktop shell and primary navigation

Source: [Main desktop layout](https://github.com/RSSNext/Folo/blob/dev/apps/desktop/layer/renderer/src/modules/app-layout/MainDestopLayout.tsx)  
Source: [Subscription column](https://github.com/RSSNext/Folo/blob/dev/apps/desktop/layer/renderer/src/modules/app-layout/subscription-column/SubscriptionColumn.tsx)  
Source: [Subscription column header](https://github.com/RSSNext/Folo/blob/dev/apps/desktop/layer/renderer/src/modules/subscription-column/SubscriptionColumnHeader.tsx)

- The desktop shell is a full-height two-region layout: a persistent subscription column on the left and a flexible main content area on the right. The shell wraps child routes in an `EntriesProvider`, so feed/entry state is available while navigation changes.
- The left header contains the Folo logo (click returns home), a Discover button (`/discover`), profile/login, and a sidebar toggle. This is a compact, always-available global nav.
- The sidebar has timeline tabs for views such as All, Articles, Pictures, Videos, Social Media, Audios and Notifications. Each tab is an icon button with unread count or unread dot, active styling, tooltips, and numeric keyboard shortcuts.
- Timeline tabs support mouse click, keyboard next/previous commands, wheel/trackpad horizontal switching, and a context menu for hiding a tab or opening timeline-tab customization. At least one visible tab is retained when hiding the active tab; navigation falls back to an adjacent visible tab.
- The subscription column is resizable (256-300 px in code), remembers its width, can be collapsed, and temporarily reveals itself when the pointer reaches the left edge. A double-click on the splitter restores the default width; the tooltip documents drag and double-click behavior.

## 3. Source, folder and list organization

Source: [FeedCategory component](https://github.com/RSSNext/Folo/blob/dev/apps/desktop/layer/renderer/src/modules/subscription-column/FeedCategory.tsx)  
Source: [FeedItem component](https://github.com/RSSNext/Folo/blob/dev/apps/desktop/layer/renderer/src/modules/subscription-column/FeedItem.tsx)  
Source: [Subscription column index](https://github.com/RSSNext/Folo/blob/dev/apps/desktop/layer/renderer/src/modules/subscription-column/index.tsx)

- Feeds are displayed under categories/folders. A category is inferred when multiple feeds share a category or a subscription has an explicit category; an optional `autoGroup` setting can derive a default group.
- Categories are collapsible. Open/closed state is stored per view and category (`changeCategoryOpenState` / `toggleCategoryOpenState`), so expanding a folder is a persistent navigation preference, not a one-off DOM state.
- Selecting a category navigates to a folder-level route (the code passes `folderName` and `view`, with no entry selected) and automatically opens/scrolls the category to the active feed when the route points inside it.
- Category headers expose a context menu with: mark all as read, add all feeds to an existing list, create a new list, switch category view type, rename, ungroup, and unsubscribe. Categories are droppable targets for moving selected feeds.
- Feed rows show icon, title, unread count, private-feed indicator, onboarding indicator, and delayed error indicator. A row click navigates to the feed while preserving the current view (notably, the All view); a double-click opens a share URL in a new window.
- Desktop feed rows support multi-selection with modifier keys. Selected feed IDs can be dragged as a group onto a category or timeline view; the drag-end handler batch-updates subscriptions and then clears selection.
- Lists and inboxes are first-class sidebar items alongside feeds. They use the same active/unread treatment, click navigation, double-click share behavior (lists), and context-menu action model.

## 4. Context preservation and URL model

Source: [Folo layout architecture](https://github.com/RSSNext/Folo/blob/dev/apps/desktop/layer/renderer/src/modules/app-layout/LAYOUT_ARCHITECTURE.md)  
Source: [Timeline route layout](https://github.com/RSSNext/Folo/blob/dev/apps/desktop/layer/renderer/src/pages/(main)/(layer)/timeline/%5BtimelineId%5D/layout.tsx)  
Source: [Entry column](https://github.com/RSSNext/Folo/blob/dev/apps/desktop/layer/renderer/src/modules/entry-column/index.tsx)

- Reading routes are nested as `/timeline/:timelineId/:feedId/:entryId`. The parent timeline and feed IDs remain in the URL when an entry is opened, which preserves the reader's source and view context for back/forward, refresh, and shareable URLs.
- Route layouts use nested React Router `Outlet`s: the main shell owns the subscription sidebar, timeline layout owns the entry list/content split, and the entry route renders article content in the right-hand outlet. This keeps the feed list visible while reading an item.
- Timeline IDs are canonicalized in the route loader; aliases are redirected while preserving URL query and hash. This avoids losing filter or view context during normalization.
- Clicking a feed or list explicitly clears `entryId` while retaining the current `view`; clicking a timeline tab clears feed and entry IDs but keeps the selected timeline. These transitions prevent stale article content from leaking into a new source.
- Category navigation passes `folderName` and `view`, while route-aware effects open the relevant category and smoothly scroll the active feed into the center of the sidebar. The source context is therefore visible and re-centered after deep links.
- The entry column tracks a `timelineIdentity` (`view:feedId`) and resets scroll/mark-read interaction state when it changes. Refresh also resets to the top. This prevents scroll position and read-marking state from carrying across feeds.
- Opening an entry marks it read (when logged in and not a collection/pending entry). Scrolling through the virtualized list progressively marks entries read; read-only filters and “mark all read” are exposed in the list header.

## 5. Reading surface and interaction patterns

Source: [Folo layout architecture](https://github.com/RSSNext/Folo/blob/dev/apps/desktop/layer/renderer/src/modules/app-layout/LAYOUT_ARCHITECTURE.md)  
Source: [Entry list header](https://github.com/RSSNext/Folo/blob/dev/apps/desktop/layer/renderer/src/modules/entry-column/layouts/EntryListHeader.tsx)

- The standard desktop reading surface is a resizable two-column layout: entry list on the left, article/content outlet on the right, with a splitter and persistent width settings. A “wide mode” can suppress the splitter for full-width content.
- Entry-list headers are context-aware: they show the current feed/list title and icon, refresh/refetch, unread-only toggle, mark-all-read, picture masonry switch, entry header actions, and optional AI timeline/summary controls depending on the active view and selected entry.
- Discover, power, RSSHub, and action pages are implemented as subviews with a full-screen/modal-style layout, floating glass header and back navigation. This keeps global feed navigation separate from utility/discovery flows while maintaining a clear return path.
- The app supports command-palette/search surfaces (`Cmd+K`, `Cmd+N`, desktop `Cmd+F`) in the global shell. Tooltips and keyboard shortcut labels are attached to icon buttons throughout.

## Design takeaways for an RSS reader implementation

1. Keep a persistent source column visible beside content on desktop; collapse it responsively but provide an obvious reopen affordance.
2. Model navigation as `timeline -> feed/folder -> entry`, and retain those identifiers in URLs so an opened article never loses its source context.
3. Treat categories/folders as actionable objects: collapse state, unread totals, drag/drop targets, rename/ungroup/unsubscribe menus, and direct folder-level routes.
4. Preserve the current view when switching feeds; clear only the deeper selection (`entryId`) to avoid stale content.
5. Make unread state visible at both timeline and source levels, and provide both progressive mark-as-read on scroll and explicit mark-all controls.
6. Use compact icon controls with tooltips/shortcuts for frequent actions, and reserve full-screen subviews for discovery or utility workflows.
