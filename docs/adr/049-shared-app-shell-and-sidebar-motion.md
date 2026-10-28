---
title: "ADR 049: One App Shell for Admin, Web and Merchant (App Shell 3), and a Sidebar That Moves on One Spring"
tags: ["adr", "frontend", "ui", "layout", "motion", "sidebar"]
description: "Admin, web and merchant render one shared panel shell — an inset sidebar that collapses completely, a floating page panel with a quiet header — and the sidebar opens and closes on one framer-motion spring that the whole layout follows, with charts held still while it moves."
author: "Platform Team"
lastUpdated: 1791763200000
coverImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=630&fit=crop"
order: 49
---

# ADR 049: One App Shell for Admin, Web and Merchant (App Shell 3), and a Sidebar That Moves on One Spring

## Status

Accepted (2026-10-12). Implemented (2026-10-12).

## Context

The admin panel moved to the `@efferd/app-shell-3` layout: an inset sidebar on a frame that collapses
completely, the page in a floating panel, a quiet header with the breadcrumb trail and search. Web and
merchant already shared one shell (`AppPanelShell`), but the admin had its own, and the layout must be
the same in all three — one implementation, not three copies.

Opening and closing the sidebar also felt jerky. Measured in the browser (the panel's left edge sampled
every animation frame): the sidebar's width and slide transitioned (200 ms, linear) while the panel's
margin and the content column's maximum width **snapped**; and on the admin dashboard frames took
40–60 ms throughout the motion — single steps of up to 110 px — because every chart re-rendered on every
frame as the panel resized.

## Decision

- **One shell.** `AppPanelShell` (`packages/ui`) is app shell 3 for all three apps: `Sidebar
variant="inset" collapsible="offcanvas"` on the `shell-frame` surface, the page in a floating
  `SidebarInset` panel (`shell-panel`, edged with the soft `--border`), the app's header above the one
  `<main>`, and an `overlay` slot (scroll-to-top). Apps render it through `StoreBoundAppPanelShell`
  (`packages/client`), which reads and writes the sidebar store.
