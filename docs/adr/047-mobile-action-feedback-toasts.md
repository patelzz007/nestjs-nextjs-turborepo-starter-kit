---
title: "ADR 047: Mobile Action Feedback Through Toasts"
tags: ["adr", "mobile", "feedback", "design"]
description: "Every action in the signed-in mobile app confirms its outcome with one toast under the page header — success, failure, and why — instead of per-screen banners that were lost to re-mounts or scrolled out of sight."
author: "Platform Team"
lastUpdated: 1791763200000
coverImage: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&h=630&fit=crop"
order: 47
---

# ADR 047: Mobile Action Feedback Through Toasts

## Status

Accepted (2026-10-12). Implemented (2026-10-12).

## Context

People could not tell whether their changes worked. The Profile screen set "Profile saved.", but a
save bumps the profile's optimistic-lock version, which re-mounts the editor (it is keyed by
version) and throws the message away. A "changed on another device" conflict reloads the profile
and is lost the same way. Turning the app lock on or off succeeded silently, and so did the
Appearance and "Lock after" choices. Errors that did show sat in inline banners at the top of a
form, often scrolled out of sight.

## Decision

- **One toast for every action's outcome.** The toast feature store (`src/features/toast`, ADR 023
  layout) lives in the app shell (ADR 046). Screens call `useToast().success(…)` or `.error(…)`.
  One toast shows at a time, and a newer one replaces it.
- **The web toast's design** (`packages/ui/src/components/toast.tsx`), on the phone. Each tone —
  success, info, warning, error — gets an opaque tone-soft card (`bg-tone-*-soft`) with a 30 % tone
  border, the tone's icon (check, info, triangle, octagon-x), the message in the foreground colour, a
  close button, and a countdown bar in the tone (`bg-tone-*/55`) that drains over the toast's life.
  (Amended 2026-10-12: the first version was one neutral card for every tone.)
- **The web toast's motion, on the UI thread** (Reanimated shared values, not layout animations):
  the toast slides down from fully above the screen on the tokens' `ease-overlay-emphasized`
  (500 ms, as the web), and leaves the same way, quicker (300 ms). A swipe up dismisses it, and a
  short drag springs back. With Reduce Motion on, nothing slides and the countdown bar stays full,
  as the web's `motion-reduce`.
- **Where:** `ToastHost` places it just under the header's controls, across the page. A dismissed
  toast is marked leaving, slides out, and is removed when the exit finishes. A newer toast slides
  in while the one it replaces slides out.
- **Timing:** a success or info toast stays 3 s; a warning or error stays 5 s (it carries what went
  wrong and how to fix it). The close button or a swipe dismisses it at once. A timer only
  dismisses its own toast, so a replacing toast always gets its full time.
- **Accessibility:** every toast is announced (`announceForAccessibility`), and an error is an
  `alert` with an assertive live region.
- **What reports through it:** Profile (saved; failed; changed elsewhere), App lock (turned on or
  off; check failed; no passcode), "Lock after", Appearance, Change password failures, and signing
  out a device. A cancelled check reports nothing, because nothing changed and the person chose that.
  A successful password change signs every device out; the sign-in screen's notice explains it.
- **What stays inline:** errors that belong to a step in front of the person — a confirmation
  dialog's failure, the two-factor enrollment steps, field validation. Those sit next to what they
  are about.

## Alternatives

- **Fix each screen's banner (for example, hoist Profile's state above the keyed editor):** this
  repairs one screen, leaves the others silent, and keeps banners that scroll out of sight.
- **Native `ToastAndroid` / alerts:** Android only, or modal and blocking, and neither matches the app's tokens.

## Consequences

- New actions in the signed-in app report their outcome with `useToast()`.
- Screens rendered on their own in tests get a toast store and host from `test/app-harness.tsx`,
  as they already did for the drawer.
