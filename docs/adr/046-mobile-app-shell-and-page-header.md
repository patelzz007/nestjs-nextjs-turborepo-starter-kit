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

Accepted (2026-10-12). Implemented (2026-10-12). Supersedes the "no top bar / corner button" parts
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
  edge.

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
