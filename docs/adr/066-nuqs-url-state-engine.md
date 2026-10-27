---
title: "ADR 066: nuqs as the URL-state engine, and no other tab's rows under a tab"
tags: ["adr", "frontend", "url-state", "nextjs", "tanstack-query"]
description: "useUrlState keeps its API and zod codecs but runs on nuqs, so a tab or filter changes in the same render as the click. A list never shows one view's rows under another view while that view loads, and a tab's first page is fetched when the pointer or keyboard focus reaches it."
author: "Platform Team"
lastUpdated: 1793059200000
coverImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200&h=630&fit=crop"
order: 66
---

# ADR 066: nuqs as the URL-state engine, and no other tab's rows under a tab

## Status

Accepted (2026-10-27). Builds on [ADR 023](./023-client-state-feature-stores.md) (URL state belongs in
the URL) and [List queries §7](../technical/api/list-queries.md#7-table-state-in-the-url). Rules:
`rules/03-web-nextjs.md`, `rules/06-tanstack-state-forms-tables.md`.

## Context

Switching tabs flickered. A frame-by-frame recording of the real pages (Playwright, sampling every
animation frame) showed three separate causes:

1. **The state lagged the click.** `useUrlState` read `useSearchParams()`. Next.js updates it in a
   router transition after the History API write, so for about 50 ms the tab looked selected while
   everything under it still belonged to the old tab, with a blank frame in between.
2. **The old tab's rows appeared under the new tab.** The merchant rewards catalog uses one list
   query for every status tab, with `placeholderData: keepPreviousData`. On a switch, TanStack Query
   kept the previous tab's answer as the placeholder. "Ended" showed the drafts for about 260 ms, and
   "Drafts" briefly said "This page is past the end of the tab", then the right rows replaced them.
3. **A deliberate fade.** `/geography` wrapped its table in `AnimatePresence mode="wait"`. Every
   switch faded the table to fully transparent and back, about 550 ms with a blank gap.

nuqs was asked for by name. It is the de-facto URL-state library for the Next.js App Router. Its
`useQueryStates` changes every hook reading a key in the same render as the update, then writes the
URL on the next tick with shallow `pushState` / `replaceState`. It also merges several updates in one
tick into one history entry. On its own, though, it fixes only the first cause.

## Decision

1. **nuqs runs `useUrlState`; the API does not change.** `defineUrlState` (one zod schema per param)
   stays the single declaration, and server pages still parse their `searchParams` with it. Underneath,
   `useUrlState` reads and writes the codec's keys as raw strings through `useQueryStates`; the codec
   decides what they mean. Each Next.js app mounts `UrlStateProvider` (nuqs's App Router adapter) once,
   in its root layout. None of the call sites changed.
2. **One view's rows never stand in for another view.** `keepPreviousData` stays right for paging and
   sorting within one list. Across views (a tab, a status group) the page uses
   `useIsOtherViewPlaceholder(view, query)`, and while it is `true` it shows that view's loading state
   instead of the rows.
3. **A tab is fetched when it is about to be opened.** When the pointer or keyboard focus reaches a
   tab, its first page is prefetched (`usePrefetch`), so the click usually renders from the cache. This
   is done in geography, the merchant rewards catalog and the kanban board switch. Hovering the open
   tab fetches nothing.
4. **No exit animation on tab content.** A tab's content swaps at once; its own loading state, if any,
   carries the wait.
5. **Tests run the real engine.** `ClientTestProviders` (`@workspace/client/testing/client-test-providers`)
   is the UI-kit labels plus `UrlStateTestProvider`. That provider is nuqs on the jsdom address bar:
   real History API writes, Back/Forward through `popstate`, and a queue reset per test. A URL write
   lands on the next tick, so a test awaits `flushUrlUpdates()` before asserting the address bar.
   This works under fake timers too. Tests no longer mock `useSearchParams` for URL state.

## Consequences

- Measured locally on the dev servers after the change:
  - geography: about 155 ms from click to the new tab's rows, with no blank frame (was about 550 ms
    including the fade);
  - merchant rewards: the new tab's skeleton appears at once, and never another tab's rewards;
  - switching back to a tab already loaded renders it at once.
- Params already in the URL keep their place, and a new param is appended. Before, the codec re-sorted
  its own keys on every write. Nothing reads URL order: the prefetch key is `codec.serialize(state)`,
  which is order-independent.
- nuqs is one more runtime dependency of `@workspace/client` (2.10.2, the latest stable release).
  `minimumReleaseAge` applies to its upgrades like any other.
- A hover prefetch costs one request per tab the pointer passes over. It is the same request the click
  would make, and it is cached for the query's stale time.
- A list that adds tabs over one query must use `useIsOtherViewPlaceholder` (rules/06). Otherwise the
  second cause comes back.
