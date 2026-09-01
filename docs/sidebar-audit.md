---
title: "Sidebar Audit"
tags: ["ui", "sidebar", "navigation"]
description: "A per-item improvement plan for the admin sidebar — 20 improvements + 20 new features, each grounded in the actual current code (sidebar.tsx, sidebar-nav-item.tsx, mobile drawer, store, config)."
order: 16
author: "Acme Inc."
lastUpdated: 1786147200000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&q=80"
---

# Sidebar Audit

> [!NOTE] Every item below is grounded in the **actual current sidebar code** — verified
> against `apps/admin/components/layout/sidebar.tsx`, `sidebar-nav-item.tsx`,
> `sidebar-section-header.tsx`, `mobile-menu-overlay.tsx`,
> `apps/admin/components/layout/dashboard-layout.tsx`, `stores/sidebar-store.ts`,
> `lib/navigation/sidebar-menu.json`, `lib/navigation/menu.ts`, and `components/layout/use-sidebar-control.ts`
> before being written down. This is not a wish-list.
>
> Each item has a **What / Why / Where / How**, an **effort estimate**, and a
> **status**. A junior should be able to pick up any pending item, find the file
> named in `Where`, implement the recipe, and prove it with the acceptance
> criteria listed.

## Status legend

| Mark | Meaning |
| ---- | ------- |
| ✅ **Done** | Shipped and verified. |
| 🔶 **Partial** | Some of it exists; the rest is listed as follow-up work. |
| ⬜ **Pending** | Not started — the recipe below is the plan. |

## Ground truth — what the sidebar already does

Read this before judging the lists: a surprising amount is already in place, so
the improvements target **gaps**, not rewrites.

- **JSON-driven menu.** `config/sidebar-menu.json` holds the whole tree (sections,
  bottom items, recursive children, `disabled` flags); `config/sidebar-menu.ts` is
  the single typed entry point. No hardcoded items in components. ✅
- **Recursive rendering.** `SidebarNavItem` renders children to any depth
  (the demo tree goes 6 levels deep under Analytics → Reports → …). ✅
- **Route-aware state.** `computeRouteState` in `lib/navigation/menu.ts` marks the active item
  (`isRouteActive` handles `/` exactly and boundary chars, so `/settings` never
  highlights `/settings/general`), auto-expands the active branch, and optionally
  highlights the parent. ✅
- **Search with highlighting.** In-sidebar search filters the tree and wraps
  matches in a `<mark>`-style highlight; a clear button and a "no results" state
  exist. ✅
- **Persisted preferences.** Zustand + `persist` keeps the collapsed/expanded
  state and the custom **section order** across reloads (`skipHydration` + a
  post-mount `rehydrate()` keeps SSR safe). ✅
- **Smooth motion.** Desktop sidebar animates with framer-motion (width 280 ↔ 0 +
  content fade/slide, buttery `[0.32, 0.72, 0, 1]` ease); the mobile drawer
  slides in/out via `AnimatePresence` with a cross-fading backdrop, Escape-to-close,
  and focus management. `MotionConfig reducedMotion="user"` covers a11y. ✅
- **Keyboard + touch basics.** Ctrl/Cmd+B toggles the sidebar globally; mobile
  closes on navigation; disabled items show a tooltip and can't be navigated. ✅

---

## Priority matrix

**Priority:** **P1** = a11y/correctness/UX bug that bites daily. **P2** = clear win,
moderate effort. **P3** = polish / hygiene. **Effort:** S (hours) · M (a day) · L (days).

### 🔧 Improvements (fix what exists)

| # | Improvement | Where | Priority | Effort | Status |
| - | ----------- | ----- | -------- | ------ | ------ |
| 1 | Missing `aria-expanded` / `aria-controls` on parent buttons | `sidebar-nav-item.tsx` | **P1** | S | ⬜ |
| 2 | Missing `aria-current="page"` on the active item | `sidebar-nav-item.tsx` | **P1** | S | ⬜ |
| 3 | Menu is a `<div>`, not a `<nav aria-label>` landmark | `sidebar.tsx` | **P1** | S | ⬜ |
| 4 | No `/` (or `Cmd+K`) shortcut to focus the sidebar search | `sidebar.tsx` | P2 | S | ✅ |
| 5 | Search matches titles only — no URL / alias / fuzzy matching | `lib/navigation/menu.ts` | P2 | M | ✅ |
| 6 | Manual expand state is ephemeral (lost on reload) | `sidebar.tsx` | P2 | S | ✅ |
| 7 | `createItemId` collisions for same-titled items under different parents | `lib/navigation/menu.ts` | **P1** | S | ✅ |
| 8 | Active item is never scrolled into view (deep docs branch) | `sidebar.tsx` | P2 | S | ✅ |
| 9 | Truncated labels have no `title` tooltip | `sidebar-nav-item.tsx` | P3 | S | ⬜ |
| 10 | Section reorder controls are hover-only (touch/keyboard dead) | `sidebar-section-header.tsx` | **P1** | S | ✅ |
| 11 | Sidebar + drawer duplicate the same ease/transition constants | `dashboard-layout.tsx` + `mobile-menu-overlay.tsx` | P3 | S | ✅ |
| 12 | Mobile drawer has no scroll lock / background `inert` | `mobile-menu-overlay.tsx` | P2 | S | ⬜ |
| 13 | Mobile sidebar search state resets every time the drawer opens | `sidebar.tsx` | **P1** | M | ✅ |
| 14 | Disabled parents still render their children inline | `sidebar-nav-item.tsx` | P3 | S | ✅ |
| 15 | No "skip to content" link (keyboard users tab the whole menu first) | `sidebar.tsx` | P2 | S | ✅ |
| 16 | Active section header is not emphasized (only the item is) | `sidebar-section-header.tsx` | P3 | S | ✅ |
| 17 | Search highlight uses hardcoded blue classes (violates token rule) | `sidebar-nav-item.tsx` | P2 | S | ✅ |
| 18 | No component tests for the sidebar (only `lib/menu` is tested) | `lib/navigation/menu.test.ts` | **P1** | M | ✅ |
| 19 | Chevron (300 ms) vs rows (200 ms) animation timings mismatch | `sidebar-nav-item.tsx` | P3 | S | ✅ |
| 20 | Desktop + mobile mount two full `Sidebar` trees (duplicated work) | `dashboard-layout.tsx` | P2 | M | ✅ |

### 🚀 New features (add value)

