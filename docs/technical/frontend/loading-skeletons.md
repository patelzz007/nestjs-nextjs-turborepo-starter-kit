---
title: "Loading skeletons"
tags: ["loading", "skeleton", "suspense", "ui", "accessibility"]
description: "How every page and every pending query in web, admin and merchant shows a skeleton shaped like the content it stands in for — the kit primitives, the loading.tsx convention, accessibility, motion, and testing."
order: 23
author: "Platform Team"
lastUpdated: 1791763200000
coverImage: "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1600&q=80"
---

# Loading skeletons

> [!NOTE] **What this is.** The one way the Next.js apps show "loading": a placeholder shaped like the
> content that is about to appear, so the page never jumps when the data lands. A bare spinner is only for
> small, unpredictably-shaped UI such as a button's own pending state (`rules/07-ui-system.md`).
>
> **Ground truth** (verified 2026-10-12):
>
> - Kit: `packages/ui/src/components/skeleton.tsx`, `skeleton-region.tsx`, `skeleton-patterns.tsx`; motion in `packages/ui/src/styles/components.css` (`skeleton-bone`, `skeleton-region`)
> - App compositions: `apps/{web,admin,merchant}/components/loading/`
> - Route boundaries: every page segment's `loading.tsx` in `apps/web`, `apps/admin`, `apps/merchant`
> - Docs site (`apps/docs`, static Astro): search-result placeholders (`src/scripts/search.ts`) and the diagram placeholder (`global.css`, `:root[data-js] … pre.mermaid`)

## The three layers

| Layer            | Import                                       | Job                                                                                                                                                                                                              |
| ---------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Skeleton`       | `@workspace/ui/components/skeleton`          | One bone. `variant`: `default`, `circular`, `text` (a pill-rounded line).                                                                                                                                        |
| `SkeletonRegion` | `@workspace/ui/components/skeleton-region`   | **Exactly one per loading surface.** `role="status"`, `aria-busy`, polite live region; announces `labels.loading`; hides the bones from assistive tech; waits ~150ms, then fades in.                             |
| Patterns         | `@workspace/ui/components/skeleton-patterns` | Bones-only silhouettes of real kit surfaces: `PageHeaderSkeleton`, `StatCardsSkeleton`, `TableSkeleton`, `CardGridSkeleton`, `ListSkeleton`, `FormSkeleton`, `DetailSkeleton`, `ChartSkeleton`, `ProseSkeleton`. |

```tsx
const LOADING_CLAIMS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading claims…" };