- **Shared parts, app slots.** `AppShellHeader` (expand toggle while the sidebar is out of sight,
  breadcrumb slot, app `actions` — notifications — and Search ⌘K; the merchant's store and location switcher heads its sidebar as a `PanelSidebarSwitcher`),
  `PanelSidebarHeader` (brand + collapse toggle, 56 pt), and `AppShellSidebarAccount` (status, the user
  row that opens the shared profile menu or an app's own, theme, log out). Each app supplies only its
  data: menu, breadcrumb, profile items, actions. Profile items are pure functions per app
  (`web-profile-menu.tsx`, `merchant-profile-menu.tsx`), tested on their own.
- **One spring drives the layout.** framer-motion (already used by the admin, now a `packages/ui`
  dependency) animates one number for the whole shell, `--sidebar-progress` (0 collapsed → 1 open), on a
  `display: contents` element inside `SidebarProvider` (`sidebar-progress.tsx`), on a
  critically damped spring (`lib/sidebar/motion.ts`; a test holds its damping ratio ≥ 1, so it never
  overshoots). The gap the sidebar reserves and the sidebar's slide (a transform) are CSS expressions of
  that one value (`styles/components.css`), so they cannot drift apart; an inset sidebar collapses to the
  panel's 0.5 rem margin, so the panel's edge never snaps. Under "reduce motion" it jumps.
- **The page column widens with the collapse, on the same spring.** On desktop its maximum width is
  88 rem beside an open sidebar and 104 rem with it collapsed — a CSS expression of the same
  `--sidebar-progress`, so it eases with the panel instead of snapping (the old open / collapsed classes
  switched instantly). Below `lg` it is always 104 rem.
- **The first paint is the state it was left in.** The open state is mirrored into a per-app cookie
  (`<store key>-open`, `packages/client` `open-cookie.ts`) on every change; each app's server layout
  reads it and seeds the sidebar store (`SidebarStoreProvider initialIsOpen`), so a collapsed sidebar is
  collapsed in the server HTML — no open-then-close flash on reload. (The rest of the sidebar's
  preferences stay in `localStorage`, which the server cannot read.)
- **Size-dependent content holds still while the layout moves.** A `LayoutTransition` context reports
  "the layout is moving" from the moment the open state changes (a layout effect, before the first frame)
  until the spring settles. `ChartContainer` pins the width of the box Recharts measures for that window
  and fits once at the end. A window resize still re-fits at once (Recharts' own `debounce` is a
  throttle — it would lag every resize, and still re-render mid-motion).
- **Toggling re-renders only what shows the open state.** The layouts above `StoreBoundAppPanelShell`
  never subscribe to it, and inside the shell:
  - `AppPanelShell` builds the page panel (header, breadcrumb, page) as one memoized element, so a toggle
    re-renders the shell and the `Sidebar` root and React skips the panel.
  - The sidebar context is split. `useSidebar()` still returns everything, open state included.
    `useSidebarControls()` returns only the commands, viewport, copy and badges, and keeps its identity
    across toggles (the toggle reads the latest state from a ref).
  - Triggers, the rail, menu badges and the panel nav read `useSidebarControls()`. A menu button's tooltip
    is the only part of a menu button that reads the open state.
  - The layout-in-motion flag is a signal, not React state. `useLayoutTransitionListener` calls back at the
    start and end of a motion, and the chart's size hold writes to the DOM in that callback.

  Measured on the admin dashboard: one toggle went from 33 React commits (the whole sidebar nav, the panel
  and every chart mark) to 5–6, and the panel, header and breadcrumb no longer render at all.

- **The breadcrumb glides.** The header's expand toggle sits in a slot whose width, gap and opacity follow
  `--sidebar-progress`. Before, the toggle appeared and disappeared instantly, so the breadcrumb beside it
  jumped 44 px. Beside an open sidebar the slot is `visibility: hidden`, which takes it out of the tab order.
- **A held chart stays anchored and only re-fits.** The chart frame no longer centres its content, so a
  held chart sits at its card's start edge and the card clips it while the card is narrower. `useDataTween`
  makes the time-series marks tween only on entrance and on new data, so the one re-fit after the motion
  (and any window resize) redraws in place instead of replaying a sweep.
- **One `<main>`.** `SidebarInset` is a `<div>` (the panel's frame); the page's `<main id="main-content">`
  is inside it beside the header — previously a `<main>` held another `<main>`.

## Result (measured)

Collapsing and expanding, 1440 × 900, the panel's left edge per animation frame: admin dashboard and
web both move 312 px in ~640 ms over ~39 frames at a steady 16–17 ms, monotonic, largest single step
33 px (the spring's peak speed); before, the admin dashboard dropped to 40–60 ms frames with 110 px steps.
At 1920 × 1080 the page column grows from 1408 px (open) to 1664 px (collapsed), still 16–17 ms frames.
Reloading with the sidebar collapsed: the server HTML has it collapsed, and every frame from the first
paint shows the panel at its collapsed position.

## Alternatives

- **Three app-specific shells** — the admin kept its own and web / merchant theirs: three copies of the
  layout to keep in step. Rejected; the slots carry what differs.
- **CSS transitions with matched curves** — what existed; a CSS transition cannot follow a spring, and
  the margin and max-width snaps were separate properties with nothing tying them together.
- **Recharts `debounce`** — a throttle: charts lag every window resize, and still re-render several
  times during the motion.
- **Scaling charts with CSS during the motion** — distorts text and tooltips; Recharts sizes its wrapper
  in pixels inline.

## Consequences

- `packages/ui` depends on framer-motion (14, the version the admin already used).
- Theme, settings and the profile menu moved from each header to the sidebar footer; web's account
  settings and merchant's organization settings are items in the profile menu.
- Charts keep their previous width while the sidebar moves (~0.6 s), anchored and clipped by their card,
  and fit once it settles, without animation.
- Anything else whose rendering depends on its own size can subscribe with `useLayoutTransitionListener()`
  and act on the DOM. Reading the flag as state would re-render it at both ends of every motion.
- The chart still redraws once after each toggle: its width really changed. Redrawing every frame instead
  would cost a full Recharts render per frame (about 30 ms for the four analytics charts in a dev build).
- New sidebar parts read `useSidebarControls()` unless they render the open state.
- `AppShellTopbar` is no longer used by the apps; it stays in `packages/ui` with its tests until removed.

## Amendment (2026-10-28) — one page width, no widening

The page column no longer widens with the collapse. Every page in web, merchant and admin, and the docs
site, now centres its content in one width, `max-w-10xl` (104 rem, `packages/tokens` `max-width-10xl`;
the docs read it from `palette.css`). The CSS expression that eased the column from 88 rem to 104 rem is
gone, so toggling the sidebar moves the panel's edge but never reflows the page inside it. The gap and
the slide still follow `--sidebar-progress`; charts still hold their size until the spring settles,
because the panel's own width still changes.