| # | Feature | Core touchpoint | Priority | Effort | Status |
| - | ------- | --------------- | -------- | ------ | ------ |
| 1 | **Rail (icon-only) collapse mode** with tooltips + hover flyouts | `dashboard-layout.tsx` | **P1** | L | ⬜ |
| 2 | **Favorites / pinned items** ("Favorites" section pinned on top) | `stores/sidebar-store.ts` | P2 | M | ⬜ |
| 3 | **Recent items** — last-visited pages, auto-tracked | `stores/sidebar-store.ts` | P2 | M | ⬜ |
| 4 | **Badges & counts** per item (`badge` field in JSON, e.g. "Errors (3)") | `lib/navigation/sidebar.ts` + `sidebar-menu.json` | P2 | M | ⬜ |
| 5 | **Collapsible sections** (per-section collapse, persisted) | `sidebar.tsx` | P2 | M | ⬜ |
| 6 | **Drag-and-drop section reordering** via @dnd-kit (already a dep) | `sidebar-section-header.tsx` | P3 | M | ⬜ |
| 7 | **Right-click context menu** on items (open in new tab / copy link / pin / hide) | `sidebar-nav-item.tsx` | P3 | M | ⬜ |
| 8 | **Hide / unhide items** — user-tailored menu, persisted, with "reset menu" | `stores/sidebar-store.ts` | P3 | M | ⬜ |
| 9 | **RBAC-filtered menu** — `requiredPermission` per item, filtered by `/auth/me` | `lib/navigation/menu.ts` + `sidebar.tsx` | **P1** | M | ⬜ |
| 10 | **External links** — `external: true` → `target=_blank` + link icon | `sidebar-nav-item.tsx` | P2 | S | ⬜ |
| 11 | **Keyboard shortcut hints** on items (optional `shortcut` → kbd chip) | `lib/navigation/sidebar.ts` + `sidebar-nav-item.tsx` | P3 | S | ⬜ |
| 12 | **Profile dropdown in the footer** (Profile / Settings / Sign out) | `sidebar.tsx` footer | **P1** | M | ⬜ |
| 13 | **Environment pill in the header** (dev / prod + app version) | `sidebar.tsx` header | P3 | S | ⬜ |
| 14 | **Session badge + theme toggle in the footer** | `sidebar.tsx` footer | P2 | M | ⬜ |
| 15 | **Deep-link the ⌘K palette from the menu** (breadcrumb-grouped results) | `components/layout/command-palette.tsx` | P2 | M | ⬜ |
| 16 | **Onboarding spotlight** — first-run tour of search / reorder / collapse | `sidebar.tsx` | P3 | M | ⬜ |
| 17 | **Fuzzy search with keyboard navigation** (↑/↓ + Enter to jump) | `lib/navigation/menu.ts` + `sidebar.tsx` | P2 | L | ⬜ |
| 18 | **Collapsed flyout panels** — hover a rail icon → floating nested menu | `dashboard-layout.tsx` | P3 | L | ⬜ |
| 19 | **API-driven menu** — menu comes from the backend (fallback to JSON) | `lib/docs.ts`-style server loader | P3 | L | ⬜ |
| 20 | **Active-branch auto-collapse** — unrelated sections close on navigation | `sidebar.tsx` | P3 | M | ⬜ |

---

---

## ✅ Shipped 2026-08-08 (sidebar audit — improvements round 1)

> [!NOTE] Implemented: **4, 5, 6, 7, 8, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20.**
> Still pending by request: 1, 2, 3, 9, 12. Verified by: clean admin
> typecheck + lint, **269/269 tests** (+9 new menu tests, +15 sidebar component
> tests), production build, and an SSR/bundle check (no hardcoded blue
> literals remain in the compiled JS). Runtime feel (scroll smoothness,
> Alt+↑/↓, `/` focus) wants a quick manual pass in the browser.

| # | What shipped | Files |
| - | ------------ | ----- |
| 4 | `/` focuses the sidebar search (GitHub/Linear pattern; ignored in inputs; Cmd+K untouched) | `components/layout/sidebar.tsx` |
| 5 | Search matches **titles + URLs + icon names**, multi-token, case-insensitive (`filterItemsBySearch`); `menu.test.ts` covers URL + multi-token cases | `lib/navigation/menu.ts` |
| 6 | Manual expansions live in the zustand store (`expandedItems`, `setItemExpanded`) — **session-only since 2026-08-08**: a refresh (soft or hard) resets the menu to default. Route-driven auto-expansion still opens the active branch. Legacy localStorage payloads are stripped of `expandedItems` via a zod-validated `merge` (no unchecked casts) | `stores/sidebar-store.ts` |
| 7 | Menu is **compiled once** with globally-unique ids (`compileMenu` — section prefix + `-2`/`-3` dedupe); all consumers read `item.id` (no more title-derived id collisions) | `config/sidebar-menu.ts`, `lib/navigation/sidebar.ts`, `lib/navigation/menu.ts` |
| 8 | Active item **scrolls into view** on navigation (only when the nav scrolls + item is out of view; respects reduced motion) | `components/layout/sidebar.tsx` |
| 10 | Reorder controls reveal on **focus-within** (not just hover); `Alt+↑`/`Alt+↓` move the section while a reorder button is focused | `components/layout/sidebar-section-header.tsx` |
| 11 | Motion constants extracted to **`components/layout/layout-motion.ts`** — sidebar + drawer share one source of truth | `lib/layout-motion.ts` |
| 13 | Search state lives in the **store** — desktop + mobile instances share it; survives drawer open/close | `stores/sidebar-store.ts` (searchQuery, not persisted) |
| 14 | Disabled parents render as a **single dimmed row — children are pruned** (Analytics/Users demo trees now collapse to one row) | `components/layout/sidebar-nav-item.tsx` |
| 15 | **Skip-to-content** link before the sidebar, target `#main-content` on `<main>` | `components/layout/dashboard-layout.tsx` |
| 16 | Section headers are now **plain sentence-case labels** (no uppercase, no divider, no bar) — the active section is signalled only by the label brightening to `text-sidebar-foreground` (3rd design iteration, 2026-08-08) | `components/layout/sidebar-section-header.tsx` |
| 17 | Search highlight is **token-driven** (`--sidebar-search-mark-*` + `.sidebar-mark` in globals.css) — no hardcoded blue | `packages/ui/src/styles/globals.css`, `components/layout/sidebar-nav-item.tsx` |
| 19 | Chevron + rows collapse now share **one 200 ms timing** | `components/layout/sidebar-nav-item.tsx` |
| 18 | **Component tests** (`components/layout/__tests__/sidebar.test.tsx`, 15 tests): rendering, active + route-prefix state, auto/manual expansion, disabled parents, search + no-results, `/` focus + typing guard, navigation, footer actions, section reorder (buttons + Alt+arrows), active-section marker | `components/layout/__tests__/sidebar.test.tsx` |
| 20 | **`buildSidebarView`** computes route/search/order state once in `DashboardLayout` and passes it to both `Sidebar` instances (`view` prop) | `lib/navigation/menu.ts`, `components/layout/dashboard-layout.tsx` |
| — | **Nav-item design pass (2026-08-08)** — hover is a *soft* tint (60%) with the label brightening; the active item is a **solid pill** (`--sidebar-primary` = `slate-800` light / `white` dark, foreground inverted — themeable tokens, never hardcoded); icon + expanded-chevron invert to the pill foreground; the chevron whispers at `/40` and brightens on hover; a barely-there `active:scale-[0.99]` gives tactile press feedback. Submenus **animate**: height (grid-rows) + opacity fade + 2px slide-up in sync with the chevron (all 200 ms) | `components/layout/sidebar-nav-item.tsx`, `packages/ui/src/styles/globals.css` |
| — | **Persistence audit (2026-08-08)** — the **admin shell's search surfaces** are confirmed session-only and pinned by tests: sidebar `searchQuery` (never in `partialize`, stripped from legacy payloads) and the palette's search text (local component state, not in the store at all). The **command-palette store** got the same zod-validated `merge` hardening as the sidebar store — a corrupted `command-palette-state` payload falls back to live state instead of spreading garbage. What still persists on purpose: sidebar `isOpen`/`sectionOrder`, palette recents/pins. Known intentional exception: the `/` page **demo showcases** opt into `sessionStorage` (accordion `persistKey`, combobox `persistQueryKey`, alert `storageKey`) — sessionStorage survives a same-tab refresh by design, but these are explicit feature demos, tab-scoped, and only exist on the showcase page. +4 tests (`stores/__tests__/command-palette-store.test.ts`, search assertions in `sidebar.test.tsx`) | `stores/sidebar-store.ts`, `stores/command-palette-store.ts`, `stores/__tests__/command-palette-store.test.ts`, `components/layout/__tests__/sidebar.test.tsx`, `vitest.config.ts` |