{status === "loading" ? (
	<SkeletonRegion labels={LOADING_CLAIMS} className="flex flex-col gap-6">
		<PageHeaderSkeleton />
		<ListSkeleton rows={4} leading="icon" />
	</SkeletonRegion>
) : …}
```

- The bones sit inside a `display: contents` wrapper, so the region's `className` lays out the bones directly. **Space them with flex/grid `gap`.** `space-y-*` does nothing here, because the region's only direct child is that wrapper.
- Hoist label objects to module constants. The apps keep theirs in `components/loading/loading-labels.ts`.
- Never nest regions. A page skeleton is one region holding several patterns.
- Patterns take a `surface` (`card` or `plain`) where it matters, so a table that already sits inside a page's card is not double-framed.
- Match the real controls. For example, `FormSkeleton inputSize="lg"` gives the `h-11` auth inputs, and `TableSkeleton withDescription` draws a card header that has a `CardDescription`.

## Motion

Every bone paints the same gradient with `background-attachment: fixed`. The highlight therefore has one position on screen at a time and sweeps across all the bones together, as a single wave rather than dozens of independent pulses. It then rests off-screen for the last 30% of each cycle. Light themes sweep toward the card colour and dark themes toward the foreground, so the highlight always lightens a bone and never darkens it. With `prefers-reduced-motion`, the bones stay still. The region's delayed fade-in means a response faster than about 150ms shows no skeleton at all.

**One source for web and mobile.** The numbers (cycle length, travel share, band start/end/width in viewport widths, easing, reveal delay and fade, sheen role and opacity per theme) are `SKELETON_MOTION` in `@workspace/tokens` (`packages/tokens/src/skeleton.ts`).

- **Web** draws the sweep in CSS (`packages/ui/src/styles/components.css`). CSS can't import the token, so `skeleton-motion-parity.test.ts` checks every number in the stylesheet against it.
- **Mobile** (`apps/mobile/src/lib/skeleton-sweep.ts`, `components/skeleton.tsx`) animates the same values with Reanimated. Each `SkeletonGroup` runs one clock. Each bone measures its position in the window and draws its slice of a window-wide SVG gradient band, so the band crosses every bone at once, as `background-attachment: fixed` does on the web. With Reduce Motion on, mobile draws no band.
- **Docs** (`apps/docs/src/styles/global.css`) repeats the sweep in its own stylesheet, and its parity test checks it against the token too.

## Route boundaries (`loading.tsx`)

Most pages are `force-dynamic` and await a server prefetch, so without a boundary a navigation shows nothing until the server answers. The rule is that **every page has a skeleton shaped like it**: either its own `loading.tsx`, or an inherited one whose shape genuinely fits. A `loading.tsx` wraps its own segment's page **and every child segment**, but not its own segment's layout. Two consequences follow:

- Shells stay mounted. The `rewardhub`, admin `(panel)` and merchant `orgs/[orgSlug]` layouts keep the sidebar and topbar, and the skeleton fills only the content area.
- A page whose skeleton must not leak to its children lives in a **route group**: web `app/(landing)/` for `/`, and admin `app/(panel)/(home)/` for the dashboard. A root `app/loading.tsx` would become every route's fallback, and web has a test that forbids one.

Static client pages (signup, forgot-password) and redirect-only pages have no boundary. A `<Suspense fallback>` (for example, around `useSearchParams`) uses a shaped skeleton, not "Loading…" text.

Shared shapes live beside their constants so the skeleton and the page cannot drift. For example, admin `TablePageShape` (columns, header actions, card description, width) is declared once per table page. KPI card counts come from the same `*_KPIS` arrays the page renders, and form field counts come from the form's shape constants.

## Whole-shell loading (`panel-shell-skeleton`)

When a whole workspace loads before its shell exists (merchant's `app/loading.tsx`: the entry redirects and the org layout's first render), never hand-draw a sidebar. Render the real `AppPanelShell` and give it outlines built from the real parts:

- `PanelSidebarSkeleton` takes the app's real `PanelSidebarHeader` (the brand never loads) and draws the search field, each section's label row (28pt, as tall as its reorder buttons) and nav rows (`h-9`, `px-3`), then the footer's rows and account row. These are the same spacing as `PanelSidebarSearch`, `PanelSidebarSectionHeader`, `panelSidebarNavItemVariants` and `AppShellSidebarAccount`.
- Its `sections`/`footerRows` come from the app's compiled menu via `sidebarMenuSkeletonShape(menu)` (`@workspace/client/lib/sidebar/sidebar-menu-skeleton`), so the outline follows the menu instead of a hand-kept count.
- `AppShellHeaderSkeleton` is the page header's outline: the toggle slot, the breadcrumb, the app's actions (`["icon"]` for merchant's notifications) and search. Merchant's sidebar header is `PanelSidebarSwitcherSkeleton`, the outline of its store and location switcher.
- `AppPanelShell`'s `defaultSidebarOpen` takes the saved sidebar cookie (merchant reads it with `readSidebarOpen()`), so a collapsed sidebar stays collapsed while loading.

The web app has no whole-shell skeleton: its `rewardhub` layout only reads the session and a cookie, and within the hub the real sidebar stays mounted while each page's own `loading.tsx` fills the content area.

## In-view pending states

Inside a view, keep the discriminated status union (`rules/00`) and render a shaped region for the `loading` case. Don't fall back to text, and don't render an empty state while data is still loading.

Admin's `LazySection` is the one deliberate exception. It draws bones that are **not** announced, because nothing is loading yet and seven sections would otherwise each say "Loading section…" on page load. The section's own `next/dynamic` loader announces once it starts loading.

## Docs site

`apps/docs` is a static Astro build: navigations are full page loads with the content in the HTML, so it has no route skeletons. Two things load after the page, and both use the same viewport-wide sweep:

- **Search.** While the index downloads, the results list is `aria-busy` and shows four result-shaped rows. Once the index is cached, these rows never appear again.
- **Mermaid diagrams.** Until mermaid renders a diagram, a placeholder block replaces the raw diagram source. Screen readers still get the source text. If rendering fails, the source becomes visible again (`data-error`). The placeholder only applies when scripts run (`:root[data-js]`, set by the head script), so a no-JS reader still sees the source.

## Testing

- Kit: `skeleton.test.tsx`, `skeleton-region.test.tsx`, `skeleton-patterns.test.tsx`, `styles/skeleton-motion-parity.test.ts`, and the forwardRef contract in `ui-kit-contract.test.ts`.
- Token: `packages/tokens/src/skeleton.test.ts`. Mobile: `src/lib/skeleton-sweep.test.ts` (band position over the cycle) and `src/components/skeleton.test.tsx` (reveal, sweep through a bone, Reduce Motion).
- Apps: each app tests every `loading.tsx`, checking for exactly one busy, polite status with the right announcement and bones hidden from assistive tech. Each app also tests its compositions' structure (row, card and column counts against the real shape constants). Web also has a coverage test that fails when a page has no boundary and is not on the static-route allowlist.
- In-view loading cases assert `getByRole("status")` and its announcement, not the old "Loading…" text.
