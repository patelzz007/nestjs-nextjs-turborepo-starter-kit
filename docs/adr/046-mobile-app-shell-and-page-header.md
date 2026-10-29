---
title: "ADR 046: Mobile App Shell and a Page Header That Is Not a Bar"
tags: ["adr", "mobile", "navigation", "design"]
description: "Every signed-in mobile screen sits in one app shell — status, drawer and a page header rendered once — whose header carries menu or back, the page's title (moving with the page) and the status pills, on the page's own colour with no band, divider or shadow."
author: "Platform Team"
lastUpdated: 1791763200000
coverImage: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&h=630&fit=crop"
order: 46
---

# ADR 046: Mobile App Shell and a Page Header That Is Not a Bar

## Status

Accepted (2026-10-12). Implemented (2026-10-12). Amended 2026-10-29 (a collapsing, page-coloured
header with a subtitle — see [the amendment](#amendment-2026-10-29--a-collapsing-header-with-a-subtitle)).
Supersedes the "no top bar / corner button" parts
of [ADR 038](./038-mobile-app-drawer.md) and the corner controls of
[ADR 044](./044-mobile-motion-and-navigation-theme.md).

## Context

The `(app)` group had no top bar (ADR 038): the menu button floated in the top-left corner and the
status pills in the top-right, each rendered once by the layout and faded away deeper in a stack.
Three problems followed. Scrolling content passed under a lone floating button, which looked out of
place. Screens deeper in a stack (Security, Signed-in devices, …) had no visible way back — only
the edge swipe and the Android back button. And the frame of a signed-in screen was spread over the
layout, the corner overlays and `Screen`. The product now wants one wrapper for every signed-in
screen, with a header that carries the status, a back button deeper in, and titles that move with
the page — designed so that it does not look like a top bar.

## Decision

- **One app shell.** `src/features/app-shell/app-shell.tsx` wraps the `(app)` navigator: the app
  status provider, the drawer and, laid over the screens, the page header. All of it is rendered
  once for the group and never re-mounts as screens change. The layout file is just
  `<AppShell><Tabs … /></AppShell>`.
- **A header that is not a bar.** `src/components/page-header.tsx` has no band, no divider and no
  shadow. It sits on the page's own `--background`, which runs up behind the status bar, and the
  title is set as the page heading (`font-heading`, `text-2xl`), so at rest the header reads as the
  page's first line. Below the controls, the page colour fades to transparent over 20 pt
  (`bg-linear-to-b from-background to-transparent`, React Native's background-image gradient
  through Uniwind). Content at rest starts below the fade, so nothing is dimmed. When content
  scrolls up, it dissolves under the controls instead of colliding with them.
- **Menu on a tab's first screen, back deeper in.** The leading 44 pt button cross-fades between the
  two (180 ms). Back calls `router.back()`. The edge swipe still opens the drawer only on a tab's
  first screen.
- **The status pills stay** on every screen, compact, on the right of the header: connection and
  token countdown (§10.16).
- **Titles come from the route,** `src/features/navigation/app-screens.ts`, resolved from the path
  the moment it changes. A screen's own copy names it, and a param can choose the title (two-factor:
  "Turn on two-factor authentication" or "New backup codes"). Screens inside the shell pass no
  `title` to `Screen`; outside it (lock screen, forced update, configuration error) `Screen` still
  draws its own.
- **The title moves with the page.** On a tab switch it drifts 16 pt toward the side the new tab
  sits on, exactly like the tab cross-fade. On a push it comes in from 24 pt to the right; going
  back brings the previous title in from the left. Both use the tab transition's 260 ms and
  `ease-emphasized-enter` (`PAGE_TITLE_TIMING`). The outgoing title is mounted as its own element,
  so it leaves in the new page's direction, and it is hidden from screen readers. Both motions
  follow Reduce Motion. The direction is a pure function (`header-transition.ts`).
- **`Screen` learns the header's height** (status bar + 56 pt row + 20 pt fade) from
  `PageHeaderClearance`. It pads its content and scroll indicator by it and drops the top safe-area
  edge. The pull-to-refresh spinner ignores content padding (it sits at the scroll view's top edge,
  which is under the header), so `Screen` also passes the clearance as the `RefreshControl`'s
  `progressViewOffset`, honored on iOS and Android in the new architecture.

## Alternatives

- **A native stack header (`headerShown: true`).** Each screen would draw its own header, which
  re-mounts and slides with the page, so the status pills would flicker on every navigation. It is
  also a bar by design.
- **A solid bar with a hairline that appears on scroll.** It is the platform default, but it reads
  exactly as the top bar the product does not want.
- **Keep the floating corner controls and add a back corner.** This leaves the floating-over-content
  problem as it is.

## Consequences

- Removed: `CornerButton`, `CornerOverlay`, `ScreenCornerProvider`, `AppMenuButton`,
  `AppStatusCorner`. Corner positioning no longer exists anywhere.
- A new signed-in screen gets its header by adding a title to `app-screens.ts` (`screenTitleOf`
  returns an empty title otherwise).
- The gradient fade needs the new architecture (React Native's `experimental_backgroundImage`),
  which Expo Go provides. Jest renders no styles, so the fade's look is checked on a device.

## Amendment (2026-10-29) — a collapsing header with a subtitle

The header keeps its place (rendered once by the shell, menu or back, the page's title moving with the
page) but changes shape. Where this section and the Decision above disagree, this section wins.

- **A page-coloured band with a subtitle.** The header is on the page's own colour (`bg-background`),
  running up behind the status bar; the title is centred, with one line under it saying what the page
  is for. Titles and subtitles both come from `src/features/navigation/app-screens.ts`
  (`screenHeadingOf(pathname, params)`, which replaces `screenTitleOf`; parameterised titles — two-factor,
  commits, pull requests — still resolve from the params). The 20 pt fade is gone.
- **Notifications and status on the right.** A notifications button (until there is an inbox it
  says notifications are coming soon) and, before it, the compact connection and session pills, as
  before — shown in full in the drawer too.
- **It collapses with the page, scroll-linked.** `src/lib/page-header-scroll.tsx`: the shell owns two
  shared values (the focused page's scroll position and the subtitle line's height); every `Screen`
  feeds them from its own scroll view while it is focused, and hands the header its own position when
  it gains focus (eased over 220 ms), so switching pages never leaves a stale header. `progress` =
  scroll ÷ subtitle height, clamped to 0…1. The header **shrinks in place**: only its background layer
  moves, its bottom edge rising by `progress × height`, so the content's curved top stays attached to
  it. The pinned row (menu, title, status, notifications) never moves. The subtitle line's frame rises
  with the edge and clips the text, which an equal and opposite shift holds still, while it fades on an
  ease (`Easing.inOut(Easing.quad)`) over the whole collapse. Moving the whole header with the content
  made the subtitle read as part of the page. Transforms only, on the UI thread, and no dependency
  array on `useDerivedValue` (on native it is web-only and warns). A pull to refresh keeps the header
  expanded.
- **The collapsed bar takes on the content's surface.** Inside the moving background, a `bg-card` layer
  fades in with `progress`, and a `bg-border` hairline fades in over the last quarter of the collapse,
  so the bar is never a darker band over a lighter page (the dark and Nord themes, where `--background`
  and `--card` are far apart). These are opacity cross-fades of token-coloured layers, because
  Reanimated cannot interpolate the tokens' `oklch()` colours, so every theme gets this without
  per-theme code.
- **Toasts drop in under the controls row** (`pageHeaderControlsBottom`: the status bar plus
  `PAGE_HEADER_ROW_HEIGHT`, kept in step with the row's `h-14` by a test), the same place expanded or
  collapsed, rather than under the subtitle line.
- **Measured clearance.** The shell measures the header (`onLayout`) and gives `Screen` that height
  (`PAGE_HEADER_ESTIMATED_HEIGHT` until the first layout) instead of a fixed row + fade sum.
- **A curved content sheet.** Inside the shell, `Screen` puts its content on a `bg-card` sheet with the
  auth pages' `rounded-t-4xl` curve, starting right under the header.
- **Status bar icons follow the app's theme** (`isDarkTheme`), since the header is the page's colour.
- **Android edge to edge in Expo Go.** `KeyboardProvider` is told the system bars are translucent
  (`statusBarTranslucent`, `navigationBarTranslucent`): its own detection reads a React Native constant
  Expo Go does not set and otherwise pads the whole app away from both bars.
- **Tabs are preloaded when idle** (`src/features/navigation/use-preloaded-tabs.ts`, one tab per idle
  callback via `router.prefetch`), so even the first switch to a heavy tab is smooth.
- **Testing.** `Screen` reads its focus from the router, so a test renders it inside a route
  (`renderRouter`); Jest's React Native environment has no idle callbacks, so `test/idle-callbacks.ts`
  supplies them (next timer tick).