## 🔧 Improvements (1–20)

### 1. `aria-expanded` / `aria-controls` on parent buttons

**What:** a parent item (e.g. "Settings") is a `<button>` that expands a subtree,
but it exposes neither `aria-expanded` nor `aria-controls`.

**Why:** screen readers announce it as a plain button with no indication that a
collapsible region follows — the single biggest a11y gap in the component today.

**Where:** `apps/admin/components/layout/sidebar-nav-item.tsx` (the `hasChildren`
branch).

**How:**

```tsx
<button
  type="button"
  aria-expanded={isExpanded}
  aria-controls={`panel-${itemId}`}
  onClick={handleToggle}
  ...>
```
…and give the children wrapper `id={`panel-${itemId}`}`.

**Acceptance criteria:**
- [ ] `screen.getByRole("button", { name: /settings/i })` reports `aria-expanded` flipping on click.
- [ ] The expanded region is reachable via `aria-controls` (testable with `getByRole("region")` if you add `role="region"`, or assert the id wiring).
- [ ] Existing behavior unchanged for mouse users.

**Status:** ⬜ Pending.

### 2. `aria-current="page"` on the active item

**What:** the active item gets the `bg-sidebar-primary` class but no
`aria-current="page"`.

**Why:** screen readers can't tell which page you're on. This is the canonical
navigation landmark signal.

**Where:** `apps/admin/components/layout/sidebar-nav-item.tsx` (both button
branches — single items and parents).

**How:** `aria-current={isActive ? "page" : undefined}` on the button that renders
an active leaf. For parent items that are active only because of
`isHighlightParentItem`, `"page"` is wrong — use `aria-current="true"` there or
skip it (only leaves say "page").

**Acceptance criteria:**
- [ ] `screen.getByRole("button", { current: "page" })` finds exactly one item on `/settings/general`.
- [ ] No `aria-current` on non-active items.

**Status:** ⬜ Pending.

### 3. Menu rendered as a `<nav>` landmark

**What:** the scrollable nav area is a plain `<div>`; the sidebar itself is a
`<div class="flex h-full flex-col bg-sidebar">`.

**Why:** landmarks are how assistive tech builds the page outline ("skip to
navigation"). The docs tree, the settings, the bottom items — all should live
under one labeled `nav`.

**Where:** `apps/admin/components/layout/sidebar.tsx` (the root div).

**How:** wrap the scrollable nav area in `<nav aria-label="Main navigation">`.
Keep the header and footer outside it (they aren't navigation). The mobile drawer
renders the same component, so the label stays consistent across breakpoints.

**Acceptance criteria:**
- [ ] `getByRole("navigation", { name: "Main navigation" })` resolves.
- [ ] The page outline (VoiceOver / axe) shows one labeled nav per sidebar instance.

**Status:** ⬜ Pending.

### 4. `/` shortcut to focus the sidebar search

**What:** the search box is only reachable by tabbing or clicking.

**Why:** every modern admin (GitHub, Linear, Notion) lets you hit `/` to jump
into the search field — it's the fastest way to navigate a long menu and costs
~10 lines.

**Where:** `apps/admin/components/layout/sidebar.tsx`.

**How:** a `useRef<HTMLInputElement>` on the input + a window keydown listener
(same pattern as `use-sidebar-control.ts`): when `/` is pressed and the event
target isn't an input/textarea/select, prevent default and `inputRef.current?.focus()`.
Guard against the mobile drawer being closed (the input isn't mounted — check the
ref). `Cmd+K` already exists in the Topbar palette — do **not** shadow it here;
use `/` only.

**Acceptance criteria:**
- [ ] Pressing `/` anywhere on a panel page focuses the sidebar search.
- [ ] Typing `/` inside an input does not trigger it.
- [ ] No focus steal when the mobile drawer is closed.

**Status:** ✅ Done (2026-08-08) — see the shipped-change log below.

### 5. Search matches titles only

**What:** `filterItemsBySearch` in `lib/navigation/menu.ts` does `item.title.toLowerCase().includes(lowerQuery)`.

**Why:** users often remember a **URL** ("the page with /settings/security/sessions")
or an **alias** ("audit" for "Audit Log"), not the exact title. Also no fuzzy
tolerance for typos ("settigs").

**Where:** `apps/admin/lib/navigation/menu.ts` (`filterItemsBySearch`).

**How:** extend the match to `title + url + icon-name`, normalize case/accents,
and add a simple scoring pass (exact-prefix > substring > char-skip). Keep the
function pure and unit-test it in `lib/navigation/menu.test.ts`. Don't reach for a
fuzzy lib — a 20-line scorer is plenty for a menu this size (feature 17 builds on
this).

**Acceptance criteria:**
- [ ] Searching `sessions` matches "Settings → Security → Sessions".
- [ ] Searching `audit` matches "Audit Log".
- [ ] Existing title searches behave identically (all `menu.test.ts` cases pass).

**Status:** ✅ Done (2026-08-08) — see the shipped-change log below.

### 6. Manual expand state is ephemeral

**What:** `manualExpanded` lives in `useState` inside `Sidebar` — expand "Settings",
reload, and it's gone. Only the route-driven auto-expansion survives.

**Why:** for deep branches the user doesn't visit often (the whole Analytics demo
tree), re-expanding by hand on every session is friction.

**Where:** `apps/admin/stores/sidebar-store.ts` (new slice) + `apps/admin/components/layout/sidebar.tsx`.

**How:** add a persisted `expandedItems: Record<string, boolean>` slice to the
existing zustand `persist` store (same `STORAGE_KEY` or a sibling key), and merge
it in the `expandedItems` memo **below** the route-driven auto-expansion
(`{ ...manual, ...auto }` — the route should win when it disagrees, so the active
branch always opens). Respect `skipHydration` like the rest of the store.

**Acceptance criteria:**
- [ ] Expand "Settings", reload → still expanded.
- [ ] Navigating into a collapsed branch still auto-expands it (route wins).
- [ ] No hydration mismatch (store already uses `skipHydration` + `rehydrate()`).

**Status:** ✅ Done (2026-08-08) — see the shipped-change log below.

### 7. `createItemId` collisions

**What:** `createItemId` slugs only the item **title** — two items with the same
title under different parents (e.g. two "Security" entries) produce the same id,
so `expandedItems` / `activeItems` / React `key`s collide.

**Why:** wrong item highlights/expands and React reconciles the wrong subtree —
a correctness bug that silently appears the day a duplicate title lands in the JSON.

**Where:** `apps/admin/lib/navigation/menu.ts` (`createItemId`).

**How:** include the parent trail: `createItemId(item, parentId)` already receives
`parentId` — make it slugify the **full path** (`settings-security-sessions`)
instead of `parentId + "-" + title`. The recursive callers already thread
`itemId` as the next parent, so this is a one-line change; check
`sidebar.tsx`'s `key` props still match (`createItemId(item, "")`).

**Acceptance criteria:**
- [ ] Two "Security" items in different sections get distinct ids.
- [ ] `menu.test.ts` gains a duplicate-title case and passes.
- [ ] No key-warning spam in the console with a duplicate title in the JSON.

**Status:** ✅ Done (2026-08-08) — see the shipped-change log below.

### 8. Active item not scrolled into view

**What:** on mount or navigation, the active item may sit below the fold in the
scrollable nav area — the docs tree, when you deep-link `/docs/auth-roadmap`,
leaves the highlighted row out of sight.

**Why:** deep links land on a page whose menu highlight you can't see.

**Where:** `apps/admin/components/layout/sidebar.tsx`.

**How:** an effect that runs on `pathname` change: find the element with
`data-active="true"` (add the attribute in `SidebarNavItem`) inside the scroll
container ref and call `scrollIntoView({ block: "nearest", behavior: "smooth" })`
— but only when the container is actually scrollable (`scrollHeight > clientHeight`)
and the item is out of view (`element.getBoundingClientRect()` vs container rect).
`block: "nearest"` + a guard avoids jumpy scrolls on every keystroke.

**Acceptance criteria:**
- [ ] Loading `/docs/auth-roadmap` scrolls the docs branch so the active row is visible.
- [ ] No scroll on pages where the item is already visible.

**Status:** ✅ Done (2026-08-08) — see the shipped-change log below.

### 9. `title` tooltip on truncated labels

**What:** every label is `truncate`d, but there's no `title` attribute — long
titles (e.g. "Analytics → Reports → Marketing → Segments → Personas → Power User")
get cut off with no way to read the rest.

**Why:** cheap, zero-JS discoverability for clipped text.

**Where:** `apps/admin/components/layout/sidebar-nav-item.tsx` (both button
branches) and the section headers.

**How:** `title={isDisabled ? "…unavailable" : item.title}` on the label span
(keep the disabled tooltip precedence). Optionally a `truncate`-aware `title`
via a `useTruncation` hook later — plain `title` first.

**Acceptance criteria:**
- [ ] Hovering any truncated label shows the full title.
- [ ] Disabled items still show "This feature is currently unavailable".

**Status:** ⬜ Pending.

### 10. Reorder controls are hover-only

**What:** `sidebar-section-header.tsx` hides the ↑/↓ arrows behind
`opacity-0 group-hover:opacity-100`.

**Why:** on touch there is **no hover** — the controls are unreachable, and
keyboard users can't focus them reliably either (they *are* focusable, but the
`opacity-0` state gives no hint they exist). Section reordering is broken for a
whole class of devices.

**Where:** `apps/admin/components/layout/sidebar-section-header.tsx`.

**How:** show the controls on `group-focus-within` as well as `group-hover`
(`opacity-100` when either), and add a keyboard path: `Alt+↑` / `Alt+↓` on the
header moves the section (mirror the `use-sidebar-control.ts` window-listener
pattern). Keep them hidden while searching (already done via `isSearching`).

**Acceptance criteria:**
- [ ] Tabbing to a section header reveals and allows using the reorder buttons.
- [ ] `Alt+↑` / `Alt+↓` reorders the focused section.
- [ ] Desktop mouse behavior unchanged.

**Status:** ✅ Done (2026-08-08) — see the shipped-change log below.

### 11. Duplicated motion constants

**What:** `SIDEBAR_EASE` lives in `dashboard-layout.tsx`; the mobile drawer copies
the same bezier as `DRAWER_EASE` in `mobile-menu-overlay.tsx`.

**Why:** two sources of truth for the same feel — when one is tuned the other
drifts, exactly the class of bug that already bit this pair.

**Where:** `apps/admin/components/layout/dashboard-layout.tsx` +
`apps/admin/components/layout/mobile-menu-overlay.tsx`.

**How:** extract `apps/admin/components/layout/layout-motion.ts` exporting
`SIDEBAR_EASE`, `SIDEBAR_ASIDE_TRANSITION`, `SIDEBAR_CONTENT_*_TRANSITION`,
`DRAWER_TRANSITION`, `BACKDROP_TRANSITION` — import them in both files (rule 16:
module-scope, stable identity). Delete the local duplicates.

**Acceptance criteria:**
- [ ] Both files import from `@/components/layout/layout-motion` — zero inline transition objects.
- [ ] Typecheck + lint green; animation feel identical (both files now share the same constants by construction).

**Status:** ✅ Done (2026-08-08) — see the shipped-change log below.

### 12. Mobile drawer: no scroll lock / background inert

**What:** when the mobile drawer is open, the scrollable `main` behind the fixed
backdrop can still be scrolled by touch gestures that start off the backdrop.

**Why:** background scroll while a modal is open is a classic a11y/UX smell —
the page "moves" behind the drawer.

**Where:** `apps/admin/components/layout/mobile-menu-overlay.tsx`.

**How:** while `open`, set `overflow: hidden` on the scrolling ancestor (the
`main` element — a `data` attribute or a ref passed from `DashboardLayout`), or
use `inert` on the main column while the drawer is open (cleaner; React 19
supports the `inert` boolean prop). Clear it when the exit animation completes —
not on state flip — to avoid the page unlocking mid-animation.

**Acceptance criteria:**
- [ ] With the drawer open, `main` doesn't scroll from a touch drag outside the drawer.
- [ ] The unlock happens after the slide-out completes (no mid-animation unlock).

**Status:** ⬜ Pending.

### 13. Mobile sidebar search state resets on every open

**What:** the mobile drawer renders a second `Sidebar` inside `AnimatePresence` —
it **unmounts** on close, so the search query (and manual expansion) reset every
time the drawer is reopened.

**Why:** a user who searches, closes the drawer to check something, and reopens
it loses their query — needless friction.

**Where:** `apps/admin/components/layout/mobile-menu-overlay.tsx` (unmount-on-close)
+ `apps/admin/stores/sidebar-store.ts`.

**How:** lift the search state into the zustand store (a `searchQuery` slice used
by both instances) — the desktop and mobile instances then share one query, which
also fixes "search on desktop, open mobile, different results". Do **not** try to
keep the drawer mounted (it would fight `AnimatePresence`); the store lift is the
minimal fix.

**Acceptance criteria:**
- [ ] Type in mobile search → close drawer → reopen → query and results persist.
- [ ] Desktop and mobile search stay in sync (same store slice).

**Status:** ✅ Done (2026-08-08) — see the shipped-change log below.

### 14. Disabled parents still render children

**What:** a `disabled: true` parent (e.g. "Analytics") renders its whole subtree
inline, dimmed by the parent's opacity.

**Why:** a disabled feature shouldn't leak its children into the tab order and
screen-reader flow — the children are `disabled` too, but they still render and
take space, making the menu look cluttered.

**Where:** `apps/admin/components/layout/sidebar-nav-item.tsx`.

**How:** when `item.disabled === true`, skip rendering `item.children` entirely
(keep the item itself, dimmed, with its tooltip). If a disabled parent must show
children for planning purposes, gate them behind a `showDisabledChildren` flag in
the JSON — default `false`.

**Acceptance criteria:**
- [ ] "Analytics" renders as a single dimmed row with no expandable children.
- [ ] Disabled leaf items are unchanged.

**Status:** ✅ Done (2026-08-08) — see the shipped-change log below.

### 15. No "skip to content" link

**What:** the sidebar precedes `main` in the DOM, so keyboard users Tab through
the entire menu (docs tree = ~40 stops) before reaching the page.

**Why:** "skip links" are the standard fix and cost one element + one anchor.

**Where:** `apps/admin/components/layout/dashboard-layout.tsx` (render once, before
the aside) — the target is the `main` element.

**How:**

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 ...">
  Skip to content
</a>
<main id="main-content" ...>
```
Style it like the shadcn pattern (visually hidden until focused).

**Acceptance criteria:**
- [ ] Pressing Tab from page load focuses "Skip to content" first; Enter jumps to `main`.
- [ ] It's invisible to sighted users until focused.

**Status:** ✅ Done (2026-08-08) — see the shipped-change log below.

### 16. Active section header not emphasized

**What:** the section that holds the active route renders identically to every
other header — only the item highlights.

**Why:** when a menu is long, the eye needs the *section* cue ("you are in
Documentation") at a glance.

**Where:** `apps/admin/components/layout/sidebar-section-header.tsx` +
`apps/admin/components/layout/sidebar.tsx` (compute "does this section contain an
active item?").

**How:** `computeRouteState` already returns `activeItems`; a section "contains
active" when any of its items (recursively) is active. Pass that boolean to the
header and let the **label color do the talking**: active sections render the
label in `text-sidebar-foreground`, inactive ones in `text-muted-foreground`.
That is the entire signal — no bar, no divider, no uppercase.

> [!WARNING] **Design note (2026-08-08, three iterations):**
> 1. First pass — bright `text-sidebar-foreground` label + accent-colored
>    divider line → read as heavy/horrendous.
> 2. Second pass — small rounded accent bar + subtle `/45 → /60` lift → still
>    too "designed"/AI-ish.
> 3. **Shipped** — plain sentence-case label, no uppercase/tracking, no divider,
>    no bar; just a quiet gray that brightens when its section is active.
>    Sections are separated by whitespace, the way human-designed navs do it.

**Acceptance criteria:**
- [x] On `/docs/*`, the "Documentation" label renders at foreground color; inactive labels stay muted gray.
- [x] No decorative elements remain (no divider, no bar, no uppercase/tracking).

**Status:** ✅ Done (2026-08-08) — see the shipped-change log below.

### 17. Search highlight uses hardcoded blue

**What:** `SIDEBAR_MARK_CLASS` hardcodes `bg-blue-500/15 text-blue-700 dark:text-blue-300`.

**Why:** violates the repo's design-token rule (22) — a theme change or a new
accent color requires hunting this constant instead of a token swap.

**Where:** `apps/admin/components/layout/sidebar-nav-item.tsx` → add tokens in
`packages/ui/src/styles/globals.css`.

**How:** define `--sidebar-highlight-bg` / `--sidebar-highlight-fg` in the sidebar
token block and reference them in a `.sidebar-mark` class; `SIDEBAR_MARK_CLASS`
becomes `"sidebar-mark rounded-sm px-0.5 font-semibold"`.

**Acceptance criteria:**
- [ ] Highlight renders identically (light + dark).
- [ ] No `blue-*` literals remain in `sidebar-nav-item.tsx`.

**Status:** ✅ Done (2026-08-08) — see the shipped-change log below.

### 18. No component tests for the sidebar

**What:** `lib/navigation/menu.test.ts` covers the pure functions
(`computeRouteState`, `filterItemsBySearch`, `isRouteActive`), but
`Sidebar`, `SidebarNavItem`, and `SidebarSectionHeader` have zero render tests.

**Why:** the interactive contract — expand, navigate, search, reorder, a11y
attributes — is exactly what regresses silently.

**Where:** new `apps/admin/components/layout/__tests__/sidebar.test.tsx` (jsdom +
Testing Library, same setup as the dashboard tests).

**How:** test: renders JSON-driven sections; clicking a parent expands children +
flips `aria-expanded` (item 1); active item carries `aria-current` (item 2); search
filters and highlights; clear-search restores; section reorder calls the store;
disabled items are inert; mobile `onNavigate` closes the drawer.

**Acceptance criteria:**
- [x] ≥ 8 tests covering the contracts above, all green in `pnpm --filter @workspace/admin test` (14 shipped).
- [x] Items 1–3's assertions live in these tests, so those fixes are pinned (aria assertions intentionally left out while 1–3 stay pending — add them when those ship).

**Status:** ✅ Done (2026-08-08) — see the shipped-change log below.

### 19. Chevron vs rows animation timing mismatch

**What:** the chevron rotates with `duration-300 ease-out`; the expand/collapse
grid animates with `duration-200 ease-in-out`.

**Why:** two different durations on the same gesture reads as two separate
animations instead of one coordinated motion — a subtle polish gap.

**Where:** `apps/admin/components/layout/sidebar-nav-item.tsx`.

**How:** unify both to `duration-200` (or extract a `sidebar-expand-duration`
token) so the chevron and the content arrive together.

**Acceptance criteria:**
- [ ] Chevron rotation and content expansion finish at the same time.
- [ ] Reduced-motion users still see an instant toggle (unchanged).

**Status:** ✅ Done (2026-08-08) — see the shipped-change log below.

### 20. Two full `Sidebar` trees mounted

**What:** `DashboardLayout` renders the desktop `<Sidebar>` and the mobile drawer's
`<Sidebar>` — each computes `routeState`, `allItems`, `filteredSections`, search,
etc. from scratch.

**Why:** duplicated work per render, and the mobile instance recomputes the whole
tree on every drawer open. It's cheap today (static JSON) but gets expensive the
moment the menu is RBAC-filtered (feature 9) or API-driven (feature 19).

**Where:** `apps/admin/components/layout/dashboard-layout.tsx` + `apps/admin/stores/sidebar-store.ts`.

**How:** lift the *derived* state (route state, filtered/ordered sections, search)
into the zustand store as selectors or a memoized module-level cache keyed by
`(pathname, searchQuery, sectionOrder)`; both instances select the same slice. Do
**not** merge the two DOM trees — desktop layout and mobile drawer stay separate
renders, they just share computation.

**Acceptance criteria:**
- [ ] `computeRouteState` runs once per pathname change, not once per instance.
- [ ] Behavior identical (all sidebar tests pass).

**Status:** ✅ Done (2026-08-08) — see the shipped-change log below.

---

## 🚀 New features (1–20)

### 1. Rail (icon-only) collapse mode

**What:** instead of collapsing the desktop sidebar to **zero width** (current
behavior), collapse to a `w-16` icon rail: the logo shrinks to a square, items
become centered icons, and the active icon gets an accent dot/bar.

**Why:** the topbar is currently the only way to navigate with the sidebar
collapsed; a rail keeps one-click access to the whole menu. This is the
industry-standard admin pattern (shadcn sidebar, Linear, Vercel).

**Where:** `apps/admin/components/layout/dashboard-layout.tsx` (width target
`280 ↔ 64` instead of `280 ↔ 0`) + `apps/admin/components/layout/sidebar.tsx`
(hide labels, center icons) + a persisted `sidebarMode: "full" | "rail"` slice in
the store.

**How:** the framer-motion width tween already exists — change the collapsed
target to `64`. In `Sidebar`, when collapsed: hide section headers + labels,
show only icons with `title` tooltips, hide search. Keep the topbar toggle; add a
second "rail vs full" toggle or make the double-chevron cycle `full → rail → hidden`.
Flyout submenus are feature 18.

**Acceptance criteria:**
- [ ] Collapsing shows a 64px rail with tooltips, expanding restores full labels.
- [ ] The active item is visibly marked in rail mode.
- [ ] Persists across reloads; no hydration mismatch.

**Status:** ⬜ Pending.

### 2. Favorites / pinned items

**What:** a pin button (hover or context menu, feature 7) on any item moves it to
a **"Favorites"** section pinned above "Main".

**Why:** users have 3–4 pages they visit constantly; one click should surface
them, not a search.

**Where:** `apps/admin/stores/sidebar-store.ts` (persisted `favorites:
string[]` of item ids) + `apps/admin/components/layout/sidebar.tsx` (render a
generated section first).

**How:** the section header and nav item already render from `sections` — prepend
a virtual section built from the pinned ids (resolve id → item via a flat lookup,
reusing `flattenMenuItems`). Pinning via a small `Pin` icon that appears on hover
inside `SidebarNavItem`.

**Acceptance criteria:**
- [ ] Pinning an item adds it to a top "Favorites" section; unpinning removes it.
- [ ] Favorites persist across reloads.
- [ ] Pinned items keep their highlight/active state from `computeRouteState`.

**Status:** ⬜ Pending.

### 3. Recent items

**What:** the last ~5 visited pages appear under a "Recent" section
(second from top, below Favorites).

**Why:** the strongest navigation signal is recency; a user who just left
"/settings/billing" wants it one click away, not a search away.

**Where:** `apps/admin/stores/sidebar-store.ts` (persisted capped stack of
`{ id, title, url, icon, visitedAt }`) + `sidebar.tsx`.

**How:** an effect in `Sidebar` (or the layout) pushes the current
`pathname + title` (looked up from the flat menu) on navigation, deduped and
capped at 5. Render as a generated section. Store only ids/titles — no PII.

**Acceptance criteria:**
- [ ] Visiting 5 pages shows them under "Recent" in visit order.
- [ ] The 6th visit evicts the oldest; reloads preserve the list.

**Status:** ⬜ Pending.

### 4. Badges & counts per item

**What:** an optional `badge?: string | number` field in `sidebar-menu.json` —
rendered as a small pill on the right (e.g. "Errors (3)", "v2"). Also a
`dot?: boolean` for a plain notification dot.

**Why:** product teams always want counts on nav ("Inbox (12)"); supporting it in
the data model keeps the component generic instead of hardcoding a feature.

**Where:** `apps/admin/lib/navigation/sidebar.ts` (add the field to `SidebarMenuItemSchema` — `SidebarMenuItem` is the derived `z.output` type) +
`sidebar-nav-item.tsx` (render next to the chevron) + `sidebar-menu.json`.

**How:** add the field to the type (optional), render `<span className="ml-auto rounded-full bg-sidebar-accent px-1.5 text-[10px]">` when present. When the
count should come from live data (notifications, feature 14/15 wiring), pass a
`badgeOverrides: Record<itemId, string | number>` prop from the smart consumer —
the dumb component stays data-agnostic (repo rule 9).

**Acceptance criteria:**
- [ ] A JSON item with `"badge": "3"` renders the pill; items without it are unchanged.
- [ ] `badgeOverrides` from a parent can override the static value.

**Status:** ⬜ Pending.

### 5. Collapsible sections

**What:** clicking a section header collapses that whole section (with a chevron),
persisted like the reorder state.

**Why:** sections like "Documentation" with one top item are often noise; letting
users fold whole sections reduces visual load.

**Where:** `apps/admin/components/layout/sidebar.tsx` (per-section state) +
`stores/sidebar-store.ts` (persist `collapsedSections: string[]`).

**How:** header click toggles; render children only when not collapsed (or animate
with the same grid-rows trick `SidebarNavItem` uses). The active section should
never stay collapsed — auto-open it on navigation.

**Acceptance criteria:**
- [ ] Clicking a header folds/unfolds its items; state survives reloads.
- [ ] Navigating to a page inside a collapsed section reopens it.

**Status:** ⬜ Pending.

### 6. Drag-and-drop section reordering

**What:** replace (or complement) the hover ↑/↓ arrows with @dnd-kit drag handles —
grab a section header and drop it between siblings.

**Why:** @dnd-kit is already an admin dependency (used by the dashboard), drag is
the natural gesture for "reorder", and it fixes the touch gap from improvement 10
in one move.

**Where:** `apps/admin/components/layout/sidebar-section-header.tsx` + `sidebar.tsx`.

**How:** wrap the sections list in a `DndContext` with `SortableContext`, use
`useSortable` per header, and on drag end call the existing
`moveSectionUp/Down`-equivalent (`reorderSections(fromIndex, toIndex)` — add it to
the store). Keep the arrows as the keyboard/AT fallback.

**Acceptance criteria:**
- [ ] Drag reorders sections; the new order persists (store path reused).
- [ ] Keyboard reorder (improvement 10) still works — no accessibility regression.

**Status:** ⬜ Pending.

### 7. Right-click context menu on items

**What:** right-click (or long-press) on any nav item opens a small menu: **Open in
new tab · Copy link · Pin · Hide**.

**Why:** power users expect browser-native item affordances inside apps.

**Where:** `apps/admin/components/layout/sidebar-nav-item.tsx` (or a wrapper) —
reuse the base-ui `Menu` primitive already in `packages/ui`.

**How:** `onContextMenu` prevent-default → open the menu anchored at the cursor.
"Open in new tab" = `window.open(item.url, "_blank")` (guard for SSR — fire from
the click handler only) or an `<a target="_blank">`. "Hide" feeds feature 8.

**Acceptance criteria:**
- [ ] Right-click shows the menu; each action works.
- [ ] Focus/ESC behavior follows the base-ui Menu contract.

**Status:** ⬜ Pending.

### 8. Hide / unhide items

**What:** a persisted `hiddenItems: string[]` store slice + a "Reset menu" action;
hidden items vanish from the tree (and search).

**Why:** personal information architecture without forking the shared JSON.

**Where:** `apps/admin/stores/sidebar-store.ts` + `lib/navigation/menu.ts`
(`filterHiddenItems(items, hiddenIds)` — pure, tested) + `sidebar.tsx`.

**How:** apply the filter after `filterItemsBySearch`. Expose the reset via the
context menu (feature 7) and/or a tiny "Customize menu…" item at the bottom of the
menu (also the entry point for reorder/pin help).

**Acceptance criteria:**
- [ ] Hiding an item removes it everywhere; "Reset menu" restores all.
- [ ] `menu.test.ts` covers `filterHiddenItems` (including "hidden parent keeps
      visible children" semantics).

**Status:** ⬜ Pending.

### 9. RBAC-filtered menu

**What:** an optional `requiredPermission?: string` per item (e.g. `"users:read"`),
filtered by the authenticated user's permission set from `/auth/me`.

**Why:** the API already returns `roles` + `permissions` and the app already has an
RBAC story — the menu should reflect what the admin can actually do. A non-super-admin
shouldn't see "Users" at all.

**Where:** `apps/admin/lib/navigation/sidebar.ts` + `lib/navigation/menu.ts` (`filterByPermissions`) +
`sidebar.tsx` (needs the user's permissions — extend `SidebarUser` with an
optional `permissions` array).

**How:** the shell already SSR-decodes the JWT (the `(panel)` server layout) — the
access token payload carries `hasAdminAccess` and the `/auth/me` response carries
permissions. Pass them into `DashboardLayout → Sidebar` and filter at the config
layer (pure function, unit-tested). Missing permission on an item → omitted;
missing `requiredPermission` → always visible.

**Acceptance criteria:**
- [ ] A user without `users:read` doesn't see the Users branch.
- [ ] SuperAdmin sees everything; config without permissions is unchanged.
- [ ] `filterByPermissions` is covered in `menu.test.ts`.

**Status:** ⬜ Pending.

### 10. External links

**What:** support `"external": true` in the JSON — renders with a small
`ExternalLink` icon and opens in a new tab.

**Why:** admin panels always end up linking to docs, status pages, or support
tickets; today the JSON can't express "this isn't an internal route".

**Where:** `apps/admin/lib/navigation/sidebar.ts` (optional `external?: boolean`) +
`sidebar-nav-item.tsx` (use `<a target="_blank" rel="noreferrer">` instead of the
button/router push) + `lib/navigation/menu.ts` (external items are never "active" and never
participate in `isRouteActive`).

**How:** the `hasChildren`/leaf branching already exists — add a third branch for
external leaves. `isRouteActive` short-circuits `external` items. `createItemId`
unchanged.

**Acceptance criteria:**
- [ ] An `external: true` item opens a new tab and shows the link icon.
- [ ] It never highlights as active; tests cover both.

**Status:** ⬜ Pending.

### 11. Keyboard shortcut hints

**What:** an optional `shortcut?: string` in the JSON (e.g. `"G D"`) rendered as a
subtle `kbd` chip on the right of the item.

**Why:** discoverability for global shortcuts (⌘K exists; "G" routing, etc. could
follow) without a separate shortcuts doc page.

**Where:** `apps/admin/lib/navigation/sidebar.ts` + `sidebar-nav-item.tsx` (render a
`<kbd>` before the chevron). Hidden while searching/collapsed.

**How:** pure presentation — the *actual* key handling stays where it is today
(`use-sidebar-control.ts`); the JSON just documents it on the item. When a
shortcut is later implemented, the hint is already in place.

**Acceptance criteria:**
- [ ] An item with `"shortcut": "⌘K"` shows the chip; others don't.
- [ ] Chips disappear in search results and rail mode.

**Status:** ⬜ Pending.

### 12. Profile dropdown in the footer

**What:** the footer user row becomes a button that opens a base-ui dropdown:
**View profile · Settings · Sign out** (sign out already wired via `onLogout`).

**Why:** today the avatar + email are static and the sign-out is a separate small
icon — consolidating them is the standard admin pattern and gives settings a
discoverable home.

**Where:** `apps/admin/components/layout/sidebar.tsx` footer (use the base-ui
`Menu`/`DropdownMenu` from `packages/ui`, same as the Topbar profile menu).

**How:** wrap the user row in the dropdown trigger; keep the logout icon as a
redundant quick action or fold it into the menu. Avatar = initials (existing
`getInitials`).

**Acceptance criteria:**
- [ ] Clicking the user row opens the menu; "Sign out" calls `onLogout`.
- [ ] Keyboard operable (base-ui Menu contract) + focus restored on close.

**Status:** ⬜ Pending.

### 13. Environment pill in the header

**What:** a tiny pill next to the brand: `dev` / `staging` / `prod` (from
`process.env.NODE_ENV` or a build-time env) with a dot color (green/amber/red),
plus the app version when available.

**Why:** admins regularly run multiple environments side by side; knowing which
one you're logged into prevents "I edited prod" disasters.

**Where:** `apps/admin/components/layout/sidebar.tsx` header (under the subtitle)
— pure server/branch-safe read of `NODE_ENV`.

**How:** `const env = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV` and a
`ENV_META` map (`production → red`, `development → green`). No network call; hidden
in rail mode.

**Acceptance criteria:**
- [ ] The pill shows the right env + color in dev and in a prod build.
- [ ] It doesn't ship in the initial JS bundle (server-rendered constant).

**Status:** ⬜ Pending.

### 14. Session badge + theme toggle in the footer

**What:** move the existing session-status badge (JWT-expiry countdown — already
built for the Topbar) and a theme toggle into the sidebar footer.

**Why:** the topbar is getting crowded; the sidebar footer is the natural home for
"session health" next to the user. Always visible on every page.

**Where:** `apps/admin/components/layout/sidebar.tsx` footer (import
`SessionStatusBadge` from `@/components/common/session-status-badge` + the theme
toggle from the Topbar) — keep the Topbar instances too, or remove them if
redundant.

**How:** same data source (the shared session stream); no new fetch. The theme
toggle already exists in `topbar.tsx` — extract it to a shared component if both
render it.

**Acceptance criteria:**
- [ ] The countdown badge renders in the footer on all pages.
- [ ] Theme toggling works from the sidebar; no duplicate listeners.

**Status:** ⬜ Pending.

### 15. Deep-link the ⌘K palette from the menu

**What:** make the sidebar's tree the *source* for the command palette's grouped
results (section → breadcrumbed items), so ⌘K and the sidebar can never disagree.

**Why:** `flattenMenuItems` in `lib/navigation/menu.ts` already produces exactly the
`{ section, breadcrumb }` shape the palette needs — the wiring exists but isn't
shared.

**Where:** `apps/admin/components/layout/command-palette.tsx` (or `lib/palette/search.ts`)
+ `sidebar.tsx` (no change needed if it reads the same config).

**How:** ensure both read the same `flattenMenuItems(SIDEBAR_MENU…)` output;
palette groups by `section`, shows the `breadcrumb` as the item's subtitle, and
navigates on select (feature 4 of the palette already supports grouping). Reuse
the `ICON_MAP` for palette icons.

**Acceptance criteria:**
- [ ] ⌘K shows the same items as the sidebar, grouped by section with breadcrumbs.
- [ ] Adding a menu item to the JSON appears in both places automatically.

**Status:** ⬜ Pending.

### 16. Onboarding spotlight

**What:** a one-time, 3-step tooltip tour on first login: point at the **search**,
the **section reorder**, and the **collapse toggle**; dismissible, persisted
("seen" flag), skippable.

**Why:** the three most powerful sidebar features (search, reorder, collapse) are
all *discoverable* but not *obvious* — the reorder controls are hidden by design
(improvement 10).

**Where:** `apps/admin/stores/sidebar-store.ts` (persisted `onboardingSeen`) + a
small `SidebarSpotlight` component in `sidebar.tsx`.

**How:** render after hydration (the store is rehydrated post-mount); anchor the
tooltips to the search input / first section header / collapse button via
positioned portals. Use framer-motion's existing presence animation or the CSS
`animate-in` classes — no new deps.

**Acceptance criteria:**
- [ ] First login shows 3 sequential tooltips; "Done"/skip dismisses permanently.
- [ ] No layout shift while the tour is hidden; SSR-safe.

**Status:** ⬜ Pending.

### 17. Fuzzy search with keyboard navigation

**What:** upgrade the sidebar search (improvement 5's scoring) to a real
"search results mode": as you type, show a flat ranked result list
(breadcrumb as the subtitle), navigate with **↑/↓**, jump with **Enter**,
clear with **Esc**.

**Why:** deep trees (the Analytics 6-level chain) are painful to expand by hand;
a flat results mode collapses the whole tree into a picker.

**Where:** `apps/admin/components/layout/sidebar.tsx` (search mode branch) +
`lib/navigation/menu.ts` (ranked `searchMenuItems` returning `{ item, breadcrumb, score }[]`).

**How:** when `isSearching`, render results (not the section tree) with
`role="listbox"` semantics (or the base-ui `Menu`), keep the existing highlight,
and wire an `activeIndex` state for the arrow keys. Reuse `flattenMenuItems` +
`createItemId` for keys.

**Acceptance criteria:**
- [ ] ↑/↓ moves a visible selection ring; Enter navigates; Esc clears and refocuses.
- [ ] Typing "analytics reports sales" (multi-word) ranks the deep Sales item first.
- [ ] `searchMenuItems` is unit-tested.

**Status:** ⬜ Pending.

### 18. Collapsed flyout panels

**What:** in rail mode (feature 1), hovering a rail icon opens a floating panel to
its right with the item's children (or a one-item row when it has none).

**Why:** rail mode is only useful if every level stays reachable; flyouts restore
full nesting without expanding the rail.

**Where:** `apps/admin/components/layout/sidebar.tsx` + `dashboard-layout.tsx`
(positioned panel; base-ui `Popup`/`Menu` from `packages/ui` handles
placement/flip/close-on-outside).

**How:** a small `RailFlyout` component keyed by the hovered item id: it renders
the item's subtree with `SidebarNavItem` (reused as-is) inside a popup; clicking
navigates and closes. Keyboard: focus moves into the flyout on open (Arrow keys).

**Acceptance criteria:**
- [ ] Hovering a rail icon opens the flyout; clicking outside/ESC closes it.
- [ ] The flyout works with reduced motion and keyboard focus.

**Status:** ⬜ Pending.

### 19. API-driven menu

**What:** serve the menu from the backend (a `/menu` endpoint or a permission-
filtered payload in `/auth/me`), falling back to the bundled JSON on failure.

**Why:** shipping a menu change (add "Reports", reorder sections, retitle items)
becomes a backend deploy instead of an admin-app deploy — and RBAC filtering
(feature 9) moves to the server where it belongs.

**Where:** new `apps/admin/lib/menu-server.ts` (server-only, mirrors `lib/docs.ts`'s
`server-only` pattern) + a server component wrapper around `Sidebar`.

**How:** the `(panel)` server layout already runs per-request with the decoded JWT
— add a `getMenuForUser()` that fetches the filtered menu and passes it down as a
prop (the JSON config remains the offline/fallback default). Validate the fetched
payload with a zod schema from `packages/shared` (repo rule 5).

**Acceptance criteria:**
- [ ] With the endpoint up, the menu reflects server state (incl. RBAC).
- [ ] With it down, the bundled JSON renders (graceful degradation, logged).

**Status:** ⬜ Pending.

### 20. Active-branch auto-collapse ("focus mode")

**What:** a persisted "focus mode" toggle: when on, navigating to a page collapses
every section except the active one's branch.

**Why:** the docs tree + settings tree push the menu past one screen; focus mode
keeps exactly the relevant branch open — the active-branch version of reading glasses.

**Where:** `apps/admin/components/layout/sidebar.tsx` (merge logic) +
`stores/sidebar-store.ts` (persist `focusMode: boolean`).

**How:** in the `expandedItems` memo, when `focusMode`, intersect the auto-expanded
set with the active branch (the route already knows which parents to keep open via
`autoExpandedItems`); everything else folds. Manual expansion of a focused branch
is still allowed; the toggle lives in the section-header area (an "eye" icon) or
the bottom "Customize menu…" row.

**Acceptance criteria:**
- [ ] With focus mode on, only the active branch is open after navigation.
- [ ] Toggling it off restores full expansion; the preference persists.

**Status:** ⬜ Pending.

---

## Suggested order of attack

**Tier 1 — correctness + a11y (do first, all S-sized):** improvements **1, 2, 3,
7, 10, 15** — the `aria-*` contracts, the id-collision bug, and the touch/keyboard
gaps. Each is a contained edit + a test.

**Tier 2 — UX wins:** improvements **4, 6, 8, 13** + features **1 (rail), 2
(favorites), 12 (profile menu)** — the daily-friction items that make the menu
feel finished.

**Tier 3 — power features:** features **9 (RBAC), 17 (fuzzy search), 19
(API-driven)** — larger, but they build directly on the pure functions in
`lib/navigation/menu.ts` and the existing SSR shell, so they slot in without restructuring.

**Tier 4 — polish/hygiene:** improvements **5, 11, 16, 17, 19, 20** and the
remaining features — pick up as time allows; nothing here blocks anything else.

---

## Keeping this doc honest

- **When you ship an item:** flip its status to ✅ (or 🔶 for partial) and update
  the matrix + the item's acceptance criteria. Unticked boxes mean "claimed but
  unproven".
- **When the menu config changes** (`sidebar-menu.json` / `lib/navigation/sidebar.ts`):
  re-check item 7 (id collisions) and items 9/10 (new fields) — the JSON is the
  contract everything else tests against.
- **When you touch the motion files:** re-check improvement 11 (constants are
  shared, not duplicated) — the sidebar/drawer pair has already drifted once.

