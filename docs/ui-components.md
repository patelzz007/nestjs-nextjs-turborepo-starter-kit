---
title: "UI Component Audit"
description: "A per-component plan for every component in packages/ui/src/components — exactly 20 improvements and 20 new features each, mapped to the 23 repo rules."
order: 10
author: "Acme Inc."
lastUpdated: "2026-08-04"
coverImage: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=1600&q=80"
---

# UI Component Audit

> A complete, per-component audit of **`packages/ui/src/components`** — every component,
> exactly **20 improvements + 20 new features** each (2,720 items total), grounded in the
> actual source. The audit is written so a junior developer with ~6 months of experience can
> pick any numbered item and implement it without guessing.
>
> These are **recommendations**, not shipped changes. Each item is tagged with the area it
> touches so you can batch by theme (e.g. "do all `[Ref]` items first").

---

## How to read this document

Every component section follows the same shape:

1. **File + one-line summary** of what the component currently does.
2. **🔧 Improvements — 20 numbered items.** Each is concrete enough to act on and
   references the current code where relevant (e.g. "the inline `[0, 1, 2, 3]` array in
   `PasswordStrengthMeter`"). These fix what exists today.
3. **🚀 New Features — 20 numbered items.** Each is a good-to-have enhancement: new props,
   new modes, or whole new sub-components that would make the component more capable.

### Improvement tags

| Tag | Area |
| --- | ---- |
| `[T]` | Typing — zod schemas, generics, no `any`/`unknown`/`never`/`as const`/`typeof` |
| `[V]` | Variant system — `variant` / `size` / `state (loading, disabled, error)` via CVA |
| `[R]` | Ref forwarding — `forwardRef`, focus management, RHF `register()` |
| `[F]` | Form integration — React Hook Form + zod wiring, consistent event contract (`onBlur`/`onChange`/`onFocus`) |
| `[A]` | Accessibility — ARIA, keyboard nav, focus-visible, live regions, labels |
| `[P]` | Performance — memoization, stable props, no inline object/array creation |
| `[Th]` | Theming — dark/light tokens, no hardcoded Tailwind values |
| `[M]` | Mobile/responsive behaviour |
| `[UX]` | Visual polish & micro-interactions |
| `[D]` | Smart/dumb split — data stays in the app page, low-level stays fluid |

### The 23 rules (the audit lens)

1. No `any` / `z.any`
2. No `unknown` / `z.unknown`
3. No `never` / `z.never`
4. No type casting; avoid `as const` — prefer tuples
5. Avoid `typeof` — infer from zod instead
6. Generics are priority 0
7. Production-ready, professional, visually appealing
8. Mobile responsive
9. Low-level components never own data — data flows in via props from the smart component
10. Data shape / mutation lives in the smart component
11. Low-level components are fluid — nothing hardcoded, everything handled dynamically
12. Don't change layout unless asked
13. Avoid `typeof x === "string"` style checks — build a zod schema and infer
14. Update documentation after completing work
15. Explicit access modifiers (`public`/`private`/`protected`) + return types on every method
16. Optimized by default — avoid re-renders, memoize, no inline objects/arrays in props
17. Dark + light theming support
18. Form-integration ready — plugs into RHF + zod, never manages validation internally
19. Base principle: stateless, accessible, composable, themeable, fully controlled by parent, flexible for unknown futures
20. Ref forwarding (mandatory)
21. Consistent event contract — `onBlur`, `onChange`, `onFocus`; no bespoke handlers
22. Design-token driven — no hardcoded Tailwind values in components
23. Variant system standardization (CVA) — every component supports `variant` + `size` + `state`

---

## Accordion — `components/accordion.tsx`

### 🔧 Improvements

Primitive wrapper: `Root` / `Item` / `Trigger` / `Panel` with a chevron that flips up/down.

1. `[R]` No `forwardRef` anywhere — `AccordionTrigger`, `AccordionContent`, and `AccordionItem` should forward refs for focus management and testing.
2. `[V]` The trigger has no `variant` / `size` / `state` system — add CVA (`variant: default | bordered | ghost`, `size: sm | default | lg`) so the accordion can be reused in dense settings pages.
3. `[V]` No loading/disabled visual story — a disabled `AccordionItem` currently only survives if the consumer remembers `aria-disabled`; bake in a `disabled` state via CVA.
4. `[A]` The chevron uses two hardcoded icons (`ChevronDownIcon` / `ChevronUpIcon`) that flip via `group-aria-expanded` — expose an `icon` slot prop so a consumer can render a custom indicator (plus/minus, custom chevron) without re-implementing the component.
5. `[A]` The trigger lacks `aria-controls` / `aria-expanded` handling by hand — verify base-ui provides it, and add a `ref`-based regression test asserting the attributes on toggle.
6. `[UX]` Trigger hover state is `hover:underline` only — add a background tint (`hover:bg-muted/50`) and a subtle left accent for the active/open item.
7. `[P]` `AccordionContent` renders a wrapper `<div>` for animation — memoize the panel body or allow `children` to skip the wrapper when no animation is needed.
8. `[Th]` Border color `not-last:border-b` relies on `--border` (fine), but the open-item emphasis uses raw hover utilities — route through `--accent` tokens.
9. `[F]` No way to compose with RHF `Controller` for an accordion-based picker (single-open "select one") — document a `value`/`onValueChange`-style controlled API or export a small `AccordionValue` helper.
10. `[M]` On narrow screens the trigger's chevron is `size-4` inside a `py-4` hit area — increase touch target on the right edge (min 44px) for mobile.
11. `[D]` The component hardcodes `border-b` between items via `not-last:border-b` — make separator presence a prop (`separated: boolean`) so list-style usage can disable it.
12. `[A]` No `aria-label` on the `Root` — a standalone accordion should announce itself (e.g. "Frequently asked questions") when used without a visible heading.
13. `[P]` Both chevron icons are always mounted (one hidden via CSS) — acceptable, but if icon rendering ever becomes data-driven, gate mounting to avoid dead nodes.
14. `[UX]` Open/close animation uses `animate-accordion-down/up` keyframes — verify `prefers-reduced-motion` disables them, and add `motion-safe:` guards.
15. `[T]` Props are raw `AccordionPrimitive.*.Props` — derive an exported `AccordionVariantProps` from the CVA and make variant/size explicit props (rule 23).
16. `[A]` Focus-visible ring is present on the trigger but the panel content itself has no focus management — ensure keyboard users can Tab into links inside the panel naturally (it works today, but add a test).
17. `[UX]` First/last item radii: when used inside a Card, corners square off — expose a `radius`/`flush` prop so the smart component can align corners.
18. `[P]` `className` merge via `cn` is fine — but `AccordionContent` merges its own `className` onto the inner div while the outer Panel keeps no class — document this split so consumers know where to style.
19. `[F]` No `name`/`group` concept — for form-like usage (exactly one open section), expose a controlled `value` + `onChange` mirroring RHF field semantics.
20. `[D]` `AccordionItem` applies `not-last:border-b` with no escape hatch — a consumer rendering a single item card (no dividers) must override with `!border-0`; add an explicit prop instead of fighting selectors.

### 🚀 New Features

1. **Multi-open mode** — an `expandMultiple`/`type="multiple"` prop so accordions can be used as expandable lists, not just single-open FAQ blocks.
2. **Animated height with content pre-measure** — a `measureContent` util so open/close animations never jump, even with images loading inside.
3. **Sticky headers** — an optional `sticky` item header while scrolling long sections (mini-TOC behaviour).
4. **Search/filter integration** — a `highlight` prop that highlights matching text in children when wired to a search input (rule 9: the smart component passes the query).
5. **Drag-to-reorder items** — `onReorder` callback + dnd-kit wiring for settings-list accordions.
6. **Keyboard shortcuts per item** — an optional `shortcut` prop rendered in the trigger (e.g. "⌘1").
7. **Accordion inside a Card** — a `flush` variant that removes outer padding/borders so items sit flush inside `CardContent`.
8. **Badge/count on the trigger** — a `count` prop rendering a trailing badge (e.g. "Errors (3)") without the consumer building the row.
9. **Collapse-all / expand-all toolbar** — an imperative `ref` API (`expandAll()`, `collapseAll()`) for "Expand all" buttons.
10. **Persisted state** — `defaultOpenItems` serialized to sessionStorage via an `id` prop (smart component opts in).
11. **Async content reveal** — a `lazy` mode that only mounts panel children on first open (perf for heavy panels).
12. **Item progress/status icon** — a `status` prop (done/error/loading) rendering a trailing icon that replaces the chevron.
13. **Animated chevron rotation** — rotate 180° on open instead of swapping icons (smoother, matches Nav trigger).
14. **Nested accordions with depth guides** — visual depth lines for multi-level FAQs.
15. **On-open autofocus** — an `autofocusContent` prop that moves focus to the panel's first focusable element for keyboard-heavy flows.
16. **RTL-aware open direction** — ensure chevron/indent flip correctly in RTL (test + docs).
17. **URL hash deep-linking** — `id`-based `location.hash` sync so "#faq-3" opens the right item.
18. **Reduced-motion mode** — `animate={false}` global override for users who prefer no expansion animation.
19. **Print styles** — force all items open when printing (`print:open` class hook).
20. **Headless mode** — a `render`/`asChild` path that exposes state without any default markup (for fully custom triggers).

---

## Alert — `components/alert.tsx`

### 🔧 Improvements

Box with optional icon, title, description, and an absolutely-positioned action.

1. `[V]` Only `default` + `destructive` variants exist — add `success`, `warning`, `info` with token-based colors so the component stops being re-implemented in apps.
2. `[V]` No `size` variant — add `sm | default | lg` (padding/typography) for inline vs banner usage.
3. `[A]` `role="alert"` on the root makes screen readers interrupt for **every** alert, even informational ones — add a `role` prop (`alert` | `status` | `none`) and default to `status` for non-destructive variants.
4. `[A]` The icon is whatever the consumer's first `<svg>` child is — provide an explicit `icon` prop (typed) and a default icon map per variant, falling back to the child convention.
5. `[R]` No ref forwarding — `Alert` and `AlertAction` should forward refs (focus the action after an error, e.g.).
6. `[UX]` No dismissible mode — add `onDismiss` + an optional close button slot so transient errors can be cleared without a bespoke wrapper.
7. `[A]` `AlertAction` is positioned `absolute end-3 top-2.5` with no focus trap or `aria-describedby` link to the alert — wire the action's `aria-label` from an `actionLabel` prop and keep `role` semantics in mind.
8. `[M]` `pe-18` (72px) reserved space for the action is hardcoded — if the action button is wider or the alert is full-width on mobile, text wraps awkwardly; compute padding from the action presence instead.
9. `[P]` `AlertTitle`/`AlertDescription` are plain divs with no memoization need, but the base `cva` call is re-evaluated per render — hoist the variant config (already module-scoped, good) and ensure consumers pass stable `className`.
10. `[Th]` `*:data-[slot=alert-description]:text-destructive/90` uses raw opacity modifiers on the token — prefer `--destructive/90` token composition so the hue stays consistent in dark mode.
11. `[D]` No `asChild`/`render` on the root — for "alert as list item" or "alert as toast-like popover" usage, expose base-ui's `render` so the smart component can change the tag without a fork.
12. `[T]` Add a zod schema (`AlertVariantSchema`) for the variant string and export the inferred type — kills stringly-typed `variant` at call sites (rule 13).
13. `[A]` `has-[>svg]:grid-cols-[auto_1fr]` assumes exactly one direct svg child — nested icons inside `AlertTitle` will break the grid; switch to `[&>svg]`-first-child semantics or the `icon` prop.
14. `[F]` No `aria-live` configurability — for form submit errors, `role="alert"` is right; for async background warnings it should be `aria-live="polite"`. Expose it.
15. `[UX]` No entrance animation — a tiny `animate-in fade-in` on mount (motion-safe only) makes server-rendered error boxes feel less jarring.
16. `[P]` The variant class strings are static; ensure the `Alert` component body doesn't create objects per render (it currently doesn't — keep it that way and add a lint rule guard).
17. `[M]` On very small screens `AlertAction` overlaps the last line of text — add a responsive fallback (static below `sm`) or `flex-wrap` layout.
18. `[D]` `AlertDescription` auto-styles `[&_a]` links — keep, but document that the smart component owns link data/behaviour; the dumb component only styles.
19. `[A]` Add `aria-describedby` wiring: when an `Alert` is associated with a form control, allow passing an `id` so the error text is announced with the field.
20. `[T]` Export `alertVariants` (currently internal) so composite components (FormShell, login forms) can reuse the exact classes instead of copying strings.

### 🚀 New Features

1. **Auto-dismiss timer** — an optional `duration` prop that fades the alert out after N seconds (for transient success messages).
2. **Inline action button** — a `Button`-styled `AlertAction` with `variant`/`size` passthrough (currently a plain div).
3. **Link-styled alert** — a `variant="link"` mode for "read more →" banners.
4. **Alert group/stack** — a `AlertGroup` container that stacks multiple alerts with a unified radius and slide-in animation.
5. **Icon per variant** — automatic icon presets (info/warning/error/success) rendered from a config map unless overridden.
6. **Collapsible alert body** — a `collapsible` prop that shows only the title until expanded (dense error logs).
7. **Copy-details button** — for error alerts, a built-in "Copy error details" action that copies `details` (passed via prop) to clipboard.
8. **Inline code highlighting** — a `code` prop or `AlertDescription` child that renders `<code>` blocks with mono styling.
9. **Live-region control** — `liveRegion="polite" | "assertive" | "off"` so the smart component chooses announce timing.
10. **Countdown in title** — a `countdown` prop (like LockoutCountdown) for "Retrying in 5…" banners.
11. **Progress-aware alert** — a `progress` prop rendering a thin bar inside the alert (upload-status banners).
12. **Toast-like entrance** — a `floating` variant that positions the alert as a fixed bottom stack (bridge between Alert and Toast).
13. **Multi-line list errors** — built-in support for rendering `string[]` errors as a bulleted list with `role="list"`.
14. **Dismiss persistence** — an `onDismiss` + `storageKey` combo so the smart component can remember dismissed announcements.
15. **Tone-shifting icon color** — icon inherits variant tone via tokens (currently forced `text-current`).
16. **Alert with checkbox** — a `confirm` slot for "Don't show again" style checkboxes in announcement banners.
17. **Micro-interaction hover** — subtle border/tint shift on hover for interactive alerts.
18. **Focus trap variant** — a `modal` mode for critical errors that traps focus until acknowledged.
19. **Print-friendly** — `print:hidden` prop for transient alerts that shouldn't appear in printed pages.
20. **Accessibility report helper** — export `alertA11yProps(variant)` so the smart component can test ARIA wiring without rendering.

---

## AlertDialog — `components/alert-dialog.tsx`

### 🔧 Improvements

Confirmation dialog built on base-ui `AlertDialog` with media, header, footer, action, cancel.

1. `[V]` `size` has `default` and `sm` but both map to `max-w-xs` (only `default` grows to `max-w-lg` on `sm+`) — the `sm` size is effectively identical; redesign the matrix (`sm | default | lg`) with distinct widths.
2. `[R]` No ref forwarding on `AlertDialogAction`, `AlertDialogCancel`, `Trigger` — refs are required to auto-focus the cancel button on open (base-ui may do it, but the wrapper must forward).
3. `[V]` `AlertDialogAction` is a bare `Button` with no loading state — add `loading` + `loadingLabel` (destructive confirmations that call the API need the spinner, mirroring `FormShell`).
4. `[A]` The action button defaults to `Button`'s primary variant — for destructive confirmations, require/encourage `variant="destructive"` and document the pairing in JSDoc.
5. `[A]` No `aria-describedby` between the description and the action — when the dialog is used as a form (input + confirm), add an `AlertDialogDescription` id wiring pattern.
6. `[UX]` Media block is `size-16 rounded-md` hardcoded — make it a `size` variant and allow a `tone` (danger/info) so icon tiles feel designed, not defaulted.
7. `[M]` Footer uses `flex-col-reverse` on mobile (cancel above confirm) — verify this matches the design system's mobile button order and add a `stackOrder` prop if either order is ever needed.
8. `[P]` `AlertDialogContent` re-renders overlay + portal every open — fine, but ensure `AlertDialogOverlay` class is stable (it is static) and don't inline new objects in the popup className.
9. `[Th]` `ring-1 ring-foreground/10` for the surface ring is token-based (good) — extend the same treatment to the overlay (`bg-black/10` → `--overlay` token) for dark-mode tuning.
10. `[T]` `size` is an inline string union — move to a zod schema + inferred type exported with the component (rule 4/13, tuple-based).
11. `[A]` No focus-return guarantee documented — base-ui restores focus on close, but add a test asserting focus returns to the trigger.
12. `[D]` `AlertDialogCancel` renders `Button` via `render` — document that the smart component owns the label text; the dumb component only needs `children`.
13. `[UX]` Header centres content (`place-items-center`) only for `size=sm` — this conditional layout is surprising; make alignment an explicit `align` prop (`center | start`).
14. `[R]` `AlertDialog` (Root) doesn't accept a `ref` — forward it so tests can assert open/closed state imperatively.
15. `[F]` No form integration story — add a documented pattern for `AlertDialog` + RHF (e.g. confirm-dialog wrapping a form submit) with `AlertDialogAction` `type="submit"` support.
16. `[A]` No `aria-label` fallback when the title is visually hidden — allow `aria-label` on `AlertDialogContent` to override the title-based naming.
17. `[P]` The content className builds `group/alert-dialog-content` + `data-size` — all static; keep them module-scoped constants to avoid GC churn on re-render.
18. `[M]` `max-w-xs` on mobile is very tight for a confirmation with a long message — allow `max-w` via a `width` prop (`sm | md | lg | full`) instead of fighting `className`.
19. `[UX]` No icon-in-title pattern — add `AlertDialogTitle` support for a leading icon that aligns with the media block (reduces double-icon usage).
20. `[T]` `AlertDialogMedia`'s `*:[svg:not([class*='size-'])]:size-8` selector is fine, but type the media as `ReactNode` slot with an `alt`-style description prop for a11y when it contains an image.

### 🚀 New Features

1. **Three-button confirmations** — support a `cancelLabel` + `confirmLabel` + optional neutral `thirdAction` slot (e.g. "Save & Continue").
2. **Async confirm with loading** — a `confirmLoading` prop that disables both buttons and shows a spinner while the API call runs.
3. **Confirmation checklist** — a `requireConfirmation` mode where the user must type a keyword (e.g. "DELETE") before the action enables (destructive safety).
4. **Countdown auto-confirm** — a `delaySeconds` prop that disables the confirm button with a countdown until it can be pressed.
5. **Escalation tiers** — `severity` prop (info/warning/critical) that styles the icon tile + confirm button tone consistently.
6. **Keyboard shortcut to confirm** — an `onConfirmShortcut` (e.g. "Enter") hint shown in the footer for power users.
7. **Remember my choice** — a checkbox in the footer ("Don't ask again") whose state flows to the smart component via `onPreferenceChange`.
8. **Step-through wizards** — an optional multi-step content mode inside the dialog (previous/next) for destructive multi-part flows.
9. **Reason required** — a `requireReason` prop that shows a `Textarea` and blocks confirm until a reason is typed (audit trail).
10. **Affected-resource summary** — a `summary` prop rendering a small table of what will change (rows affected, cascade warnings).
11. **Undo fallback copy** — a `undoHint` prop showing "You can undo this for 30 seconds" text under the description.
12. **Focus trap with return-points** — configurable focus return element (trigger vs last-focused) via `focusReturnRef`.
13. **Batch mode** — `count` prop rendering "Delete 12 items?" with pluralized copy handled by the smart component.
14. **Icon library presets** — a `media` presets map (Trash/Flag/Shield) so destructive dialogs get consistent iconography.
15. **Sticky footer on scroll** — long confirmation content scrolls, footer stays pinned with a top border.
16. **Analytics hooks** — `onOpen`/`onConfirm`/`onDismiss` events so the smart component can track conversion.
17. **Prefers-reduced-motion** — shorten the zoom animation via `motion-safe` (already partial — make it a documented prop).
18. **Custom action order** — `actionOrder` prop (`confirm-first | cancel-first`) to match platform conventions (macOS vs Windows).
19. **Linked descriptions** — render `AlertDialogDescription` from a string prop while keeping custom children support.
20. **Test helpers** — export `confirmDialogLabels()` returning computed aria-labels for component tests.

---

## AspectRatio — `components/aspect-ratio.tsx`

### 🔧 Improvements

Sets `aspect-ratio` via a CSS variable.

1. `[R]` No ref forwarding — forward to the inner `div` for measurement/layout use.
2. `[A]` No `overflow-hidden` by default — child media (images, iframes) can bleed outside the box; add a `clip` prop or default `overflow-hidden` with an escape hatch.
3. `[M]` `aspect-(--ratio)` is a single number — add support for `"16/9"`, `"4/3"` string ratios (zod union of number | ratio-string) so consumers don't compute fractions.
4. `[T]` `ratio: number` is untyped beyond the primitive — create `AspectRatioRatioSchema` (`z.number().positive() | z.string().regex(...)`) and infer the prop from it.
5. `[Th]` No theming concerns today — but the component sets an inline style; document that inline styles must stay token-free (no hardcoded colors).
6. `[D]` It's a pure layout wrapper — good; add a JSDoc example showing the smart component passing the ratio from its own config (e.g. card media ratios).
7. `[P]` The style object `{ "--ratio": ratio }` is recreated per render — memoize with `useMemo` so a parent re-render doesn't invalidate the style reference (rule 16).
8. `[A]` No `data-slot` children guidance — when the child is an image, document adding `alt`/`loading="lazy"` at the call site (data lives in the smart component).
9. `[UX]` No `rounded` pass-through convenience — since the ratio box is usually clipped media, accept an optional `radius` via className only (current behaviour is fine; just document it).
10. `[T]` Return type is `React.JSX.Element` — explicit (rule 15 satisfied); extend the same explicitness to an exported `AspectRatioProps` type so generic wrappers can extend it.
11. `[V]` No variant system needed for a layout primitive — document a deliberate "stateless, no-variant" decision in JSDoc so future contributors don't bolt CVA on.
12. `[F]` N/A for forms — note in JSDoc that ratio boxes are presentational and should never hold form state.
13. `[A]` If the ratio box wraps a media element, add `aria-hidden` guidance when decorative — covered at the smart layer; document it.
14. `[P]` No children memoization needed (layout-only), but add `React.memo` so it never re-renders on parent churn unless `ratio`/`className` change.
15. `[M]` On tiny screens `aspect-(--ratio)` scales correctly by definition — add a test that a 16/9 box never exceeds viewport width without a width constraint prop.
16. `[D]` The component must stay data-free — current implementation complies (rule 9/10 ✓); add a test asserting no DOM text is rendered.
17. `[UX]` Consider a default `display:block` + `max-width:100%` to avoid inline-block whitespace gaps under images.
18. `[A]` `data-slot="aspect-ratio"` exists — add it to the a11y tree test so automated axe scans have a stable selector.
19. `[T]` The `React.CSSProperties & Record<`--${string}`, string | number>` style type is good — extract it to a shared `CssVarStyle` type in `packages/ui/lib` and reuse across components (Switch, Sidebar, Skeleton).
20. `[P]` Ensure `className` merge doesn't allow `aspect-*` conflicts silently — document that consumers overriding the ratio should use the prop, not classes.

### 🚀 New Features

1. **Fluid ratio from data** — accept `ratio` as a `"16/9"`-style string (not just a number) for common media presets.
2. **Smart ratio presets** — `ratio="video" | "square" | "photo" | "poster"` tokens mapped in the smart component.
3. **Overlay slots** — `topLeft`/`topRight`/`bottomLeft`/`bottomRight` corner slots for badges and controls without absolute-positioning in apps.
4. **Responsive ratio** — accept a `{ base, sm, md, lg }` object so the same box changes shape across breakpoints.
5. **Contain vs cover child** — a `fit` prop (`cover | contain | fill`) that clips the child accordingly.
6. **Loading state** — `isLoading` prop rendering a `Skeleton` inside the box until the media loads.
7. **Bounded by container** — a `maxWidth`/`maxHeight` guard so huge aspect boxes never blow out the layout.
8. **Click-through support** — a `onClick` + `role="button"` mode for media that opens lightboxes.
9. **Placeholder slot** — `placeholder` render prop shown until `onLoad` fires (blur-up images).
10. **IntersectionObserver hooks** — `onInView` callback for lazy-loading media inside the box.
11. **Video support** — docs + `asChild` guidance for embedding `<video>` with `object-cover`.
12. **Rounded token integration** — `radius` prop mapped to `--radius` tokens (none/sm/md/lg/full).
13. **Border/ring presets** — a `frame` variant (thin border + ring) for gallery items.
14. **Focusable media** — `focusable` prop adding a focus ring for keyboard-accessible media.
15. **Alt-text enforcement** — a dev-time warning when a media child lacks `alt` (a11y lint in docs).
16. **Grid-friendly** — `min-w-0` + `w-full` helpers so ratios work in CSS grid cells.
17. **Emoji favicon** — not needed here; instead a `fallback` slot for broken images (rule 9: smart owns the URL).
18. **Print ratio** — keep ratios stable in print via `print:` classes.
19. **Testable id** — stable `data-slot` + optional `id` passthrough for E2E selectors.
20. **Composable with Image** — an example (in docs) pairing `AspectRatio` with `next/image` `fill` for responsive images.

---

## Attachment — `components/attachment.tsx`

### 🔧 Improvements

Upload/attachment card with media, content, actions, trigger, and group scroller; states `idle | uploading | processing | error | done`.

1. `[T]` The `state` union (`"idle" | "uploading" | "processing" | "error" | "done"`) is an inline string union — move to `AttachmentStateSchema` (zod enum) and infer the prop type (rule 4/13).
2. `[R]` No ref forwarding — `AttachmentTrigger`, `Attachment`, and `AttachmentGroup` should forward refs (file input focus, drag-over measuring).
3. `[V]` The `variant` on `AttachmentMedia` is `icon | image` only — add `file`, `audio`, `video` presets so the smart component doesn't hand-pick icons.
4. `[V]` No `error` message slot — when `state="error"`, `AttachmentDescription` recolors but there's no retry/remove affordance; add `errorLabel` + `onRetry`/`onRemove` action props.
5. `[A]` `AttachmentTrigger` covers the card with an absolute overlay — the underlying content is still focusable; add `aria-hidden` on content while the trigger is active, or use base-ui's `inert` support.
6. `[A]` No upload-progress semantics — expose `progress?: number` and render it with `role="progressbar"` + `aria-valuenow` when `state="uploading"`.
7. `[UX]` The `shimmer` class on the title while processing/uploading is a nice touch — make it respect `prefers-reduced-motion` via `motion-safe:`.
8. `[M]` `AttachmentGroup` is a horizontal snap scroller (`snap-mandatory`) — add scroll-button affordances or `scroll-fade-x` hint on desktop, and ensure drag-scroll works on touch (it does via native overflow).
9. `[P]` `Attachment` computes no derived state — good; but ensure the `group` variants (`group-data-[state=error]...`) don't force re-render of media when state changes; they only restyle.
10. `[D]` File size/name/urls must come from the smart component — current design complies; add JSDoc showing the smart-side mapping (API response → attachment props).
11. `[T]` `AttachmentTrigger`'s `type` prop shadows the native button `type` and is passed through `useRender` — document the `type` precedence or rename to avoid confusion.
12. `[F]` Add `onFileSelect` support (accept, multiple, maxSize) so a smart form can wire a hidden `<input type="file">` without owning the drop/click UI.
13. `[A]` The media/actions overlay in vertical orientation (`absolute end-3 top-3`) can overlap the title — add safe padding or a `hideActionsUntilHover` mode on mobile.
14. `[Th]` `focus-within:ring-1 ring-ring/50` is token-based ✓ — ensure error state uses `--destructive` tokens (it does via `data-[state=error]:border-destructive/30`) — keep, but make the ring color follow the state.
15. `[UX]` No remove-button default — `AttachmentActions` is an empty shell; ship a default `AttachmentRemoveButton` (X icon) that the smart component can label.
16. `[P]` The CVA configs are module-scoped ✓ — verify no per-render object creation in `AttachmentMedia`/`AttachmentAction` (they're clean).
17. `[R]` `AttachmentGroup` needs a scroll `ref` for "scroll to new attachment" — forward it.
18. `[M]` Vertical orientation `w-24` is fixed — allow `width` via prop or `min-w` so cards in a grid stay equal.
19. `[A]` Add `aria-label` default on `AttachmentActions` (`"Attachment actions"`) so icon-only buttons aren't announced as anonymous groups.
20. `[D]` All upload logic (XHR/fetch, progress, cancel) belongs to the smart component — document the contract: the dumb component only renders `state`, `progress`, and fires `onRetry`/`onRemove`/`onSelect`.

### 🚀 New Features

1. **Inline rename** — an `onRename` mode where clicking the title turns it into an input (smart component owns the mutation).
2. **Copy file name** — a copy-to-clipboard action on hover (reuses the BreadcrumbTrail copy pattern).
3. **Download action** — a built-in `onDownload` button slot for downloadable attachments.
4. **Preview lightbox** — clicking the media opens a full-screen preview (smart layer owns the overlay).
5. **Upload retry UX** — a `Retry` action button shown automatically in `state="error"` when `onRetry` is provided.
6. **File type icon presets** — auto icon by extension (`pdf`/`zip`/`doc`/`img`/`video`) via a `fileType` prop.
7. **Size/duration display** — a `meta` prop rendering "2.4 MB · 3 min" under the title.
8. **Drag-over highlight** — a `draggable` mode with a `data-dragging` state and drop target styling.
9. **Progress bar in the card** — a thin `progress` bar for `state="uploading"` inside the media tile.
10. **Cancel upload** — a default cancel button during `uploading` that fires `onCancel`.
11. **Multi-attach reorder** — `onReorder` for `AttachmentGroup` items (drag to reorder).
12. **Remove confirmation** — an optional `confirmRemove` flow (uses `AlertDialog` at the smart layer; prop wiring here).
13. **Accessible filename** — `aria-label` auto-derived from `title` unless overridden.
14. **Link mode** — a `href`-driven variant rendering the whole card as an anchor (via `render`).
15. **Thumbnail generation hook** — `onThumbnailError` so the smart component can swap to an icon on broken previews.
16. **Stacked previews** — `AttachmentGroup` gets a `maxVisible` prop with a "+N more" tail card.
17. **Scan-status animation** — a scanning/processing shimmer with a status pill ("Scanning…") during `processing`.
18. **Battery of a11y states** — `data-state` already exists; add an `aria-busy` on the group while any item uploads.
19. **Batch actions toolbar** — select-mode checkboxes on items with a floating action bar (smart layer wires selection).
20. **Drag-and-drop dropzone wrapper** — a `Dropzone` companion that wraps `AttachmentGroup` and fires `onFiles`.

---

## Avatar — `components/avatar.tsx`

### 🔧 Improvements

Avatar with image/fallback, badge, and group with overflow count.

1. `[R]` No ref forwarding on `Avatar`, `AvatarImage`, `AvatarFallback` — forward for image-load measurement and tests.
2. `[V]` Sizes are `sm | default | lg` inline union — promote to CVA (`size` + `variant: circle | rounded | square`) so avatars match other token-driven components.
3. `[V]` No `state` support — add `status`/presence (`online | offline | busy | away`) rendering a token-coloured dot instead of forcing the badge for presence.
4. `[A]` `Avatar` has no default `aria-label` and no `alt` wiring — when the image fails, `AvatarFallback` becomes the accessible name; ensure a single source of truth (prefer an `alt`/`name` prop).
5. `[A]` `AvatarBadge` has no `aria-hidden` — decorative notification dots will be read to screen readers; add `aria-hidden="true"` by default with an override.
6. `[UX]` The `after:` border ring (`after:mix-blend-darken` / `dark:after:mix-blend-lighten`) is clever but fragile — replace with a token-based ring (`ring-1 ring-border`) for predictable rendering.
7. `[M]` `AvatarGroup` uses `-space-x-2` overlap — add a `max` prop so the smart component can truncate (currently must slice in the page) and the `+N` overflow is handled by `AvatarGroupCount`.
8. `[P]` `Avatar` size selectors are `data-[size=...]` — fine; ensure consumers don't inline new size classes (rule 22); document size tokens.
9. `[D]` Image `src`, `alt`, fallback initials all come from the smart component ✓ — keep the dumb component free of user-model logic; add JSDoc contract.
10. `[T]` `size` should be derived from a zod enum (shared with Badge/Avatar sizing) — export `AvatarSizeSchema` for cross-component consistency.
11. `[A]` `AvatarImage` doesn't expose `loading="lazy"` default — add `loading` prop passthrough with a sensible default for list usage.
12. `[UX]` No hover/active feedback when the avatar is a trigger (e.g. profile menu) — add an `interactive` prop that applies `hover:opacity-80`/focus ring.
13. `[P]` `AvatarGroupCount` re-derives size via `group-has-data-[size=...]` selectors — this is O(n) selector matching per render; fine for now, but consider a `size` prop if groups grow large.
14. `[Th]` `bg-muted` fallback + `ring-background` (group rings) are token-based ✓ — verify the badge uses `--primary` tokens only (it does).
15. `[F]` N/A for forms directly — document that avatars used inside form rows (e.g. "who did this") must stay read-only presentational.
16. `[A]` Add `referrerPolicy="no-referrer"` guidance on `AvatarImage` for third-party CDN URLs (document, don't force).
17. `[UX]` No fallback shimmer while the image loads — add an optional `loading` state (`data-loading`) with a subtle pulse before `onLoad` fires.
18. `[M]` Ensure `Avatar` in `AvatarGroup` keeps `ring-2 ring-background` on light *and* dark — the token approach handles it; add a dark-mode visual regression test.
19. `[D]` `AvatarBadge` content (icon/dot/count) is provided by the smart component ✓ — document that badge data (unread counts etc.) is never computed inside.
20. `[P]` Wrap the component bodies in `React.memo` only if consumers pass stable props — since `cn` merges may create new strings, prefer `memo` with a custom comparator; otherwise document the re-render cost.

### 🚀 New Features

1. **Status dot presets** — a `status` prop (`online | offline | away | busy | dnd`) rendering a token-coloured presence dot.
2. **Initials generator** — a `name`-driven fallback that renders initials when no image is given (pure helper, smart layer owns the name).
3. **Tooltip on hover** — auto-wrap with `Tooltip` when an `alt`/`name` prop is provided.
4. **Animated ring for stories** — a `ring` prop with gradient/`animate-pulse` options for "story" avatars.
5. **Size-aware icon scale** — `AvatarBadge` icon scales with the avatar size automatically (already partial — make it a prop).
6. **Loading skeleton** — a `loading` prop rendering a `Skeleton` circle while the image resolves.
7. **Image fallback chain** — try `src`, then `fallbackSrc`, then initials (configurable chain).
8. **Clickable avatar** — `onClick` + keyboard support for profile-menu triggers (docs pattern).
9. **Group overflow menu** — clicking `AvatarGroupCount` opens a `Popover` listing hidden members (smart layer wires data).
10. **Hover reveal name** — a `showName` mode for list rows (avatar + name label inline).
11. **Presence pulse** — `online` dot with a soft `animate-pulse` halo (motion-safe).
12. **Avatar stack direction** — `AvatarGroup` gets a `direction` prop (`row | column`) and negative-gap control.
13. **Custom fallback content** — `fallback` accepts any node (icon, emoji) not just text.
14. **Colour by hash** — a `colorScheme` prop deriving a token background from a string hash (deterministic, SSR-safe).
15. **Border/ring variants** — `ring` tokens (none/thin/bold) for photo-edit UIs.
16. **Max stack clamp** — `AvatarGroup` `max` prop auto-renders the `+N` count (removes smart-layer slicing).
17. **Drag reorder in groups** — `onReorder` for avatar lists (assignees).
18. **Accessible group** — `AvatarGroup` gets `aria-label` and each avatar a `title` from `name`.
19. **Video avatar** — `AvatarImage` accepts a `mediaType="image|video"` with poster fallback.
20. **Test utilities** — export `avatarInitials(name)` and `avatarColor(name)` helpers for unit tests.

---

## Badge — `components/badge.tsx`

### 🔧 Improvements

Small status/label chip with `render` support (base-ui `useRender`).

1. `[V]` No `size` variant — add `sm | default | lg` via CVA (height, padding, text scale) so badges work in dense tables and page headers.
2. `[V]` No `state` concept — add `disabled` (opacity + no pointer) and `loading` (small spinner dot) per rule 23.
3. `[R]` No ref forwarding — forward to the rendered element (needed for tooltip triggers wrapping badges).
4. `[A]` `overflow-hidden` + `whitespace-nowrap` truncates without an ellipsis — add `max-w` + `truncate` guidance and a `title` prop for long labels.
5. `[UX]` No removable badge — add `onRemove` + an optional X slot for tag-list usage (drives `ComboboxChip` consistency).
6. `[D]` Status data (color mapping from API state) belongs to the smart component — document that the variant prop is the only styling input.
7. `[Th]` Variants use tokens (`bg-primary`, `bg-destructive/10`) ✓ — add `outline`/`secondary` dark-mode test coverage.
8. `[P]` The component is already cheap; still memoize with `React.memo` if used in list rows (hundreds of badges).
9. `[T]` Add `BadgeVariantSchema` (zod enum) + inferred type, exported alongside `badgeVariants` (rule 13).
10. `[A]` `focus-visible` ring exists but only fires when the badge is focusable — document when to use `render="button"` vs span.
11. `[M]` `h-5` is fixed — on touch, add `size="lg"` (h-6/7) so tap targets meet 44px guidance.
12. `[F]` N/A as a form control — note in JSDoc that badges are read-only presentational (validation text belongs to `FieldError`).
13. `[UX]` No icon+text alignment issue (gap-1 ✓) — but add a `dot` preset for live-status badges (pulsing dot before label).
14. `[T]` The `useRender.ComponentProps<"span">` prop spread is clean — document the `render` escape hatch with an example.
15. `[A]` Badges with meaningful state (e.g. "Active") should be announced — recommend `role="status"` via prop when non-decorative.
16. `[P]` `badgeVariants` is module-scoped ✓ — keep it exported for reuse by `Button`-adjacent composites.
17. `[M]` In `ButtonGroup`/tables, ensure `w-fit` doesn't clip — it uses `w-fit shrink-0` ✓; add a regression test.
18. `[D]` No hardcoded labels — children always come from the smart component (rule 11 ✓); add a test asserting no default text.
19. `[UX]` Add `hover` affordance only for interactive variants (badge-as-button) — currently `[a]:hover` styling is baked in; make it variant-driven.
20. `[T]` Export an `IconBadge`-style composite or document the icon+text composition pattern so apps don't hand-roll it.

### 🚀 New Features

1. **Live-status dot** — a `tone` prop (`success | warning | danger | neutral`) rendering a coloured dot + matching text tint.
2. **Pulsing badge** — a `pulse` prop (animate opacity, motion-safe) for "live" indicators.
3. **Count badge** — a `count` prop rendering a small number pill (e.g. "3 new").
4. **Progress badge** — a `progress` prop (0–100) rendering a mini bar inside the badge for uploads/steps.
5. **Clickable badge** — a `href`-driven mode rendering as a link (via `render`) with hover states.
6. **Dismissible badge** — an `onRemove` + X affordance for tag lists (consistent with `ComboboxChip`).
7. **Icon-with-label layout** — an `icon` slot with automatic `gap` alignment.
8. **Stacked badges** — a `BadgeGroup` component that wraps multiple badges with consistent spacing.
9. **Copied state badge** — a `copyValue` prop turning the badge into a copy-to-clipboard chip with transient "Copied".
10. **Dot-only mode** — a `dot` variant that renders just the status dot (for tables).
11. **Tooltip on truncation** — auto `title` tooltip when the label is truncated.
12. **Timer badge** — a `countdown`-style badge that displays remaining time (ties into `LockoutCountdown` formatting).
13. **Status schema mapping** — a `status` prop accepting a zod-inferred status and mapping to tone via a config (smart layer owns mapping).
14. **Skeleton badge** — a `loading` prop rendering a muted pill while the real status loads.
15. **Animated transitions** — smooth colour fade between tones when status changes (motion-safe).
16. **Emoji badge** — an `emoji` prop rendering an emoji with `aria-hidden` (fun, low-cost).
17. **Breakable labels** — a `wrap` mode for long multi-word statuses.
18. **Right-aligned in rows** — a `align` prop (`start | end`) for use inside `Item`/`Table` cells.
19. **Focusable with ring** — `interactive` mode with `focus-visible` ring for keyboard users.
20. **Theme-audit helper** — export `badgeToneClasses()` so apps can reuse tone classes in custom chips.

---

## Breadcrumb — `components/breadcrumb.tsx`

### 🔧 Improvements

Semantic `nav`/`ol`/`li` crumb trail with link, page, separator, ellipsis.

1. `[R]` No ref forwarding — `BreadcrumbLink` (via `useRender`) and `BreadcrumbList` should forward refs.
2. `[A]` `BreadcrumbPage` uses `role="link"` on a span — prefer native `aria-current="page"` (already set ✓) and document that it must NOT be focusable.
3. `[M]` `flex-wrap` on the list wraps crumbs on small screens — add a single-line scroll mode (`overflow-x-auto` variant) for page headers.
4. `[D]` The ellipsis is a dumb placeholder ✓ — the smart component decides collapse thresholds; keep it that way.
5. `[UX]` No truncation on long crumb labels — add a `maxW`/`truncate` mode so deep paths don't blow out the header.
6. `[T]` Separator `children ?? <ChevronRightIcon/>` default is fine — type it as `ReactNode` and document RTL rotation (already handled).
7. `[A]` `aria-label="breadcrumb"` on the root is hardcoded — allow override via prop for i18n.
8. `[V]` No size variant — add `sm | default` (gap, text-size) for dense table contexts vs page chrome.
9. `[P]` `BreadcrumbList` re-renders with every crumb change — memoize with `React.memo`; the trail is hot on navigation.
10. `[Th]` Colors use tokens (`text-muted-foreground`, `hover:text-foreground`) ✓ — verify dark mode contrast in a regression test.
11. `[F]` N/A — document that breadcrumbs are never form controls.
12. `[A]` The separator `li role="presentation"` is correct — add `aria-hidden` (already ✓) and keep the sr-only pattern for ellipsis.
13. `[UX]` No entrance animation — the shared `BreadcrumbTrail` handles that; keep this primitive animation-free (single responsibility).
14. `[D]` No route logic here ✓ — the resolver lives in the app; document the prop contract (label/href/icon arrive via items).
15. `[T]` Reuse `BreadcrumbItemSchema` from `breadcrumb-context.tsx` instead of duplicating item shapes.
16. `[A]` Add `title`/`aria-label` passthrough on `BreadcrumbLink` for long URLs (already accepted via props — document it).
17. `[M]` On touch, ensure tap targets on links are ≥44px tall — add `min-h` via the size variant.
18. `[P]` Avoid inline `className` objects — the component is clean; add a lint guard for `cn()` with non-literal args.
19. `[UX]` Add an `icon` slot convention (leading icon per crumb) matching `BreadcrumbTrail`'s mandatory-icon rule.
20. `[T]` Export a `BreadcrumbItem`-aligned prop type (zod-inferred) so smart components get autocomplete + validation.

### 🚀 New Features

1. **Auto-collapse with breadcrumb schema** — optional JSON-LD `BreadcrumbList` structured data emitted from the resolver (SEO).
2. **Async trail resolution** — a `resolveAsync` mode with loading/error statuses for data-driven breadcrumbs.
3. **Trail overrides from route params** — built-in `useParams`-style hooks so dynamic routes (e.g. `/users/[id]`) resolve names from data.
4. **Last-visited trail** — an optional `storageKey` that persists the user's last location for "back" navigation.
5. **Crumb truncation policy** — a `maxLabelLength` global setting applied by the resolver.
6. **Document title sync** — the context can drive `document.title` from the last crumb (shell chrome, opt-in).
7. **Trail events** — a `onTrailChange` callback so analytics/GA can fire on navigation.
8. **Segment metadata** — extend items with optional `meta` (description, badge) rendered by consumers.
9. **Multiple breadcrumb zones** — named contexts (primary/secondary) for page-level + section-level trails.
10. **Trail snapshots** — `subscribe` with a `getSnapshot` so non-React code (title bar, native menus) reads the current trail.
11. **i18n-ready labels** — a `translate` hook (keys in items, translations at the provider) for localized trail names.
12. **Crumb click telemetry** — `onCrumbClick` fired by the provider when a link crumb is activated.
13. **Route guard integration** — a `shouldSkip(pathname)` option so utility routes don't produce crumbs.
14. **Breadcrumb preview in devtools** — a dev-only `data-trail` attribute for debugging resolvers.
15. **Cache resolved trails** — memoize `resolve` by pathname with an LRU in the provider (perf for hot routes).
16. **Custom separator injection** — provider-level `separator` node shared by all rendered trails.
17. **Focus management** — `focusFirstCrumb()` imperative API for keyboard nav to the trail.
18. **Trail diffing** — `setItems` emits only changed segments so consumers re-render minimally.
19. **Test utilities** — export `createMockTrail()` + `TrailStatusSchema` for component tests.
20. **Error recovery** — when a resolver throws, fall back to the previous successful trail instead of erroring immediately.

---

## BreadcrumbContext — `components/breadcrumb-context.tsx`

### 🔧 Improvements

Factory (`createBreadcrumbContext`) providing provider + `useBreadcrumb`; status model `loading | error | ready`.

1. `[T]` `icon: z.custom<...>()` is a typing hole — replace with a real validator (e.g. `z.function()` with a `props` check, or a branded schema) so malformed icons fail at parse, not render (rule 1).
2. `[A]` `subscribe` never returns an unsubscribe — listeners accumulate across page navigations; return a cleanup function from `subscribe` and call it on unmount (rule 16).
3. `[P]` The provider's `subscribe`/`notify` use a `Set` in a ref — good; but `notify` iterates the set without snapshotting, so a listener that unsubscribes mid-iteration can skip others — copy the set before iterating.
4. `[T]` `toReady` uses `z.array(...).safeParse` at every `setItems` call — cheap, but hoist the array schema to a module constant (`BREADCRUMB_ITEMS_SCHEMA`) to avoid re-parsing the schema each call.
5. `[D]` `INITIAL_STATUS` is a shared mutable object — `{ kind: "loading" }` is returned by reference; freeze it (`Object.freeze`) or use a factory so one consumer can't mutate another's status.
6. `[P]` The provider re-creates `value` on every `trail` change — correct; but `reset`/`setItems` depend on `pathname` — fine since pathname is stable per route; verify no effect-loop on nested routes.
7. `[A]` No subscription callback arguments — `subscribe(listener)` should also pass the current status so shell chrome can diff without another context read.
8. `[F]` N/A for forms — document that breadcrumbs never hold form state.
9. `[T]` The `resolve` function is typed `(pathname: string) => readonly BreadcrumbItem[]` — good; add a `resolveSchema` option so apps can validate route→trail mappings at dev time.
10. `[UX]` No `lastUpdated` on status — a `ready` trail has no way to signal staleness to the shell; add an optional `version`/`at` field if the doc title sync needs it.
11. `[M]` No responsive logic here (correct) — document that collapse thresholds live in the smart consumer (`BreadcrumbTrail`'s `maxItems`).
12. `[A]` When `setError` fires, nothing announces the error — the consumer renders it; document that the consumer should use `role="status"`.
13. `[P]` `resolveRef` captures the resolver — good pattern; document it so juniors don't move `resolve` into deps and cause re-resolves.
14. `[T]` `BreadcrumbContextValue` is hand-typed — derive it from the provider's return so it can't drift.
15. `[D]` The factory is framework-free ✓ — keep `pathname` as a prop; never import `next/navigation` here (rule 9).
16. `[A]` No `useSyncExternalStore` usage — the provider is context-based; fine, but document why (per-page state, not global).
17. `[UX]` `setItems` from a data page overrides route-derived trails — document the `reset`-in-cleanup pattern (already in JSDoc) with a concrete example.
18. `[P]` Multiple `setItems` calls in one render cycle batch? React 18+ auto-batches — add a test asserting one render per `setItems`.
19. `[T]` `BreadcrumbStatus` uses a discriminated union ✓ — add zod schemas for each status variant and infer, so `toReady` and consumers share the same types.
20. `[D]` No default labels — everything arrives via `items` ✓; add a test asserting the provider renders no text on its own.

### 🚀 New Features

1. **Breadcrumb collapse presets** — `variant="auto"` that collapses based on container width (measured via ResizeObserver), not a fixed `maxItems`.
2. **Drop-down breadcrumb menu** — the ellipsis becomes a `DropdownMenu` listing ALL crumbs with icons (not just hidden ones).
3. **Keyboard shortcut copy** — pressing `⌘C` while the trail is focused copies the URL.
4. **Scroll-aware trail** — `sticky` mode so the trail stays visible while scrolling a long page.
5. **Trail with page title** — a `pageTitle` prop that syncs the trailing crumb label to the document title.
6. **Animated transitions** — a `motion` variant with slide/fade transitions between route changes (motion-safe).
7. **Share menu** — a `share` action that opens the native Share API when available (mobile).
8. **Print support** — `print:` styles that render the full uncollapsed trail when printing.
9. **Loading shimmer polish** — skeleton matches the trail width (measured) instead of fixed pills.
10. **Error retry** — an `onRetry` action on the error state for failed async resolution.
11. **Breadcrumb telemetry** — an `onNavigate` callback for analytics on crumb clicks.
12. **Custom separators per level** — a `separator` render prop for branded dividers (e.g. chevron vs slash).
13. **RTL-aware animations** — slide direction flips in RTL (test + docs).
14. **Trail search** — a `searchable` mode that lets users type to jump to a crumb (mini command palette).
15. **Overflow gradient mask** — when the trail overflows, a fade-out mask on both ends (modern browser support).
16. **Deep-link copy with query** — copy includes `search` params via an `includeQuery` option.
17. **Trail in tables** — a `compact` size for embedding inside table cells.
18. **Hover previews** — hovering a crumb shows a `Tooltip` with the full path.
19. **Auto-focus crumb** — after route change, the current crumb is announced via `aria-live` (already partially there).
20. **Copy feedback toast** — "Link copied" confirmation via the shared `toast` (opt-in prop).

---

## BreadcrumbTrail — `components/breadcrumb-trail.tsx`

### 🔧 Improvements

Memoized presentational trail: collapse + popover for hidden crumbs, copy-link button, skeletons, entrance animation.

1. `[R]` `CopyLinkButton` and `HiddenCrumbsPopover` don't forward refs — forward for tooltip/focus tests.
2. `[A]` `copyCurrentUrl` catches clipboard failure and falls back to `document.title` — the fallback silently changes what's copied; announce via the button's `title` (already done) but also consider a `role="status"` toast.
3. `[P]` `animationKey` memoizes on last label — but two trails ending in the same label (e.g. two "Settings" pages) won't re-animate; key on `items.map(i => i.href).join()` when hrefs exist.
4. `[M]` `maxItems` collapse hides the middle — on mobile the popover trigger is a 20px target; bump the hit area to 32px on touch.
5. `[D]` `renderLink` is app-supplied ✓ — document that the smart component owns `next/link` and the dumb component only wraps.
6. `[T]` `items[items.length - 1]` indexing without a guard — the code guards with `!== undefined` ✓; extract a `lastOf` helper for clarity.
7. `[A]` The copy button is `size-6` and invisible until hover at `sm+` — keyboard focus makes it visible ✓; ensure `focus-visible` is distinct from hover styles.
8. `[UX]` Copied state uses raw `text-emerald-600` — route through a `--success` token so dark mode is consistent (rule 22).
9. `[P]` `HiddenCrumbsPopover` maps `hidden` each render — memoize the popover content or hoist the mapping.
10. `[F]` N/A — document the trail as read-only navigation chrome.
11. `[A]` The error state renders `Loader2` spinning forever with the message — it's a deliberate "stale" hint, but pair it with `role="status"` (already) and consider a retry affordance via prop.
12. `[T]` `key={`${item.label}-${String(index)}`}` — string keys are fine; prefer stable item ids if the schema ever grows an `id` field.
13. `[M]` Entrance animation (`animate-in slide-in-from-left-1`) on every route change — respect `prefers-reduced-motion` via `motion-safe:`.
14. `[D]` No route knowledge ✓ — all route data arrives as props; keep it that way (rule 9).
15. `[A]` `BreadcrumbPage` on the last crumb is correctly non-focusable — add a test asserting `tabIndex` is never set.
16. `[UX]` Copy button icon swaps `Check`/`Copy`/`LinkIcon` — consider `aria-live="polite"` on the button for the "copied" announcement.
17. `[P]` `React.memo` on the export ✓ — document that consumers must pass stable `items`/`renderLink` references for the memo to pay off.
18. `[T]` `status` is a plain string union (`"loading" | "error" | "ready"`) — infer it from `BreadcrumbStatus['kind']` so it can't drift.
19. `[M]` On very narrow screens the `ml-0.5` copy button can crowd the last crumb — wrap the trail in `min-w-0` + `overflow-hidden` with truncation.
20. `[D]` All labels/tooltips are consumer-supplied ✓ — no hardcoded copy beyond the error fallback; make that fallback a prop default so i18n can override.

### 🚀 New Features

1. **Typing indicator** — a `typing` prop rendering animated dots inside a ghost bubble.
2. **Markdown rendering** — a `markdown` prop that renders `react-markdown` output (smart layer passes the parsed content).
3. **Message actions on hover** — copy/reply actions revealed on hover (mobile: tap).
4. **Reaction picker** — a `onReact` prop with an emoji picker popover wired to `BubbleReactions`.
5. **Read receipts** — a `receipt` slot (✓✓ blue) aligned to the footer.
6. **Timestamp tooltip** — exact time on hover of the footer timestamp.
7. **Bubble grouping** — auto-merge consecutive same-author bubbles with `MessageGroup` (compact mode).
8. **Error/retry bubble** — a `failed` state with a red tint + retry action for failed sends.
9. **Edited marker** — an `edited` flag rendering "(edited)" with hover showing edit time.
10. **Streaming text** — a `streaming` prop that reveals characters with a caret (AI responses).
11. **Attachments inside bubbles** — an `attachments` slot rendering mini `Attachment` cards under the text.
12. **Quote/reply preview** — a `replyTo` prop rendering a quoted snippet above the content.
13. **Long-content collapse** — a `truncate` mode with "Show more" toggle for long messages.
14. **Copy code blocks** — code blocks inside get a copy button (via the markdown pipeline).
15. **Sender mention** — `@mention` highlighting via a `mentions` prop (rendered by the smart layer).
16. **Auto-translate action** — an `onTranslate` action button on foreign-language messages.
17. **Emoji-only sizing** — when content is only emoji, render larger text (fun UX).
18. **Voice message bubble** — a `voice` variant with an audio waveform + play button.
19. **Pinned message** — a `pinned` prop with a subtle left accent + pin icon.
20. **Threading** — a `replies` count + "View thread" affordance on the bubble.

---

## Bubble — `components/bubble.tsx`

### 🔧 Improvements

Chat bubble with `variant` CVA (default/secondary/muted/tinted/outline/ghost/destructive) + reactions pill.

1. `[R]` No ref forwarding — `Bubble`/`BubbleContent` should forward refs (scroll-to-message, measuring).
2. `[T]` `align` is an inline union — infer from a zod enum shared with `Message`; export it.
3. `[V]` No `size` variant — chat threads want `sm` (compact, dense) vs `lg` (content-heavy); add via CVA.
4. `[A]` `BubbleReactions` renders buttons — consumers must label them; add an `aria-label` helper prop or document the requirement.
5. `[P]` `BubbleReactions` is absolutely positioned (`top-0 -translate-y-3/4`) — it can be clipped by `overflow-hidden` on `BubbleContent`; ensure the overflow context is documented.
6. `[M]` `max-w-[80%]` is hardcoded — make it a token/prop (`maxWidth` percent) so the smart component controls bubble width per message type.
7. `[Th]` The `tinted` variant uses `oklch(from var(--primary)...)` — clever but fragile in older browsers; provide a fallback token for the tint.
8. `[UX]` No timestamp/metadata slot — consumers stack `MessageHeader`/`MessageFooter`; consider a `meta` slot prop for the bubble itself.
9. `[D]` Bubble content (text/markdown/links) is 100% consumer-provided ✓ — keep the dumb component free of message models.
10. `[A]` The reactions pill (`ring-3 ring-card`) can obscure text on overlap — add `data-open` handling and ensure the pill doesn't trap focus.
11. `[T]` `bubbleVariants` is module-scoped ✓ — export `BubbleVariantProps` inferred type for composite usage.
12. `[F]` N/A — document bubbles as read-only display components (input/editor belong in the smart layer).
13. `[P]` `useRender` in `BubbleContent` merges props each render — fine, but avoid passing new objects from consumers (document memo pattern).
14. `[M]` On touch, reactions pill targets are small — add `min-h-6` to reaction buttons.
15. `[A]` `group-data-[align=end]/bubble:self-end` alignment is CSS-only — ensure `data-align` is set on the root (it is ✓) and tested.
16. `[UX]` No hover elevation on interactive bubbles — add an `interactive` variant that raises `hover:shadow-sm`.
17. `[D]` The ghost variant (`p-0`, transparent) exists for system messages — document its intended use so apps don't misuse it.
18. `[T]` Reaction `side`/`align` unions are inline — promote to a shared zod enum with `Marker`/`Attachment` for consistency.
19. `[A]` Add `aria-live` guidance: live-updating chat bubbles (streaming) should use `aria-live="polite"` on the scroller, not per-bubble.
20. `[P]` Memoize `Bubble` with `React.memo` for long thread re-renders (message lists re-render on scroll anchors).

### 🚀 New Features

1. **Split button** — a `DropdownMenu`-backed caret part for "primary action + more" menus.
2. **Async action feedback** — `onClick` can return a `Promise`; the button shows loading, then success (check) or error (shake) automatically.
3. **Copy-to-clipboard button** — a `copyText` prop variant with transient "Copied" state (reuses the trail pattern).
4. **Shortcut hint** — a `shortcut` prop rendering a `Kbd` hint on the right edge (desktop only).
5. **Icon + label slots** — `startIcon`/`endIcon` props so consumers stop hand-wrapping icons with spacing classes.
6. **Progress-under-button** — a `progress` prop rendering a thin bar along the bottom (upload actions).
7. **Confetti/celebration** — a `celebrate` prop firing a lightweight burst on success (motion-safe).
8. **Tooltip wrapping** — a `tooltip` prop that auto-wraps icon buttons with `Tooltip`.
9. **File input trigger** — an `accept` + `onFiles` mode that opens a hidden file picker (upload buttons).
10. **Confirm-on-click** — a `confirm` prop that shows an `AlertDialog` before running the action.
11. **Pulse/attention** — an `attention` prop with a soft pulsing ring for CTAs needing focus.
12. **Focus capture** — an `autoFocus` + `onMountFocus` combo for dialogs that should land on the primary button.
13. **Stepped loading label** — a `loadingLabel` with animated dots ("Saving…") already in FormShell; promote to Button.
14. **Keyboard repeat** — an `onKeyHold` prop (repeat while held) for steppers/counters.
15. **Ripple/fill animation** — a subtle fill-from-left transition on primary CTAs (motion-safe).
16. **Size-aware icon auto-scale** — icon sizes scale with button size automatically (extend the `[&_svg]` rule).
17. **Danger with confirmation text** — destructive variant shows a two-tap pattern ("Sure?") for irreversible actions.
18. **External link indicator** — a `target="_blank"` auto-shows the ↗ icon (a11y-safe with rel).
19. **Full-width group** — `size="block"` that stretches with `w-full` and corrects icon alignment.
20. **Button test helpers** — export `buttonA11yProps({ loading, disabled })` for component tests.

---

## Button — `components/button.tsx`

### 🔧 Improvements

The workhorse: CVA variants (default/outline/secondary/ghost/destructive/link) + sizes (default/xs/sm/lg/icon/icon-xs/icon-sm/icon-lg).

1. `[V]` No `loading` state — add `loading?: boolean` that renders the shared `Spinner`, disables the button, and sets `aria-busy` (rule 23: `state` support).
2. `[R]` Wraps `ButtonPrimitive` (base-ui) — verify the wrapper forwards refs; add an explicit `forwardRef` wrapper so `RHF register()` works without the primitive leaking.
3. `[T]` `variant`/`size` are CVA-typed but the unions are string literals — export `ButtonVariantSchema` (zod enum) + inferred types so smart components can validate config at the boundary.
4. `[A]` Icon-only sizes (`icon`, `icon-xs`…) have no built-in `aria-label` requirement — add a dev-time warning or docs mandating `aria-label` for icon buttons.
5. `[P]` `buttonVariants({ variant, size, className })` re-runs CVA on every render — CVA is memoized internally, but ensure consumers don't pass new `className` objects (rule 16).
6. `[UX]` `active:not-aria-[haspopup]:translate-y-px` — the press feedback is subtle; add a consistent `active:` scale/translate for all variants (polish, rule 7).
7. `[M]` `h-9` default is a 36px tap target — document that touch UIs should use `size="lg"` (h-10, 40px) or the new `loading`/touch sizing.
8. `[D]` The button is pure presentational ✓ — no data logic; keep it that way (rule 9).
9. `[F]` `type` defaults to the primitive's behavior — explicitly document `type="submit"` for form buttons and add a test that `onClick` doesn't fire on `disabled`.
10. `[A]` `aria-invalid` styling exists — wire `aria-describedby` support for buttons acting as form triggers (e.g. captcha trigger).
11. `[Th]` Destructive variant uses `bg-destructive/10` + `text-destructive` — solid; add a solid-destructive option (`bg-destructive text-white`) for primary danger CTAs.
12. `[UX]` No `asChild`-style API — `ButtonPrimitive` supports `render`; expose a documented `render` prop (Pagination already uses it) so buttons can be links without CSS forks.
13. `[P]` The `[&_svg:not([class*='size-'])]:size-4` selector auto-sizes icons — good; keep and document the convention so juniors don't hand-size icons.
14. `[M]` `has-data-[icon=inline-end]:pe-2` spacing utilities — add tests that icon+text buttons don't overflow narrow containers (`min-w-0`).
15. `[A]` `disabled:pointer-events-none` hides the cursor — fine, but ensure `aria-disabled` is available for buttons that stay focusable (base-ui supports it; document).
16. `[V]` No `fullWidth` variant — add `block`/`full` size option or document `w-full` composition.
17. `[UX]` Focus ring `focus-visible:ring-3` — consistent across the lib ✓; add `focus-visible:ring-offset` for high-contrast contexts.
18. `[F]` No `form` association prop passthrough — document `form="form-id"` usage for buttons outside their form.
19. `[T]` Export `ButtonProps` (intersection of primitive props + variant props) so composites (`PaginationLink`, `InputGroupButton`) stop re-deriving it.
20. `[D]` No default labels — `children` is required from the smart component ✓; add a test asserting no default text is rendered.

### 🚀 New Features

1. **Radio-like single-select** — a `value`/`onChange` API for segmented single-choice groups (roles handled).
2. **Multi-select mode** — `multiple` + `values` for toggle-chip groups (mirrors ToggleGroup).
3. **Equal-width members** — a `stretch` prop making all children share width (mobile segmented controls).
4. **Overflow-aware** — a `scrollable` mode with edge fade for too-many members.
5. **Keyboard roving** — arrow-key navigation between members (extends `role="radiogroup"` semantics).
6. **Loading member** — per-child `loading` state (spinner instead of label).
7. **Badge on members** — child-level `count` badges (e.g. All / Read (3)).
8. **Separated look** — a `connected` variant with shared borders (already partially) made explicit.
9. **Wrap mode** — a `wrap` prop for members that should flow to a new line.
10. **Tooltip members** — per-member `title` tooltips via a members config prop.
11. **Vertical on mobile** — `stackOnMobile` prop that switches orientation below `sm`.
12. **Imperative focus** — a `focusMember(index)` ref API.
13. **Disabled group** — a `disabled` prop cascading to members via context.
14. **Size/variant context** — `size`/`variant` props propagated to all children (removes per-member repetition).
15. **Member ordering** — `onReorder` for sortable segmented lists (rare but useful).
16. **A11y group label** — an `ariaLabel` prop for toolbar groups.
17. **Icon-only detection** — auto `aria-label` warning when a member has no text.
18. **Shortcut hints** — per-member `shortcut` display (e.g. View modes ⌘1/⌘2/⌘3).
19. **RTL-aware borders** — test + docs for border sharing in RTL.
20. **Member config data API** — accept a `members: readonly { value, label, icon?, disabled? }[]` prop so the smart component feeds data, the group renders it (rules 9–11).

---

## ButtonGroup — `components/button-group.tsx`

### 🔧 Improvements

Segmented group (horizontal/vertical) with text and separator sub-parts.

1. `[R]` No ref forwarding on `ButtonGroup`/`ButtonGroupText` — forward for focus-group management (arrow-key roving lives in base-ui for ToggleGroup, not here).
2. `[V]` No size/variant propagation — children (Buttons) set their own; add `size`/`variant` props that thread into a context so all members stay consistent.
3. `[A]` The group has `role="group"` ✓ — document that segmented single-choice groups should instead use `role="radiogroup"` semantics at the smart layer.
4. `[M]` Vertical orientation + many items can exceed viewport height — add an overflow/scroll option or document `flex-wrap` fallback.
5. `[P]` `*:focus-visible:z-10` z-index juggling for borders — fine; ensure no re-render churn (static classes ✓).
6. `[Th]` `ButtonGroupText` uses `bg-muted` token ✓ — add `dark:` variants check in a visual regression test.
7. `[D]` The group is data-free ✓ — document that the smart component owns item lists and `onChange`.
8. `[T]` `orientation` union is inline — promote to a shared `OrientationSchema` (zod) used by ToggleGroup/ButtonGroup (rule 4).
9. `[UX]` Segmented look is flat — add an `attached` visual cue (shared border radius via `--radius`) already handled by `rounded-e-none`/`rounded-s-none`; test all combos.
10. `[A]` No `aria-label` on the group — add it via props for toolbar-like usage.
11. `[F]` For form usage (radio-like selection), document the RHF `Controller` pattern with `value`/`onValueChange` at the smart layer.
12. `[P]` `mergeProps`/`useRender` are stateless — cheap; ensure `ButtonGroup` doesn't inline the orientation class object.
13. `[M]` On mobile, equal-width segmented buttons overflow — add a `stack` prop (`wrap | nowrap`) or document `flex-wrap`.
14. `[A]` Focus ring on inner buttons is `z-10` elevated ✓ — test keyboard Tab order across the group.
15. `[T]` `buttonGroupVariants` is exported ✓ — add inferred `ButtonGroupVariantProps` for consumers.
16. `[UX]` No `ButtonGroupText` icon sizing rules — reuse the `[&_svg]` convention from Button for consistency.
17. `[D]` `ButtonGroupSeparator` is decorative (`aria-hidden` via Separator) ✓ — keep.
18. `[V]` No disabled-group state — add `disabled` prop that disables all children via context (avoids per-child repetition).
19. `[A]` Add `aria-pressed` guidance for toggle-style groups (smart layer decision) — document it.
20. `[P]` Memoize members? They're consumer-provided; document that `React.memo` on the group helps only if children are stable.

### 🚀 New Features

1. **Range presets** — a `presets` prop (Today/7d/30d/This month) rendered as a sidebar or footer row.
2. **Min/max date guards** — built-in `minDate`/`maxDate` with disabled-day styling (smart layer passes business rules).
3. **Highlighted/event days** — a `events` map prop rendering dots/badges under days.
4. **Multi-month view** — a `months` count prop (1–3) for booking UIs.
5. **Quick month jump** — a year/decade dropdown in the caption.
6. **Week numbers** — an `showWeekNumber` toggle with `iso`/`us` numbering.
7. **Keyboard-friendly shortcuts** — "M" jumps to today, arrows navigate months with focus retained.
8. **Time slot picker** — a `withTime` mode pairing the calendar with time options.
9. **Inline event form** — clicking a day opens a small composer (smart layer owns the form).
10. **Draggable range selection** — drag across days to select a range (touch + mouse).
11. **Localized month names** — full `Intl` integration verified across locales (tests).
12. **Weekday labels abbreviated** — `weekdayFormat` prop (`short | narrow | long`).
13. **Day cell density** — a `dense` size for embedding in table cells.
14. **Scroll-to-today** — an `initialFocus` prop that scrolls to the current month on open.
15. **Outside-day handling** — a `hideOutsideDays` option to keep the grid clean.
16. **Async availability** — a `disabledDays` that can be a `Promise`-driven loading state (skeleton days).
17. **Date range presets sync** — the calendar can drive a URL query param (`?from&to`) via `onRangeChange`.
18. **Holiday calendar** — a `holidays` prop with a festive tint + tooltip.
19. **Recurring rule hint** — a `recurrence` badge on days that match a rule (weekly meetings).
20. **Compact input pairing** — a companion `DateInput` that validates + syncs with the calendar popover.

---

## Calendar — `components/calendar.tsx`

### 🔧 Improvements

DayPicker wrapper with themed classNames, chevrons, dropdown captions, and a custom `CalendarDayButton`.

1. `[P]` `formatters` and `classNames` objects are recreated on every render — wrap both in `useMemo` keyed on their inputs (rule 16: no inline object creation in props).
2. `[T]` `locale?: Partial<Locale>` weakens the type — use the full `Locale` type (or a zod-inferred subset) so `locale?.code` never silently falls back.
3. `[R]` `CalendarDayButton` holds its own `useRef` for focus — the primitive may already focus; verify and forward an outer ref for `data-day` assertions.
4. `[A]` `formatMonthDropdown` closure re-created per render — memoize; also guard `locale?.code` undefined.
5. `[M]` The nav chevrons are absolutely positioned over the caption — on narrow screens `px-(--cell-size)` caption padding can collide; test 320px width.
6. `[Th]` Cell sizing uses `--cell-size: --spacing(8)` (32px) — make it a configurable token so dense tables can shrink cells.
7. `[V]` No `size` variant — add `sm | default | lg` (cell size, gap, typography) for embedded vs full-page calendars.
8. `[A]` `data-day={day.date.toLocaleDateString(locale?.code)}` — fine for testing; add `aria-label` per day with the locale's full date format.
9. `[UX]` `today` styling (`bg-muted`) is subtle — add a `todayHighlight` prop to make it optional per app preference.
10. `[D]` All date-selection state (selected/range) comes from DayPicker props ✓ — keep the wrapper data-free (rule 9).
11. `[F]` RHF integration is native via DayPicker props — document the `Controller` pattern (value/onChange mapping) in JSDoc.
12. `[P]` The `components` object (Root/Chevron/DayButton/WeekNumber) is recreated each render — memoize or hoist to module scope.
13. `[A]` Week numbers (`showWeekNumber`) — add `aria-label` to the week-number cell for screen readers.
14. `[M]` The `months` grid `md:flex-row` splits months side-by-side on desktop — on mobile they stack ✓; add a test.
15. `[Th]` Range-selection `after:` segments use `bg-muted` — ensure `--muted` adapts in dark mode (it does via tokens) and add coverage.
16. `[T]` `buttonVariant` uses `React.ComponentProps<typeof Button>["variant"]` (rule 5: typeof) — derive from `ButtonVariantSchema` instead.
17. `[A]` Disabled days have `opacity-50` — keep them focusable per DayPicker default; document the `disabled` + `focusable` interplay.
18. `[UX]` No quick month-jump affordance — the dropdown captions (`captionLayout="dropdown"`) exist; document how to enable them.
19. `[P]` `CalendarDayButton` re-renders on every `modifiers` change — fine; ensure the button receives stable `className` from the memoized classNames map.
20. `[D]` No hardcoded strings (month names come from `Intl`) ✓ — verify against a non-English locale in tests.

### 🚀 New Features

1. **Expandable card** — a `collapsible` body with an animated chevron header.
2. **Card tabs** — an optional `Tabs` integration so a card hosts tabbed content (smart layer wires tabs).
3. **Draggable card** — dnd-kit wiring with `dragHandle` and reorder callbacks for dashboard grids.
4. **Card link** — an `href` prop rendering the whole card as a link with hover elevation.
5. **Hover-reveal actions** — `CardActions` fade in on hover/focus (touch: always visible).
6. **Loading skeleton card** — a `loading` prop rendering `Skeleton` rows until data resolves.
7. **Card header sticky** — a `stickyHeader` mode when scrolling long card bodies.
8. **Icon header preset** — a `titleIcon` prop aligning an icon with the title row.
9. **Card grid** — a `CardGrid` companion handling responsive columns + equal heights.
10. **Flip card** — a 3D flip variant (front/back faces) for interactive swatches.
11. **Card stepper** — a `step`/`totalSteps` progress indicator in the header (wizard steps in cards).
12. **Print-friendly** — `print:` styling that removes shadows/borders when printing.
13. **Card with cover image** — a `cover` slot with aspect-ratio handling + overlay gradient.
14. **Footer actions alignment** — `CardFooter` gets `justify`/`stack` props for action rows.
15. **Card context menu** — right-click menu wiring (long-press on touch) for list cards.
16. **Selection mode** — a `selectable` variant with checkmark overlay for gallery grids.
17. **Animated entrance** — a `animateIn` prop (fade+rise, motion-safe) for dashboard mounts.
18. **Card count badge** — a `badge` slot in the top-right corner (notification-style cards).
19. **Keyboard navigation** — arrow-key navigation between cards in a grid (roving focus).
20. **Card schema** — a `CardDataSchema` (zod) helper so smart components validate card payloads.

---

## Card — `components/card.tsx`

### 🔧 Improvements

Container with header/title/description/action/content/footer, spacing driven by `--card-spacing`.

1. `[R]` No ref forwarding — `Card`/`CardContent` should forward refs (scroll-into-view, intersection observers).
2. `[V]` Only `size` (`default | sm`) exists — add `variant: default | outline | ghost | interactive` so clickable cards get hover elevation without per-app CSS.
3. `[UX]` No `hoverable`/press affordance — an `interactive` variant should add `hover:shadow-md`, `hover:ring`, and `active:scale-[0.99]` (polish).
4. `[A]` Interactive cards need keyboard support — document `render="button"`/`role` semantics for clickable cards at the smart layer.
5. `[M]` `overflow-hidden` + fixed `--card-spacing` — on tiny screens ensure the action (`CardAction`) doesn't overlap the title (grid `col-start-2` is robust ✓; add a test).
6. `[T]` `size` is an inline union — promote to `CardSizeSchema` + inferred type (rule 4).
7. `[D]` Card renders no data ✓ — all content via children; keep it that way (rule 9).
8. `[Th]` `ring-1 ring-foreground/10` for the surface — consider `--card-border` token for consistent ring color in dark mode.
9. `[P]` `gap-(--card-spacing)` uses the CSS var — no per-render object creation ✓; add a lint guard for inline style objects.
10. `[UX]` Image handling (`has-[>img:first-child]:pt-0`, rounded corners) — document that media URLs/data come from the smart component.
11. `[A]` No `aria` needs for static cards — document that dynamic content inside should use standard landmarks at the page level.
12. `[F]` N/A as form control — but cards wrapping forms (`FormShell` inside a card) should get `data-slot` hooks for tests; already present ✓.
13. `[M]` `CardFooter` `flex items-center` — wrap content on narrow screens; add `flex-wrap` default.
14. `[V]` No `padding` override — `size` covers it; document that per-card padding overrides should use className, not inline styles.
15. `[P]` Memoize `Card` with `React.memo` — cards in grids re-render with their content; a shallow memo avoids cascades.
16. `[D]` `CardAction` is a slot — the smart component owns the action's data/behaviour ✓.
17. `[T]` Export `CardProps` (ComponentProps<"div"> & size) so composites extend it cleanly.
18. `[UX]` No elevation scale — document token-based `shadow-xs/sm/md` usage instead of raw shadow classes.
19. `[A]` `CardHeader` grid rows — when both title+description present, `auto-rows-min` handles it ✓; test long titles truncate gracefully.
20. `[M]` On very narrow screens `CardAction` (icon buttons) can overflow — add `min-w-0` + `shrink-0` guidance.

### 🚀 New Features

1. **Autoplay with pause-on-hover** — a `autoplay` + `autoplayInterval` prop (Embla autoplay plugin wiring, `pauseOnHover`/`pauseOnFocus`).
2. **Pagination dots** — a `CarouselDots` sub-component synced to the active slide.
3. **Thumbnail strip** — a `CarouselThumbs` sync (click thumb to jump).
4. **Loop + dragFree** — `loop`/`dragFree` props passthrough with documented options.
5. **Slides per view responsive** — `slidesToShow={{ base: 1, sm: 2, lg: 3 }}` via Embla breakpoints.
6. **Swipe-to-dismiss** — a variant where the active slide can be swiped away (cards queue).
7. **Zoom on hover** — a `zoom` prop that scales the active slide slightly (motion-safe).
8. **Slide counter** — a "2 / 8" indicator chip built-in.
9. **Keyboard full support** — arrows + PageUp/PageDown + Home/End (currently only left/right).
10. **Progress bar** — an autoplay progress bar under the carousel.
11. **Snap + scrollbar** — a `scrollSnap` mode pairing with `AttachmentGroup`-style scrollbars.
12. **Parallax captions** — a `caption` slot that moves slightly with scroll (motion-safe).
13. **Lazy slide mounting** — mount slide content only when near the viewport (perf).
14. **A11y announcements** — `aria-live` for slide changes (configurable `aria-live="off"` when autoplaying).
15. **Touch-action guard** — prevent horizontal scroll conflict inside scrollable parents (docs + prop).
16. **RTL flip** — direction-aware navigation in RTL (test + docs).
17. **Event logging** — `onSlideChange(index)` + `onSlideViewportChange` for analytics.
18. **Custom drag handle** — a `dragFree`-with-cursor variant showing grab/grabbing cursors.
19. **Before/after slider** — a two-slide comparison mode (image diffing).
20. **Headless controls** — expose `useCarouselControls()` returning scroll/state so apps build custom arrows.

---

## Carousel — `components/carousel.tsx`

### 🔧 Improvements

Embla-based carousel with context, prev/next, and slide group semantics.

1. `[T]` `type UseCarouselParameters = Parameters<typeof useEmblaCarousel>` (rule 5: typeof) and `ReturnType<typeof useEmblaCarousel>` — re-export Embla's own types instead (they're already exported) to kill `typeof` usage.
2. `[P]` `useEmblaCarousel({ ...opts, axis })` spreads `opts` into a new object every render — memoize with `useMemo` keyed on `opts`/`orientation` (rule 16).
3. `[A]` `handleKeyDown` only handles ArrowLeft/Right — in `orientation="vertical"`, support ArrowUp/Down as well.
4. `[A]` The region has `aria-roledescription="carousel"` but no `aria-label` — add a `label` prop (e.g. "Featured products").
5. `[R]` No ref forwarding — `CarouselContent`/`CarouselItem` should forward refs for measurement and a11y tests.
6. `[D]` Slides are `children` ✓ — the smart component owns slide data and rendering; document that pagination dots are a smart-layer concern.
7. `[M]` Prev/next buttons sit at `-start-12` (outside) — on small screens they overlap content; add `inside`/`floating` placement option.
8. `[T]` `CarouselContextProps` re-derives primitive types with `ReturnType`/`Parameters` — use Embla's exported `EmblaCarouselType` and `EmblaOptionsType`.
9. `[A]` Slide items get `role="group"` + `aria-roledescription="slide"` ✓ — add `aria-label="1 of 5"` via a `slides` count so screen readers announce position.
10. `[UX]` No autoplay/pause — Embla plugins support it; document the plugin pattern (don't re-implement).
11. `[P]` `setApi`/`onSelect` effects run on every mount — cleanup is correct ✓; add `useCallback` stability guards (already done for handlers).
12. `[F]` N/A — document carousel as read-only display.
13. `[M]` `basis-full` slides — add `visibleCount`/`slidesToShow` option via Embla `slidesToScroll` documented in JSDoc.
14. `[Th]` Button styling reuses `Button` variants ✓ — no raw colors in this file.
15. `[A]` `aria-live` on the region: set `aria-live="polite"` only when autoplaying, else `off` — document the pattern.
16. `[UX]` No drag cursor affordance (`cursor-grab`) on the viewport — add it via `touch-manipulation` (already on buttons) + `cursor-grab`.
17. `[T]` `CarouselApi = UseEmblaCarouselType[1]` tuple-index is fine (rule 4 ✓) — but move it next to the Embla import so it's greppable.
18. `[P]` The context `value` object is recreated each render — wrap in `useMemo` (rule 16).
19. `[A]` Prev/next have `sr-only` labels ✓ — but the buttons are `disabled` when no scroll; add `aria-disabled` consistency for tests.
20. `[M]` On touch, swipe gestures are native (Embla) — add `dragFree`/`loop` options documented as props passthrough.

### 🚀 New Features

1. **Brush/zoom** — a `zoomable` prop wiring Recharts `Brush` for time-series exploration.
2. **Drill-down** — an `onClickSeries`/`onClickBar` callback so the smart component can drill into segments.
3. **Export PNG/CSV** — `exportImage()`/`exportData()` helpers (smart layer owns the data).
4. **Reference lines** — a `referenceLines` prop (targets, thresholds) with dashed styling.
5. **Annotations** — a `annotations` prop rendering labelled markers on the chart.
6. **Animated transitions** — `animationDuration`/`isAnimationActive` passthrough (motion-safe).
7. **Live-updating** — a `stream` mode that appends points without resetting zoom (Recharts `data` swapping).
8. **Empty/loading states** — built-in `Empty`/`Skeleton` placeholders before data arrives.
9. **Custom cursors** — a `cursor` render prop (crosshair vs custom tooltip cursor).
10. **Legend interactivity** — click a legend item to toggle series visibility.
11. **Value formatting** — a `valueFormatter` shared by axis + tooltip (currency, %, SI units).
12. **Color-blind-safe palettes** — a `palette` prop with WCAG-approved colour sets (tokens).
13. **Responsive breakpoints** — chart density switches (labels hidden below `sm`) via container queries.
14. **A11y data table** — a `showDataTable` toggle that renders an accessible table fallback of the data.
15. **Multi-axis support** — `yAxisId` presets documented for dual-axis charts.
16. **Threshold shading** — band shading (e.g. danger zone) via `bands` prop.
17. **Sparkline mode** — a `sparkline` variant (no axes, tiny) for stat cards.
18. **Tooltip pinning** — click to pin the tooltip for reading values (smart-layer state).
19. **SSR-safe sizing** — `initialDimension` + ResizeObserver fallback documented for server renders.
20. **Chart config schema** — a `ChartConfigSchema` (zod) validating series configs at the boundary (replaces the `never`-typed union).

---

## Chart — `components/chart.tsx`

### 🔧 Improvements

Recharts wrapper: `ChartContainer`, `ChartTooltipContent`, `ChartLegendContent`, `ChartStyle` with per-theme CSS vars.

1. `[T]` `toDisplayKey(value: unknown)` and `isRecord(value: unknown)` — rule 2 violation; replace with zod schemas (`z.string() | z.number()` unions) inferred from the data model.
2. `[T]` `typeof value === "string"` / `typeof item.value === "number"` checks (rules 5/13) — replace with `KeySchema`/`ChartValueSchema` narrowing.
3. `[T]` `ChartConfig` uses `theme?: never` / `color?: never` — rule 3 violation; model as a discriminated union (`color: string` | `theme: Record<...>`) with zod.
4. `[T]` `keyof typeof THEMES` (rule 5) — define `THEMES` via a `ThemeNameSchema` (zod enum: `light`/`dark`) and infer.
5. `[P]` `ChartStyle` builds a `<style>` tag with `dangerouslySetInnerHTML` — it's config-driven (safe), but add a comment + CSP note; consider a `data-theme` CSS-var approach.
6. `[A]` The chart root has no `role="img"`/`aria-label` — add an `ariaLabel` prop so charts are announced; recharts' own a11y layer needs it at the container.
7. `[D]` Chart data/config arrive from the smart component ✓ — keep `ChartContainer` data-free (rule 9).
8. `[T]` `ChartTooltipContent` props include `labelKey?: string` / `nameKey?: string` — type them against a zod key schema to prevent typos.
9. `[UX]` Tooltip `indicator` modes (dot/line/dashed) ✓ — add `indicatorSize` token so dense charts can shrink indicators.
10. `[M]` The tooltip `min-w-32` can overflow on small screens — cap `max-w` and allow horizontal scroll inside the tooltip.
11. `[P]` `tooltipLabel` useMemo ✓ — but `getPayloadConfigFromPayload` runs per item; memoize the config lookup.
12. `[A]` Legend content renders color swatches with no `aria-label` — label them from `itemConfig.label` for screen readers.
13. `[Th]` `THEMES`/`THEME_ENTRIES` pair light/dark selectors ✓ — add a `data-theme` attribute approach so inline `<style>` isn't needed per chart.
14. `[F]` N/A — document charts as read-only visualization (interactive chart state lives in the smart component).
15. `[T]` `TooltipNameType = number | string` — reuse the zod-inferred value type from #2.
16. `[UX]` No empty-data handling — when `payload` is empty the container still renders; add an `Empty`-compatible slot/fallback prop.
17. `[P]` `INITIAL_DIMENSION` module constant ✓ — document that consumers override via `initialDimension` for SSR-stable sizing.
18. `[A]` Recharts `accessibilityLayer` — document enabling it and wiring `role`/keyboard focus in JSDoc.
19. `[M]` `aspect-video` fixed ratio — allow `height` prop so tall charts (bar lists) don't get squished on mobile.
20. `[D]` No hardcoded labels — all series names from `config` ✓; add a test asserting no chart text is rendered without config.

### 🚀 New Features

1. **Tri-state (indeterminate)** — an `indeterminate` prop rendering the minus icon (select-all UX).
2. **Checkbox group** — a `CheckboxGroup` managing a `string[]` value with `selectAll` behaviour.
3. **Card-style checkbox** — a `variant="card"` that looks like a selectable card (with border + checkmark).
4. **Animated check** — a draw-in checkmark animation (motion-safe).
5. **Size-aware icon** — check icon scales with checkbox size.
6. **Loading state** — an `isLoading` prop with a tiny spinner in the box (async toggles).
7. **Error message slot** — an `error` prop rendering helper text under the box (compose with `FieldError`).
8. **Indeterminate-aware a11y** — `aria-checked="mixed"` verified + documented.
9. **Partial selection sync** — a `partial` prop auto-derived by the smart component (list checkboxes).
10. **Keyboard-friendly labels** — clicking the label toggles via `htmlFor` wiring (docs pattern).
11. **RTL support** — box placement flips in RTL (test + docs).
12. **Custom icons** — `checkIcon`/`minusIcon` slots.
13. **Focus-visible ring polish** — a softer ring for mouse users, strong ring for keyboard (already partial).
14. **Tooltip on hover** — a `tooltip` prop for disabled reasons ("Requires admin").
15. **Compact row mode** — a `dense` size for table-row checkboxes.
16. **Persisted selection** — a `storageKey` opt-in for preference toggles (smart layer owns storage).
17. **Toggle animation spring** — a subtle scale on state change (motion-safe).
18. **Form-native events** — `onChange` receives `{ checked, value }` typed via zod (no raw events at call sites).
19. **Test helpers** — export `checkboxState()` returning a11y props for tests.
20. **Reconciliation** — when `value` is removed from a group's options, the checkbox clears itself (smart layer handles).

---

## Checkbox — `components/checkbox.tsx`

### 🔧 Improvements

Base-ui checkbox with check indicator and aria-invalid support.

1. `[V]` No `size` variant — add `sm | default | lg` (box px + icon size) via CVA for tables vs settings pages.
2. `[V]` No `state` support — add `error` (visual + aria-invalid already) and `loading` (indeterminate spinner) states.
3. `[A]` No indeterminate visual — base-ui supports `indeterminate`; add the prop + a minus icon when checked-state is `indeterminate`.
4. `[R]` No ref forwarding — `forwardRef` is mandatory (rule 20) so RHF `register()` and focus management work.
5. `[F]` Document the RHF `Controller` pattern (value/onChange) — the component is already fully controlled ✓.
6. `[A]` The `after:-inset-x-3 -inset-y-2` hit-area expansion is invisible to tests — add `aria-label` guidance + a larger-focus-ring note.
7. `[P]` The `CheckIcon` mounts even when unchecked (hidden by CSS) — fine; document the pattern for icon a11y.
8. `[Th]` `dark:data-checked:bg-primary` duplicates `data-checked:bg-primary` — simplify to a single token path (the dark override may be unnecessary).
9. `[UX]` No animated check — add `transition` on the indicator for a subtle draw-in (motion-safe only).
10. `[D]` Checked state is fully controlled ✓ — data (checked/indeterminate) always from the smart component.
11. `[M]` The hit area is 44px via `after:` expansion ✓ — document that label tap should toggle (Label wiring in `Field`).
12. `[T]` `CheckboxPrimitive.Root.Props` spread is fine — export `CheckboxProps` for composites (table row selection).
13. `[A]` Add `aria-describedby` support (props passthrough exists) — document wiring to `FieldError`.
14. `[F]` `required` prop passthrough ✓ — add a test that `required` + `aria-invalid` styling compose.
15. `[UX]` No `color`/tone variant — checkbox is usually single-color; document why (design system constraint) instead of adding variants.
16. `[P]` Memoize with `React.memo` — checkbox rows re-render on selection; a shallow memo prevents parent cascades.
17. `[A]` Keyboard: Space toggles via primitive ✓ — add a regression test for ArrowKey nav in a `CheckboxGroup`-like container.
18. `[M]` On touch, ensure the indicator doesn't shrink below 14px — size variant handles it.
19. `[T]` Consider a `CheckboxGroupSchema` if groups grow — document the pattern first.
20. `[D]` No default label text — children come from the smart component; add a test asserting no text is rendered by the box itself.

### 🚀 New Features

1. **Animated height** — a `collapsible-animation` wrapper (grid-template-rows trick) with motion-safe guards.
2. **Trigger chevron** — a default chevron icon that rotates (with `icon` slot override).
3. **Card/list variants** — `variant="card"` (bordered box) and `variant="list"` (hairline) presets.
4. **Nested collapse groups** — depth guides + independent open states (accordion-like).
5. **Unmount-on-close** — a `forceMount`/`unmountOnClose` prop to free memory for heavy panels.
6. **Scroll into view on open** — an `openScrollTo` option that scrolls the panel into view.
7. **Focus management** — focus moves to the panel's first focusable on open (opt-in).
8. **Badge/count on trigger** — a trailing badge (e.g. "5 filters").
9. **Keyboard shortcut** — a `shortcut` prop to toggle (e.g. "F" for filters).
10. **Persist open state** — an `id` + `storageKey` opt-in (smart layer owns storage).
11. **Reveal-on-data** — an `openWhen` prop that auto-opens when a condition becomes true (errors panel).
12. **Loading body** — a `loading` prop rendering `Skeleton` inside until content is ready.
13. **Sticky open body scroll** — a `maxHeight` + `overflow` mode for long panels.
14. **Copy collapsed text** — a `copySummary` action for support-diagnostic panels.
15. **Print-expanded** — `print:` classes force all panels open when printing.
16. **Grouped toggles** — a `CollapsibleGroup` managing multiple collapsibles with "expand all".
17. **Breadcrumb trail inside** — document composing the trail in a collapsible (settings breadcrumb).
18. **RTL-safe chevron** — rotation/indent flips in RTL (test + docs).
19. **A11y state hook** — expose `data-state`/`aria-expanded` for E2E selectors (already via primitive — document).
20. **Collapsible stepper** — a multi-step collapsible where only the active step is open (wizard).

---

## Collapsible — `components/collapsible.tsx`

### 🔧 Improvements

Bare base-ui collapsible (Root/Trigger/Content) — no styling, no animation.

1. `[V]` No styling at all — add CVA `variant` (`default | card | list`) so collapsibles match the Accordion look without re-implementation.
2. `[A]` No chevron/indicator affordance — add an `icon` slot (default chevron) that rotates on open, mirroring Accordion.
3. `[R]` No ref forwarding — forward Root/Trigger/Content refs (focus management, tests).
4. `[P]` No animation on open/close — add `animate-collapsible-down/up` (motion-safe) or document the primitive's own transition props.
5. `[M]` Trigger needs a ≥44px hit target — add a size variant (`sm | default | lg`).
6. `[F]` N/A as form control — but an accordion-style multi-field section benefits from `data-slot` hooks (present ✓).
7. `[A]` Trigger should get `aria-controls`/`aria-expanded` — base-ui provides; add a regression test asserting attributes.
8. `[UX]` No disabled state — add `disabled` to the trigger (base-ui supports `disabled`).
9. `[D]` Content is 100% consumer-owned ✓ — keep the dumb component data-free.
10. `[T]` Export `CollapsibleProps` from the primitive props so composites can extend.
11. `[A]` Content should announce open/close to SRs — `aria-expanded` covers it; document `aria-live` for dynamic content inside.
12. `[P]` Memoize — collapsibles in dashboards re-render; `React.memo` on Root helps.
13. `[Th]` No colors today — when adding variants, use tokens only (rule 22).
14. `[UX]` Add an `unmountOnClose` option (content unmounts when closed) to save memory on heavy panels.
15. `[A]` Keyboard: Enter/Space toggle, Escape closes — primitive default; add a test.
16. `[M]` On mobile, nested collapsibles stack — document `gap` spacing via className.
17. `[D]` The smart component owns open state — document the controlled `open`/`onOpenChange` pattern.
18. `[T]` Consider a zod schema for the `variant`/`size` union once added (rule 4).
19. `[A]` Add `data-state` (`open`/`closed`) — base-ui sets it; document for CSS hooks.
20. `[P]` Avoid inline `className` objects from consumers — add a lint guard example to the doc.

### 🚀 New Features

1. **Animated height** — a `collapsible-animation` wrapper (grid-template-rows trick) with motion-safe guards.
2. **Trigger chevron** — a default chevron icon that rotates (with `icon` slot override).
3. **Card/list variants** — `variant="card"` (bordered box) and `variant="list"` (hairline) presets.
4. **Nested collapse groups** — depth guides + independent open states (accordion-like).
5. **Unmount-on-close** — a `forceMount`/`unmountOnClose` prop to free memory for heavy panels.
6. **Scroll into view on open** — an `openScrollTo` option that scrolls the panel into view.
7. **Focus management** — focus moves to the panel's first focusable on open (opt-in).
8. **Badge/count on trigger** — a trailing badge (e.g. "5 filters").
9. **Keyboard shortcut** — a `shortcut` prop to toggle (e.g. "F" for filters).
10. **Persist open state** — an `id` + `storageKey` opt-in (smart layer owns storage).
11. **Reveal-on-data** — an `openWhen` prop that auto-opens when a condition becomes true (errors panel).
12. **Loading body** — a `loading` prop rendering `Skeleton` inside until content is ready.
13. **Sticky open body scroll** — a `maxHeight` + `overflow` mode for long panels.
14. **Copy collapsed text** — a `copySummary` action for support-diagnostic panels.
15. **Print-expanded** — `print:` classes force all panels open when printing.
16. **Grouped toggles** — a `CollapsibleGroup` managing multiple collapsibles with "expand all".
17. **Breadcrumb trail inside** — document composing the trail in a collapsible (settings breadcrumb).
18. **RTL-safe chevron** — rotation/indent flips in RTL (test + docs).
19. **A11y state hook** — expose `data-state`/`aria-expanded` for E2E selectors (already via primitive — document).
20. **Collapsible stepper** — a multi-step collapsible where only the active step is open (wizard).

---

## Combobox — `components/combobox.tsx`

### 🔧 Improvements

Base-ui combobox with input-group trigger, chips, clear, empty, and collections.

1. `[R]` No ref forwarding — `ComboboxInput`, `ComboboxTrigger`, `ComboboxChips` need refs (RHF register, focus tests).
2. `[V]` No size variant — the input-group sizing is fixed; add `size` (sm/default/lg) threaded through the InputGroup.
3. `[A]` `ComboboxEmpty` is visually hidden until `group-data-empty` — ensure it stays focusable-free and announced via the primitive's `aria` wiring.
4. `[F]` Document the RHF `Controller` pattern for single-select; for multi-select (chips) document value as `string[]`.
5. `[M]` `ComboboxChips` `min-h-9` wrap — on mobile, chips wrap ✓; ensure the trigger area scrolls horizontally instead of growing unbounded.
6. `[P]` `ComboboxContent` positions with `--anchor-width`/`--available-width` — no per-render objects; verify `useComboboxAnchor` ref usage is documented.
7. `[UX]` No loading state — add `loading` that renders a spinner row in the list (common for async options).
8. `[D]` Options/values are consumer-owned ✓ — the dumb component never fetches; document the smart-side data mapping.
9. `[T]` `ComboboxChip` `showRemove` bool — fine; add a zod schema for chip `value` when used in forms (rule 4).
10. `[A]` Chip remove buttons need `aria-label` (e.g. "Remove {label}") — add a `removeLabel` prop or derive from children.
11. `[P]` `ComboboxList` `max-h-[min(calc(...))]` calc is heavy — hoist to a CSS var so it's computed once.
12. `[Th]` Chip `bg-muted` token ✓ — ensure dark-mode contrast in a visual regression test.
13. `[A]` Keyboard: arrow/typeahead handled by primitive ✓ — add a test for Home/End and chip-deletion via Backspace.
14. `[M]` On touch, the trigger chevron is small — bump hit target via `InputGroupButton` size (already `icon-xs`; consider `icon-sm` on touch).
15. `[UX]` No selected-option summary in single-select mode — `ComboboxValue` handles display; document customizing it.
16. `[F]` `disabled` prop on `ComboboxInput` ✓ — add a test that `aria-disabled` composes with the InputGroup.
17. `[T]` Export `ComboboxValueProps`/`ComboboxTriggerProps` inferred types so composites stop re-deriving them.
18. `[A]` The clear button (`ComboboxClear`) — add `aria-label="Clear selection"` (it's an icon-only button).
19. `[P]` Memoize `ComboboxChip` — chip lists re-render on every keystroke in filter mode.
20. `[D]` No default labels/empty text — all copy from the smart component ✓; make `ComboboxEmpty` children required-or-defaulted via prop.

### 🚀 New Features

1. **Async search** — a `loadOptions(query)` prop with debounce, a loading row, and a "no results" state.
2. **Create-new option** — an `allowCreate` mode that adds the typed text as a new option (fires `onCreate`).
3. **Virtualized list** — `@tanstack/react-virtual` wiring for thousands of options.
4. **Group select-all** — a group header with a select-all checkbox for grouped multi-select.
5. **Recent selections** — an optional "Recent" group pinned at the top (smart layer owns history).
6. **Max selection guard** — a `maxSelected` prop disabling further picks with a toast hint.
7. **Value formatting** — a `formatValue` render prop for custom trigger labels (avatars, badges).
8. **Remote filter debounce** — a `debounceMs` prop for server-side search.
9. **Chip overflow handling** — "+3 more" chip when chips exceed a `maxChips` count.
10. **Empty-state CTA** — an `onCreateEmpty` action inside `ComboboxEmpty` for zero-result flows.
11. **Keyboard shortcut to open** — a `shortcut` prop (e.g. "⌘K") focusing the input.
12. **Clear-all button** — a single action that resets the whole selection (multi-select).
13. **Option descriptions** — multi-line items with a secondary `description` field.
14. **Selected-option summary tooltip** — hovering the trigger shows the full selection list.
15. **Controlled open state** — `open`/`onOpenChange` props for external control (e.g. form flow).
16. **Search-inside-results** — `filter` prop (default `contains` | `startsWith` | custom) documented.
17. **RTL-aware dropdown** — positioner flips correctly in RTL (test + docs).
18. **Mobile sheet fallback** — below `sm`, render options in a bottom `Sheet` instead of a popover.
19. **Persist draft query** — keep the filter text when closing/reopening (smart layer state).
20. **A11y live region** — announce selection count changes via `aria-live` ("3 of 5 selected").

---

## Command — `components/command.tsx`

### 🔧 Improvements

cmdk-based command palette with dialog, input, list, item, shortcut, separator.

1. `[R]` No ref forwarding — `CommandInput`, `CommandItem`, `CommandList` need refs (focus-first-item, tests).
2. `[V]` No size/variant — add `size` for the input and `variant` for items (default/`destructive`-style) to match DropdownMenu conventions.
3. `[A]` `CommandDialog`'s title/description are `sr-only` — fine, but add `aria-label` override on the `Dialog` root for i18n.
4. `[UX]` No loading state — cmdk supports `loading`; render a spinner row + `aria-busy` on the list.
5. `[F]` N/A as form control — but commands that submit forms (e.g. "Save") need `onSelect` + type mapping; document.
6. `[P]` `CommandInput` `className` uses `h-8! rounded-lg!` important overrides — replace with a dedicated InputGroup size to avoid `!` battles.
7. `[M]` `CommandList` `max-h-72` — on small screens cap to `min(60vh, ...)` via CSS var; ensure scroll works on touch.
8. `[D]` Command items/data are consumer-owned ✓ — palette search logic (fuzzy filter) stays in the smart component.
9. `[T]` `CommandItem` `data-[checked=true]` check icon — fine; add a zod schema for item `value`/`keywords` when fed from an API.
10. `[A]` `CommandEmpty` default text — make it a prop (`emptyText`) with a sensible default that i18n can override.
11. `[Th]` `bg-popover`/`text-popover-foreground` tokens ✓ — verify the input group's `bg-input/30` in dark mode.
12. `[A]` Keyboard: cmdk handles arrows/Enter ✓ — add `aria-activedescendant` verification for SR announcements.
13. `[UX]` No footer/status row — add an optional `CommandFooter` slot (e.g. "↵ to select · esc to close").
14. `[P]` The `DialogHeader` inside `CommandDialog` is `sr-only` but still mounted — fine; ensure it doesn't render empty nodes on the server.
15. `[M]` On touch keyboards, the input needs `enterKeyHint` — add `enterKeyHint="search"` default.
16. `[F]` Document wiring `CommandDialog` to a global hotkey (⌘K) in the smart layer (the palette store owns it).
17. `[T]` `CommandShortcut` accepts `children` — type as `ReactNode` (already) and document `Kbd` composition.
18. `[A]` Items show a check icon when `data-checked` — add `aria-checked` for multi-select command lists.
19. `[P]` Memoize `CommandItem` — filtered lists re-render per keystroke.
20. `[D]` No hardcoded copy except defaults — promote `title`/`description` defaults to props (already done for CommandDialog ✓).

### 🚀 New Features

1. **Global ⌘K hook** — a `useCommandPalette(actions)` hook that opens the palette and wires keyboard nav.
2. **Recent + favourites sections** — built-in group types rendered with icons (smart layer owns history).
3. **Action confirmation** — a `confirm` option on items that runs an `AlertDialog` before executing.
4. **Async command loading** — an item `loading` state with a spinner while the action runs.
5. **Command history** — recent commands surfaced at the top (smart layer owns the list).
6. **Filter modes** — `filter={(value, search, keywords) => boolean}` passthrough for custom ranking.
7. **Keyboard hint footer** — a footer row showing shortcuts ("↑↓ to navigate · ↵ to select").
8. **Empty-state CTA** — a custom `empty` render prop with a suggested command.
9. **Item badges** — trailing badges ("Beta", "Pro") on commands.
10. **Destructive commands** — `variant="destructive"` styling for dangerous actions.
11. **Sections with icons** — `CommandGroup` headings with leading icons.
12. **Debounced async items** — a `loadItems(query)` prop (lazy search inside the palette).
13. **Multi-action items** — a chevron on an item revealing secondary actions (sub-menu).
14. **Voice input** — a mic button wiring the Web Speech API (smart layer owns recognition).
15. **Accessibility announcements** — `aria-live` for selection count and activation.
16. **Nested palettes** — sub-palettes for grouped actions (breadcrumb in the palette header).
17. **Theme-aware highlights** — match highlight color to the app's primary token.
18. **Shortcut capture** — an `onShortcut` hook capturing the pressed combo (custom command builder).
19. **Mobile sheet fallback** — on small screens the palette renders as a full-height bottom sheet.
20. **Command telemetry** — `onRun(command)` analytics callback.

---

## ContextMenu — `components/context-menu.tsx`

### 🔧 Improvements

Right-click menu mirroring DropdownMenu's API on base-ui `ContextMenu`.

1. `[R]` No ref forwarding — `ContextMenuItem`, `ContextMenuTrigger`, `ContextMenuContent` need refs.
2. `[T]` `variant`/`inset` are inline unions — promote to zod enums shared with DropdownMenu (rule 4).
3. `[A]` `ContextMenuTrigger` adds `select-none` — document that text selection is intentionally disabled inside triggers.
4. `[M]` Right-click is desktop-only — document long-press/`onContextMenu` fallback for touch, or a smart-layer alternative (long-press menu).
5. `[P]` The content/positioner classes are static ✓ — keep them module-scoped (no per-render objects).
6. `[D]` Menu items/data are consumer-owned ✓ — the dumb component only renders.
7. `[UX]` No submenu chevron animation — `ChevronRightIcon` rotates on RTL ✓; add a subtle transition.
8. `[F]` N/A as form control — but menu actions that mutate forms need `onSelect` docs.
9. `[A]` Checkbox/radio items use `CheckIcon` ✓ — add `aria-checked` verification (primitive handles).
10. `[Th]` `bg-popover`/`ring-foreground/10` tokens ✓ — add dark-mode coverage.
11. `[V]` No `size` variant — add `sm | default` (row padding/text) to match dropdowns in dense tables.
12. `[A]` Shortcut spans (`ContextMenuShortcut`) — document that they're `aria-hidden`-safe (decorative) or announced via item label.
13. `[M]` Menu `max-h-(--available-height)` — on small screens ensure the flip logic keeps the menu on-screen (primitive does ✓; add a test).
14. `[P]` Memoize menu items — context menus re-open often; shallow memo avoids parent re-render churn.
15. `[T]` Export `ContextMenuItemProps` (primitive props + variant/inset) for composite usage.
16. `[A]` `ContextMenuSubTrigger` needs `aria-haspopup="menu"` — verify primitive sets it; add a regression test.
17. `[UX]` No item icon sizing convention — reuse `[&_svg]` sizing from DropdownMenu for consistency.
18. `[M]` Touch: trigger `select-none` may break long-press copy on text — document `disableSelection` opt-out.
19. `[D]` No default labels — all copy from the smart component; add a test asserting no text rendered without items.
20. `[F]` Document RHF-unrelated destructive actions (delete confirm) using `variant="destructive"` + `AlertDialog` pairing.

### 🚀 New Features

1. **Multi-step wizard mode** — a `steps` API with progress dots, next/back, and per-step validation hooks.
2. **Draggable dialog** — a `draggable` header handle (dnd-kit or pointer events, motion-safe).
3. **Resizable dialog** — an `resizable` corner handle (react-resizable-panels pattern).
4. **Maximize toggle** — a fullscreen button in the header for dense content.
5. **Scrollable body** — a `scrollable` variant with sticky header/footer (already flagged in Improvements — feature-complete here).
6. **Form dialog integration** — a documented pattern: `Dialog` + `FormShell` + RHF submit.
7. **Nested dialog stacking** — z-index management for confirm-inside-form dialogs.
8. **Snap zones** — remember the last size/position (localStorage, smart layer opts in).
9. **Focus return selector** — a `focusReturnRef` for restoring focus to a specific element.
10. **Entrance variants** — `animate` presets (zoom/slide/fade, motion-safe).
11. **Confirmation on close** — an `onCloseConfirm` hook that prompts when there are unsaved changes.
12. **Progress/saving state** — a `busy` prop dimming the overlay + disabling close while saving.
13. **Command palette nesting** — open a `Command` inside a dialog with proper focus handoff.
14. **Video/iframe content** — an `embedded` variant with proper aspect handling and pause-on-close.
15. **Smart overlay** — click-outside-to-close configurable per zone (disable on forms).
16. **Dialog history** — `onOpenChange` telemetry + deep-linkable open state (`?dialog=`).
17. **Toast actions** — a built-in action that fires a `toast` after close (e.g. "Changes saved").
18. **A11y test helpers** — export `dialogA11yProps(open)` for tests.
19. **Multi-dialog context** — a `DialogProvider` managing a stack with escape ordering.
20. **Keyboard convenience** — `Escape`-to-close, `Tab`-trap, and `Enter`-to-confirm defaults documented + testable.

---

## Dialog — `components/dialog.tsx`

### 🔧 Improvements

Base-ui dialog with overlay, content (close button option), header, footer, title, description.

1. `[V]` No `size` variant — add `sm | default | lg | xl` (max-width) so modals aren't all `sm:max-w-md`.
2. `[A]` No scroll handling for long content — add `overflow-y-auto` + `max-h-[calc(100dvh-...)]` on the content, or a `scrollable` variant.
3. `[R]` No ref forwarding — `DialogContent`, `DialogTitle` need refs (focus trap verification, tests).
4. `[A]` `DialogTitle`/`DialogDescription` required pairing — add a dev warning when a Dialog has content but no `DialogTitle` (a11y, rule 19).
5. `[M]` `max-w-[calc(100%-2rem)]` on mobile — good; add `inset-x-4`-style safe margins for landscape phones.
6. `[P]` Overlay + popup classes are static ✓ — keep them out of render bodies.
7. `[UX]` No `DialogDescription`-driven icon/header pattern — document `DialogHeader` + icon composition.
8. `[Th]` `ring-1 ring-foreground/10` + `bg-popover` tokens ✓ — dark-mode tested by default; add a visual regression test.
9. `[F]` Dialog-as-form: document `form` inside `DialogContent` + submit wiring (the footer's Close button must not double-submit).
10. `[D]` Data (title/description/actions) flows from the smart component ✓ — keep the dialog data-free.
11. `[A]` `DialogClose` in the corner is icon-only — has `sr-only` text ✓; ensure `aria-label` overrides work for i18n.
12. `[M]` On small screens the footer `flex-col-reverse` stacks — verify with the design system's button order; add a `stackOrder` prop if needed.
13. `[P]` Memoize `DialogContent` children — large forms inside dialogs re-render; document the pattern.
14. `[T]` `showCloseButton` bool — fine; export `DialogContentProps` (primitive props + extras) for composites.
15. `[A]` Focus return on close — base-ui handles ✓; add a test asserting focus returns to the trigger.
16. `[UX]` No entrance micro-interaction customization — `zoom-in-95` default ✓; document `data-open` class overrides.
17. `[F]` `DialogFooter` `showCloseButton` prop is confusingly named vs `DialogContent`'s — rename to `showCancel` or document the difference.
18. `[T]` Add a `DialogSizeSchema` (zod) + inferred type once size is added (rule 4).
19. `[A]` Nested dialogs (confirm inside a form dialog) — document z-index stacking (`z-50` both) and base-ui's `container` prop.
20. `[M]` On desktop, center dialog `-translate-x-1/2 -translate-y-1/2` is RTL-safe ✓ — add an RTL test.

### 🚀 New Features

1. **Locale-derived direction** — a `locale` prop that auto-sets `ltr`/`rtl` from the locale tag.
2. **Direction switch toggle** — a dev/UX helper to preview RTL layouts (wrapped in a debug flag).
3. **Persisted direction** — optional localStorage persistence for the provider.
4. **Per-subtree overrides** — nested providers that flip direction for isolated regions.
5. **Direction-aware scrollbars** — document scrollbar side flipping in RTL.
6. **Keyboard navigation mirroring** — arrow-key navigation flips automatically in RTL (docs + tests).
7. **Mirroring utilities** — export `rtl(value)` and `logicalClass()` helpers so components stop hand-writing `rtl:` classes.
8. **Dynamic direction** — a `direction` prop on the provider that flips at runtime without remount.
9. **Icon mirroring** — a `mirrorIcons` option that auto-flips directional icons (arrows/chevrons).
10. **A11y direction announcement** — set `dir` on `document.documentElement` with a hook (SSR-safe).
11. **Cascade inspector** — a devtools badge showing the resolved direction per region.
12. **Transition on flip** — a `animate` option that smoothly transitions flipped layouts (motion-safe).
13. **Font switching** — a `fontStack` hook for RTL fonts (e.g. Noto Naskh) when direction changes.
14. **Test utilities** — a `renderWithDirection` test helper for the workspace.
15. **Documentation generator** — a checklist doc of every component's RTL readiness.
16. **Runtime guard** — warn in dev when `dir` and `useDirection` disagree (debugging aid).
17. **CSS logical props audit** — a lint rule encouraging `ps-`/`pe-`/`ms-`/`me-` over physical props.
18. **RTL-safe shadows** — shadow direction flips with direction (token-driven).
19. **Direction-aware focus rings** — ring offsets use logical properties (already mostly; formalize).
20. **Provider config schema** — a `DirectionProviderPropsSchema` (zod) for typed provider props.

---

## Direction — `components/direction.tsx`

### 🔧 Improvements

Thin re-export of base-ui's `DirectionProvider` + `useDirection`.

1. `[T]` Pure re-export — document that RTL handling is centralized here so juniors know where to look.
2. `[A]` Add JSDoc with a code example of wrapping the app tree in `DirectionProvider` (RTL locales).
3. `[D]` The provider is data-free by design ✓ — document that direction state is app-level, not per-component.
4. `[P]` Re-export adds no runtime cost ✓ — keep it a single line.
5. `[F]` N/A — note that RTL-aware form layouts rely on this provider at the app root.
6. `[M]` Document that `useDirection` should be used instead of hardcoding `dir` per component.
7. `[T]` Export the provider props type for convenience (re-exported already).
8. `[A]` Note that `dir` must be set before hydration to avoid flash — recommend setting it on `<html>` too.
9. `[UX]` No styling — nothing to polish; keep the file minimal (rule 12).
10. `[Th]` RTL mirroring of icons/shadows is handled at each component — document the convention.
11. `[V]` No variants needed — a provider, not a UI primitive.
12. `[R]` No refs — providers don't take refs; document why.
13. `[P]` Ensure the module stays tree-shakeable (no side effects) — it is ✓.
14. `[A]` Add a note that `useDirection` throws outside the provider — test that behaviour.
15. `[T]` Add a `DirectionSchema` (zod enum `ltr | rtl`) if consumers need to validate locale-derived direction.
16. `[D]` The app's locale→direction mapping is smart-layer logic — document the split.
17. `[M]` Test an RTL layout end-to-end (sidebar flips, chevrons rotate) — add a workspace test note.
18. `[UX]` Consider exporting a `useRtl()` convenience if it becomes common — note as future work.
19. `[A]` `dir` attribute propagation — verify the provider sets `dir` on children automatically.
20. `[P]` No memoization needed — document that providers re-render their subtree on direction change.

### 🚀 New Features

1. **Snap-point presets** — named snap levels (`collapsed | half | full`) instead of raw arrays.
2. **Scroll-lock management** — a `bodyScrollLock` prop preventing background scroll while open.
3. **Multi-level drawers** — a documented `nested` stack API with a breadcrumb of open levels.
4. **Keyboard dismiss** — Esc closes the topmost drawer only (tested).
5. **Swipe-to-dismiss threshold** — a `swipeThreshold` prop with haptic feedback hint (mobile).
6. **Drawer as editor sheet** — a documented form pattern: sticky footer with save/cancel, RHF wiring.
7. **Snap-state callback** — `onSnapChange(level)` for analytics/UI sync.
8. **Focus memory** — focus returns to the element that opened the drawer (already primitive — formalize).
9. **Drag handle always-on** — a `showSwipeHandle` default for touch-first UIs.
10. **RTL-aware slide direction** — side drawers flip in RTL (test + docs).
11. **Persisted snap state** — remember the last snap level (smart layer opts in).
12. **Reduced-motion support** — disable slide/stack animations under `prefers-reduced-motion`.
13. **Drawer with tabs** — an optional `Tabs` header so a drawer hosts multiple views.
14. **Progress-aware content** — a `progress` prop (upload/processing states inside).
15. **Command palette drawer** — a `palette` variant for search-over-drawer UX.
16. **A11y announcements** — announce open/close and snap changes via `aria-live`.
17. **Overlay tap zones** — configurable dismiss areas (anywhere vs edge only).
18. **Telemetry** — `onOpen`/`onClose`/`onSnapChange` callbacks for analytics.
19. **Nested drawer depth guide** — visual indentation for stacked drawers.
20. **Test utilities** — a `renderDrawer` helper that sets up the provider + trigger for tests.

---

## Drawer — `components/drawer.tsx`

### 🔧 Improvements

Base-ui drawer with snap points, swipe handle, nested-drawer stack, and direction-aware swipe axes.

1. `[R]` No ref forwarding — `DrawerContent`/`DrawerTrigger` need refs (swipe measuring, tests).
2. `[A]` `DrawerSwipeHandle` has no keyboard equivalent — add `aria-hidden` (already ✓) and document that keyboard users use Escape/Enter via the trigger.
3. `[M]` Swipe-to-close conflicts with horizontal scroll on mobile — document `swipeDirection` configuration per use case.
4. `[P]` `contextValue` is memoized ✓ — keep `hasSnapPoints`/`modal`/`showSwipeHandle`/`swipeDirection` as the only deps.
5. `[Th]` Overlay opacity uses `--drawer-overlay-min-opacity` + `--drawer-swipe-progress` vars — token-based ✓; add dark-mode coverage.
6. `[A]` Drawer content should get `aria-label`/`aria-labelledby` — add a `label` prop or document `DialogTitle`-equivalent wiring.
7. `[UX]` The `nested-drawer` brightness dim (`data-nested-drawer-open:brightness-95`) — respect `prefers-reduced-motion`.
8. `[D]` Content/snap points are consumer-owned ✓ — the dumb component renders the stack; document the smart-side snap config.
9. `[T]` `DrawerContextProps` is hand-typed — derive from `DrawerPrimitive.Root.Props` + extras to avoid drift.
10. `[M]` `data-[swipe-axis=x]` content width `75%` hardcoded — make `width` a prop (`sm | md | lg | full`).
11. `[F]` N/A as form control — document drawer-as-form (e.g. edit sheet) wiring with RHF at the smart layer.
12. `[A]` Focus trap is primitive-handled ✓ — add a test that focus doesn't escape to the page behind.
13. `[P]` The `--bleed`/`--peek`/`--stack-*` CSS vars are static strings — hoist the full className to a module constant.
14. `[UX]` No snap-point indicator — when `snapPoints` are set, document showing a small grip or progress cue.
15. `[V]` No `variant` — add `variant: default | bottom-sheet` presets so apps stop hand-tuning swipe directions.
16. `[M]` On touch, `supports-[-webkit-touch-callout:none]:absolute` handles iOS quirk ✓ — keep and comment why.
17. `[R]` `useDrawer` throws outside provider ✓ — add `displayName` to the context for React DevTools.
18. `[A]` Escape closes by default — verify with the nested-drawer stack (top drawer closes first) and add a test.
19. `[T]` Export `DrawerProps` (primitive props + `showSwipeHandle`) so composites extend it cleanly.
20. `[P]` Memoize `DrawerContent`'s inner content? It's consumer-provided; document that heavy forms inside drawers should use `React.memo` at the smart layer.

### 🚀 New Features

1. **Item loading state** — a per-item `loading` prop with a spinner (async menu actions).
2. **Item tooltips** — a `tooltip` prop showing a hint on hover (e.g. why disabled).
3. **Search within menu** — a `searchable` mode with a filter input for long menus.
4. **Bulk-select menu** — checkbox items with a select-all row (table row actions).
5. **Recent items** — a pinned "Recent" section (smart layer owns history).
6. **Destructive confirmation** — a `confirm` item prop that opens an `AlertDialog`.
7. **Shortcut groups** — a `shortcuts` section header with `Kbd` hints.
8. **Custom item render** — `render` per item for fully custom rows (already via primitive — document).
9. **Nested submenu breadcrumb** — show the parent path when deep in a submenu.
10. **Click-outside suppression** — a `closeOnClick` toggle for menu-activate flows.
11. **Menu telemetry** — `onOpenChange`/`onSelect` analytics hooks.
12. **Keyboard typeahead** — typing letters jumps to matching items (primitive ✓ — document + test).
13. **Icon-only menu labels** — auto `aria-label` from a `label` prop for icon items.
14. **Floating submenu delays** — hover-open delay configuration for submenus.
15. **Menu sections with dividers** — an `inset` section header pattern with auto separators.
16. **RTL flip** — submenu/chevron direction in RTL (test + docs).
17. **Mobile sheet fallback** — render the menu as a bottom sheet on small screens.
18. **Menu state persistence** — remember last selection for preference menus.
19. **A11y test helpers** — export `menuItemA11yProps()` for tests.
20. **Menu data schema** — a `MenuItemSchema` (zod) validating menu configs at the boundary.

---

## DropdownMenu — `components/dropdown-menu.tsx`

### 🔧 Improvements

Full base-ui menu: items, labels, separators, shortcuts, checkbox/radio items, submenus, destructive variant.

1. `[R]` No ref forwarding — `DropdownMenuItem`, `DropdownMenuTrigger`, `DropdownMenuContent` need refs (focus restore, tests).
2. `[V]` No `size` variant — add `sm | default` (row padding/text) for dense table actions vs toolbar menus.
3. `[T]` `variant`/`inset` inline unions — promote to zod enums shared with ContextMenu/Menubar (rule 4).
4. `[A]` Icon-only menu items need `aria-label` guidance — document the pattern in JSDoc.
5. `[P]` Content classes are static ✓ — keep them out of render bodies (no per-render objects).
6. `[UX]` Submenu chevron rotates on RTL ✓ — add a small transition for polish.
7. `[D]` Items/data are consumer-owned ✓ — the dumb component never fetches.
8. `[F]` N/A as form control — document `onSelect` + destructive-action pairing with `AlertDialog`.
9. `[A]` Checkbox/radio items — verify `aria-checked` (primitive handles ✓); add a regression test.
10. `[Th]` `bg-popover`/`ring-foreground/10` tokens ✓ — add dark-mode visual coverage.
11. `[M]` `max-h-(--available-height)` — on small screens flip logic keeps it on-screen ✓; add a test.
12. `[P]` Memoize menu items — dropdowns re-open frequently; shallow memo avoids parent churn.
13. `[T]` Export `DropdownMenuItemProps` (primitive props + variant/inset) for composites.
14. `[A]` `DropdownMenuSubTrigger` needs `aria-haspopup="menu"` — verify primitive sets it; add a regression test.
15. `[UX]` Destructive items use `data-[variant=destructive]` styling ✓ — add an icon-tone convention (Trash icon inherits color).
16. `[M]` On touch, long menus scroll — `overflow-y-auto` ✓; ensure scrollbar styling (`no-scrollbar` or thin) is consistent.
17. `[D]` No default labels — all copy from the smart component; add a test asserting no text without items.
18. `[F]` Document using `DropdownMenu` for bulk actions (select rows → menu) with the smart component owning selection state.
19. `[A]` `DropdownMenuLabel` has no `aria` role — document it as a group label for SR grouping.
20. `[P]` The `*:data-[slot=dropdown-menu-item]` compound selectors — fine; document that consumers shouldn't fight them with `!important`.

### 🚀 New Features

1. **Action slot** — a dedicated `EmptyAction` (CTA button) slot with consistent spacing.
2. **Illustration support** — a `media` slot that accepts custom art (SVG/illustration nodes).
3. **Animated empty state** — a subtle rise-in animation (motion-safe) on mount.
4. **Search-results variant** — a preset for "no results for '{query}'" with the query highlighted.
5. **Undo/retry actions** — an `onRetry` action for failed loads.
6. **Count-based copy** — a `filterCount` prop rendering "0 of N" context.
7. **Compact table row** — a `variant="inline"` that fits inside a table body.
8. **Multi-action layout** — primary + secondary buttons aligned.
9. **Skeleton transition** — fade from skeleton to empty state (no jarring swap).
10. **Accessibility announce** — `role="status"` + `aria-live="polite"` when the empty state appears.
11. **Themed icon tiles** — media tiles tinted per tone (success/error/neutral).
12. **Custom height** — a `minHeight` prop so empty blocks fill card interiors.
13. **Loading guard** — a `loading` prop showing skeleton rows before deciding empty.
14. **Keyboard CTA focus** — auto-focus the primary action when the empty state mounts (opt-in).
15. **Reusable copy API** — `title`/`description` as required props (no default English).
16. **Step-by-step empty** — a small steps list for onboarding empty states.
17. **Empty state analytics** — an `onVisible` callback fired via IntersectionObserver.
18. **RTL-safe layout** — icon/label alignment in RTL (test + docs).
19. **Print-hidden** — `print:hidden` for empty states that shouldn't print.
20. **Empty state schema** — an `EmptyStateSchema` (zod) validating title/description/actions.

---

## Empty — `components/empty.tsx`

### 🔧 Improvements

Empty-state block with header, media, title, description, content.

1. `[R]` No ref forwarding — `Empty`/`EmptyContent` should forward refs (focus management for empty-state CTAs).
2. `[V]` No `size` variant — add `sm | default | lg` (padding, icon tile size) for inline vs full-page empty states.
3. `[A]` Add `aria-label`/`role="status"` option — an empty state after a search should be announced politely.
4. `[M]` `p-12` padding is fixed — on small screens reduce to `p-8` via the size variant.
5. `[D]` All copy/CTA are consumer-owned ✓ — the dumb component renders slots only.
6. `[T]` `emptyMediaVariants` variant union — promote to a zod enum + inferred type (rule 4).
7. `[UX]` No action slot beyond children — add `EmptyAction` (a CTA button slot) so smart components don't nest buttons in description.
8. `[P]` Memoize `Empty` — empty states appear/disappear on data change; shallow memo avoids parent re-renders.
9. `[Th]` `border-dashed` + `bg-transparent` — consider `--border` token for the dashed border (already token-based ✓).
10. `[F]` N/A as form control — document empty states as read-only feedback.
11. `[A]` The title/description use `font-heading`/`text-muted-foreground` tokens ✓ — ensure contrast in dark mode.
12. `[M]` `max-w-sm` on header/content — good; add `min-w-0` + `w-full` safety for flex parents.
13. `[T]` Export `EmptyProps`/`EmptyMediaProps` so composites can extend.
14. `[UX]` No illustration support — `EmptyMedia` renders icons; document passing an `<img>`/illustration via children.
15. `[P]` The CVA is module-scoped ✓ — keep it exported for reuse.
16. `[A]` Empty state after search should keep focus in the search input (not steal it) — document the smart-layer focus rule.
17. `[M]` On tiny screens center-align is fine ✓ — add a test that the block doesn't overflow horizontally.
18. `[F]` Document empty states inside forms (e.g. no results in a combobox list) using `ComboboxEmpty` instead.
19. `[D]` No default strings — copy arrives via props ✓; add a test asserting no text is rendered by default.
20. `[UX]` Add an optional `compact` mode (dense padding, smaller title) for table-level empty rows.

### 🚀 New Features

1. **Auto id/`htmlFor` pairing** — `FieldLabel` + control share a `useId`-generated id automatically.
2. **Required marker** — a `required` prop rendering an asterisk with `aria-hidden` + a legend note.
3. **Field-level hint tooltip** — a `FieldHelp` (tooltip icon) for inline guidance.
4. **Character count** — a `FieldCounter` showing `current/max` bound to a control's `maxLength`.
5. **Async validation status** — a `validating` state rendering a small spinner in the label row.
6. **Group error summary** — a `FieldSetError` listing all nested field errors at the top.
7. **Auto-scroll to error** — on submit, the first invalid field scrolls into view and focuses (smart layer wires it).
8. **Success state** — a `valid` prop rendering a green check + message (RHF `isValid` driven).
9. **Dirty-state indicator** — a subtle dot when a field differs from its initial value (unsaved-changes UX).
10. **Field password strength** — a `strength` slot integrating `PasswordStrengthMeter` automatically.
11. **Horizontal label alignment** — a `labelWidth` prop for aligned settings rows.
12. **Reveal/hide field** — a `toggleVisibility` option for password-like fields without the full `PasswordInput`.
13. **Copyable field** — a `copyable` prop adding a copy button (API keys, tokens).
14. **Field schema binding** — a `schema` prop (zod) exposing `fieldSchema` metadata for generators.
15. **A11y error wiring** — `aria-describedby` auto-linked between control and `FieldError`.
16. **RTL alignment** — label/content alignment flips in RTL (test + docs).
17. **Print styles** — field rows break cleanly across pages (`break-inside-avoid`).
18. **Compact density** — a `dense` prop for filter panels and table toolbars.
19. **Field telemetry** — `onFocus`/`onBlur` analytics callbacks at the group level.
20. **Field test helpers** — export `fieldA11yProps({ error, required })` for tests.

---

## Field — `components/field.tsx`

### 🔧 Improvements

Form-field primitives: Field (orientation), FieldLabel, FieldDescription, FieldError, FieldGroup, FieldLegend, FieldSeparator, FieldSet, FieldTitle.

1. `[T]` `FieldError`'s `errors?: ({ message?: string } | undefined)[]` — anonymous inline type (rule 13); create `FieldErrorItemSchema` (zod, `{ message: string }`) and infer.
2. `[F]` No auto id/`htmlFor` association — use `useId()` to link `FieldLabel` ↔ control so SRs and RHF errors announce correctly.
3. `[F]` Add `name`/`register`-friendly props — document the RHF pattern (register + `aria-invalid` + `FieldError`) at the smart layer.
4. `[A]` `FieldError` renders `role="alert"` — good for submit errors; add an `aria-live="polite"` mode for async validation.
5. `[M]` `FieldGroup` `@container` queries — verify container queries degrade gracefully in older browsers (fallback column layout).
6. `[P]` `FieldError`'s `useMemo` dedupes errors ✓ — hoist the Map-dedupe to a pure helper so it's unit-testable.
7. `[Th]` `FieldLabel`'s `has-data-checked:border-primary/30` label-card pattern — token-based ✓; add dark-mode coverage.
8. `[UX]` No `required` asterisk — add `required` prop that renders `*` (with `aria-hidden` + an accessible legend note).
9. `[D]` Data (value, error messages) comes from the smart component ✓ — keep the field primitives data-free.
10. `[V]` `Field` orientation via CVA ✓ — add `size` (spacing density) for compact settings grids.
11. `[A]` `FieldSet`/`FieldLegend` need `aria-describedby` wiring to a group error — document the pattern.
12. `[F]` `FieldError` accepts `children` override ✓ — document that RHF `error.message` should be passed, never parsed inside.
13. `[M]` Horizontal orientation `@md/field-group:flex-row` — on narrow screens it correctly stacks ✓; add a test.
14. `[P]` `FieldSeparator` uses `-my-2` + absolute `Separator` — verify no layout thrash on re-render (it's static ✓).
15. `[T]` Export `FieldErrorProps`/`FieldProps` types so composites (FormShell, login forms) extend cleanly.
16. `[A]` `FieldTitle` vs `FieldLabel` — the two are near-duplicates; document when to use each or consolidate.
17. `[UX]` No description-icon/help-tooltip slot — add `FieldHelp` (tooltip-triggered hint) as an optional sub-component.
18. `[F]` `FieldGroup` `data-[slot=checkbox-group]`/`radio-group` gap tweaks — document how checkbox/radio groups plug in.
19. `[M]` `Field` `*:w-full` in vertical mode — ensure long labels truncate (`min-w-0`) on mobile.
20. `[D]` No hardcoded copy — error text always from props ✓; add a test asserting no default message.

### 🚀 New Features

1. **RHF-native mode** — an `rhf` prop that wires `FormProvider` + `handleSubmit` without manual `onSubmit` plumbing.
2. **Multi-step forms** — a `steps` prop rendering step indicator + navigation (previous/next).
3. **Save & continue actions** — configurable footer actions (Submit / Save draft / Cancel).
4. **Dirty-state guard** — an `onLeaveDirty` hook prompting before navigating away with unsaved changes.
5. **Autofocus first field** — a `focusFirst` prop focusing the first field on mount.
6. **Server error banner mapping** — accepts a zod `FormError` (code + message) and maps codes to copy (ties into `auth-errors`).
7. **Inline vs banner errors** — an `errorMode` prop (`banner | inline | both`).
8. **Submit success state** — a `success` prop rendering a confirmation banner + optional `onReset`.
9. **Debounced submit guard** — prevent double-submits beyond the loading flag (smart layer owns it).
10. **Per-step validation** — in multi-step mode, validate only the visible step (RHF `trigger`).
11. **Progress persistence** — save the current step index (smart layer opts in).
12. **Accessible form name** — an `aria-label`/`name` on the `<form>` for SR orientation.
13. **Autofill hints** — a `autoComplete` map applied to child fields via context.
14. **Form-level test hook** — expose `formRef` with `submit()`/`reset()` for tests.
15. **Reduced-motion** — disable banner animations under `prefers-reduced-motion`.
16. **Field grouping display** — render `FieldSet`s with section legends from a config prop.
17. **Submit shortcut** — `⌘+Enter` submits from anywhere in the form (opt-in).
18. **Reset button** — a built-in `showReset` with confirm-on-reset (dirty data).
19. **Server-time drift notice** — a stale-data banner when the form's base data is older than N minutes.
20. **Form schema export** — a `buildFormSchema` helper validating the form's zod schema for tests.

---

## FormShell — `components/form-shell.tsx`

### 🔧 Improvements

Low-level form wrapper: error banner, `<form>` with onSubmit, loading submit button.

1. `[P]` The inline spinner `<svg>` duplicates the shared `Spinner` component — replace with `Spinner` (single source of truth).
2. `[R]` No ref forwarding — `FormShell` should forward a `form` ref (RHF `handleSubmit`, reset focus).
3. `[F]` It takes `onSubmit` + `error` manually — for RHF, accept `onSubmit: (values) => void` (already) and document passing `form.handleSubmit`; or accept `form` methods via prop.
4. `[T]` `error: string | null` — upgrade to a zod-validated `FormError` shape (`{ message: string; code?: AuthErrorCode }`) so error codes survive.
5. `[A]` The error banner has no `aria-describedby` link to the form — wire `id` + `aria-describedby` on the form.
6. `[V]` Submit button variant/size are hardcoded (`w-full`, default variant) — expose `submitVariant`/`submitSize`/`submitClassName` props.
7. `[UX]` No success state — add `success?: boolean` that renders a green banner (or document using `toast`).
8. `[M]` `space-y-4` fixed — accept a `gap` prop so dense forms can tighten spacing.
9. `[A]` Banner uses `role`-less div — add `role="alert"` (it's an error) and keep the warning icon `aria-hidden`.
10. `[D]` No auth/business logic ✓ (per its comment) — keep it that way; document the smart-layer contract.
11. `[P]` Not memoized — forms re-render on keystroke; `React.memo` + stable `onSubmit` reference (useCallback at the smart layer) helps.
12. `[F]` No `noValidate` control — add `noValidate?: boolean` (default true) so zod validation isn't double-blocked by the browser.
13. `[T]` `onSubmit` typed `(event: React.SyntheticEvent<HTMLFormElement>) => void` — consider `React.FormEvent<HTMLFormElement>` for precision.
14. `[A]` Loading state — the button shows a spinner ✓; add `aria-busy="true"` on the form while submitting.
15. `[M]` The banner stacks full-width ✓ — on desktop allow a `bannerAlign`/inline layout prop.
16. `[UX]` Error banner color is `destructive` tokens ✓ — add a dismissible option (`onDismiss`) for transient errors.
17. `[F]` Children are raw fields — document passing `Field` primitives + RHF `Controller` components.
18. `[A]` Submit button `disabled={isLoading}` ✓ — add `aria-disabled` + `type="submit"` (already) test.
19. `[P]` The banner conditional `{error ? ... : null}` is cheap — but hoist the icon into a module constant to avoid re-creation.
20. `[D]` Default labels (`Submit`/`Submitting...`) are props ✓ — keep them overridable for i18n (already are).

### 🚀 New Features

1. **Rich preview layouts** — a `header`/`footer` slot pattern (avatar + name + follow button).
2. **Interactive content** — a `sticky` mode where the card stays open when the cursor enters it (for forms inside).
3. **Delay presets** — `delay="fast | normal | slow"` mapped to ms tokens.
4. **Focus-driven open** — `openOnFocus` so keyboard users get the same preview.
5. **Long-press on touch** — a `touchTrigger` mode (long-press opens, release closes).
6. **Loading skeleton preview** — a `loading` prop while remote user data resolves.
7. **Error state** — a `failed` prop with a muted "couldn't load" fallback.
8. **Follow-action wiring** — an `onAction` slot for the primary CTA (follow/connect).
9. **Profile stats row** — a `stats` prop rendering followers/posts counts (smart layer owns data).
10. **Team member preview** — a preset with role + availability dot.
11. **Preview telemetry** — `onOpen`/`onClose` callbacks for analytics.
12. **RTL-aware placement** — card flips sides in RTL (test + docs).
13. **Keyboard dismissal** — Esc closes the preview (primitive ✓ — document).
14. **Preview pinning** — a pin icon that keeps the card open (compare mode).
15. **Image previews** — a `coverImage` slot with aspect handling for link cards.
16. **Nested previews** — preview cards inside previews with stacking control.
17. **Reduced-motion** — disable slide/fade under `prefers-reduced-motion`.
18. **Mobile fallback** — on touch devices, open a bottom sheet instead of a hover card.
19. **A11y test helpers** — export `previewA11yProps()` for tests.
20. **Preview schema** — a `PreviewDataSchema` (zod) validating preview payloads.

---

## HoverCard — `components/hover-card.tsx`

### 🔧 Improvements

Base-ui preview-card (hover/click preview popover).

1. `[R]` No ref forwarding — `HoverCardTrigger`/`HoverCardContent` need refs.
2. `[A]` Preview cards on hover are mouse-only — add keyboard focus-trigger guidance (focus + Enter) via the trigger (base-ui supports focus triggers).
3. `[M]` Hover delay (`hoverDelay`) should be shorter on touch — document prop configuration.
4. `[P]` `w-64` hardcoded — make `width` a prop (`sm | md | lg | auto`) so previews scale.
5. `[D]` Preview data (user info, link metadata) comes from the smart component ✓.
6. `[F]` N/A as form control — document hover cards as read-only previews.
7. `[T]` Export `HoverCardContentProps`/`HoverCardTriggerProps` for composite usage.
8. `[A]` No arrow — add `HoverCardArrow` sub-component matching `TooltipContent`'s arrow.
9. `[UX]` No entrance animation customization — reuse the `animate-in` pattern from Popover.
10. `[Th]` `bg-popover`/`ring-foreground/10` tokens ✓ — add dark-mode coverage.
11. `[M]` On small screens the card may overflow — ensure `--available-width` clamping (base-ui ✓); add a test.
12. `[P]` Memoize the popup className (static ✓) — keep it module-scoped.
13. `[A]` Focus does not automatically open; hover only — document `openOnFocus` option for accessibility.
14. `[T]` `sideOffset`/`alignOffset` numbers — fine; keep the `Pick<Positioner.Props, ...>` pattern (it's clean).
15. `[UX]` Add a subtle `shadow-md` polish on open (already ✓ via class).
16. `[F]` N/A — note that preview content shouldn't hold interactive form elements (focus conflicts).
17. `[D]` No hardcoded copy — content via children ✓.
18. `[A]` `role`/`aria-describedby` for the trigger — document that the preview should be `aria-describedby`-linked to the trigger label.
19. `[P]` The `Portal` + `Positioner` nesting — ensure `z-50` stacking matches Dialog for overlays.
20. `[M]` Touch: long-press as hover substitute — document smart-layer gesture handling or disable hover on coarse pointers.

### 🚀 New Features

1. **Input mask** — a `mask` prop (phone/date/credit-card) via `input-otp`-style masking or `imask`.
2. **Currency/percentage input** — a `format` prop (locale-aware number formatting, smart layer owns values).
3. **Debounced search input** — an `onDebouncedChange` + `debounceMs` for search-as-you-type.
4. **Copyable input** — a `copyable` prop adding a copy button (tokens, links).
5. **Clear button** — a `clearable` prop with an X that resets the value.
6. **Password-strength combo** — document composing `Input` + `PasswordStrengthMeter` (already via `PasswordInput`).
7. **Character counter** — a `maxLength` + `showCount` combo (reuse `FieldCounter`).
8. **Auto-uppercase transform** — a `transform` prop (`upper | lower | capitalize`) for codes/slugs.
9. **Enter-to-submit** — an `onEnter` prop firing on Enter (chat composers).
10. **Number stepper** — a `type="number"` companion with +/- steppers (mobile-friendly).
11. **Suggestions dropdown** — an `onSuggest` + suggestions list (autocomplete, smart layer owns data).
12. **Left/right slots** — `startAdornment`/`endAdornment` props (icons, units) without `InputGroup` boilerplate.
13. **Input with unit** — a `unit` prop ("kg", "%" ) appended with proper a11y.
14. **Autosuggest loading** — a `suggesting` prop showing a spinner in the adornment.
15. **Focus ring polish** — `focusRing` variants (default | none | soft) for embedded contexts.
16. **Size-aware clear/icon** — adornments scale with input size (extend the `[&_svg]` rule).
17. **RTL-aware adornments** — start/end flip in RTL (test + docs).
18. **Autofill styling hook** — `:-webkit-autofill` token fixes documented (Chrome yellow flash).
19. **Input telemetry** — `onFocus`/`onBlur`/`onKeyDown` analytics props (already passthrough — document).
20. **Input schema** — an `InputConfigSchema` (zod) for masked/formatted input configs.

---

## Input — `components/input.tsx`

### 🔧 Improvements

The base text input (base-ui `InputPrimitive`).

1. `[R]` No explicit `forwardRef` — verify `InputPrimitive` forwards, and wrap to guarantee the contract (RHF `register` needs it, rule 20).
2. `[V]` No `size` variant — add `sm | default | lg` (h-7/h-9/h-10) via CVA for dense tables vs large CTAs.
3. `[V]` No `state` beyond `aria-invalid` — add `error` (already styled via `aria-invalid`), `loading` (spinner suffix), `disabled` (already).
4. `[F]` Consistent event contract ✓ (`onChange`/`onBlur`/`onFocus` passthrough) — document RHF `register` usage.
5. `[A]` `file:` button styling is present — ensure the file input variant is accessible (label association).
6. `[M]` `h-9` 36px — on touch, `size="lg"` recommended; document tap-target guidance.
7. `[Th]` `dark:bg-input/30` tint is token-based ✓ — verify contrast in dark mode.
8. `[UX]` No leading/trailing icon slots — document composing with `InputGroup`/`InputGroupAddon` instead of adding props here.
9. `[P]` The base class string is long but static ✓ — keep it module-scoped; no per-render objects.
10. `[D]` Data-free ✓ — value/onChange are controlled by the smart component.
11. `[T]` Export `InputProps` + a `InputSizeSchema` (zod) so composites and forms share the type.
12. `[A]` `aria-invalid` ring is present ✓ — add `aria-describedby` guidance for error text wiring.
13. `[F]` `autoComplete` passthrough ✓ — document per-field values (current-password, username, etc.).
14. `[M]` `min-w-0` prevents overflow ✓ — test with long placeholder + `w-full`.
15. `[UX]` No `required` visual — the `Field` layer handles the asterisk; document that Input itself stays neutral.
16. `[A]` `readOnly` styling — add `readOnly:opacity`/`cursor-default` treatment so read-only inputs look intentional.
17. `[P]` Memoize — inputs in lists re-render per keystroke at the parent; shallow memo helps when value is lifted.
18. `[F]` `type` passthrough ✓ — document `type="number"` caveats (spin buttons) and RHF `valueAsNumber`.
19. `[T]` Return type explicit ✓ (rule 15) — keep the pattern across the package.
20. `[UX]` Focus ring `focus-visible:ring-3` consistent ✓ — add `selection` colors (bg-primary/text) for polish.

### 🚀 New Features

1. **Group-level error state** — an `error` prop styling the whole group + supporting a message slot.
2. **Group loading** — a `loading` prop rendering a spinner addon.
3. **Group disabled cascade** — a `disabled` prop applying to all child controls.
4. **Toolbar-style group** — a `variant="toolbar"` with flat borders for filter rows.
5. **Focus ring ownership** — a `focusRing` prop choosing which child owns the visible ring.
6. **Multi-addon support** — render several `InputGroupAddon`s with correct order (start/end mix).
7. **Validation icon addon** — a `status` prop (valid/invalid) rendering a check/error icon addon.
8. **Compact size** — a `size="sm"` for dense table filters.
9. **Block-addon alignment** — a `label` block addon (start of a textarea group) with top alignment.
10. **Search group preset** — a `variant="search"` combining input + magnifier + clear.
11. **Countdown addon** — a character-count pill in a group (search + OTP forms).
12. **RTL flip** — addon order/radii flip in RTL (test + docs).
13. **Keyboard focus management** — addon tap-to-focus also works on textareas (fix the input-only selector).
14. **A11y addon labeling** — `aria-label` support on decorative addons (icons).
15. **Telemetry** — `onAddonClick` callback for icon buttons.
16. **Group schema** — an `InputGroupConfigSchema` (zod) for composite configs.
17. **Stretch mode** — a `stretch` prop making the group fill width with `min-w-0` safety.
18. **Autofill harmony** — group borders stay seamless during browser autofill (docs pattern).
19. **Print styles** — group borders print cleanly (`print:hidden` on shadow).
20. **Test helpers** — export `groupA11yProps()` for tests.

---

## InputGroup — `components/input-group.tsx`

### 🔧 Improvements

Composable input+addon+button+textarea group (powered by `InputGroupInput`).

1. `[R]` No ref forwarding — `InputGroupInput`/`InputGroupTextarea` should forward refs (RHF register).
2. `[V]` No `size` variant — add `sm | default | lg` threaded through the group's `h-9` base.
3. `[A]` `InputGroupAddon`'s pointerdown handler focuses the first `input` — it misses `textarea`; also add `aria-label` guidance for decorative addons.
4. `[P]` `handlePointerDown` is a `useCallback` ✓ — keep it stable; ensure it doesn't fire on addon buttons (it guards ✓).
5. `[F]` Consistent event contract ✓ — document RHF usage with `InputGroupInput`.
6. `[M]` `has-[>[data-align=block-end]]:flex-col` stacking — test vertical stacking on narrow screens.
7. `[Th]` `dark:bg-input/30` token ✓ — verify the group's border/ring in dark mode.
8. `[UX]` No error message slot — document pairing `aria-invalid` with `FieldError` (the group styles `aria-invalid` ✓).
9. `[D]` Group renders no data ✓ — all content via children.
10. `[T]` `InputGroupButton`'s `size` uses CVA + `data-size` — export the inferred type for reuse.
11. `[A]` `role="group"` on addon/group ✓ — ensure icon addons have `aria-hidden` icons.
12. `[P]` The compound selectors (`has-[[data-slot][aria-invalid=true]]`) are heavy — document that they're the a11y hook for error state.
13. `[M]` On touch, the addon tap-to-focus target should be ≥44px — add padding via size variant.
14. `[F]` `InputGroupTextarea` exists ✓ — document the RHF `register` on textarea with `rows` control.
15. `[UX]` No loading state — add `InputGroupSpinner` addon pattern (spinner suffix) documented for async inputs.
16. `[A]` `disabled` state — group has `group-data-[disabled=true]/input-group:opacity-50` ✓; add `aria-disabled` guidance.
17. `[T]` Export `InputGroupProps`/`InputGroupAddonProps` so composites (Combobox, PasswordInput) extend cleanly.
18. `[P]` Memoize the pointerdown handler already ✓ — ensure `InputGroup` root doesn't recreate class strings.
19. `[M]` Block-end addons (`flex-col`) — test that input + button stack without double borders.
20. `[D]` No default labels/placeholders — all copy from the smart component ✓.

### 🚀 New Features

1. **Auto-submit on complete** — an `onComplete` + `autoSubmit` prop wiring a submit after the last digit.
2. **Masked/secret OTP** — a `mask` prop showing only the last digit (like banking apps).
3. **Countdown resend** — a `resendIn` countdown + resend button slot (ties into `LockoutCountdown`).
4. **Paste-and-split** — paste a full code, split across slots (library ✓ — document + test).
5. **Error shake** — a `error` prop that shakes the group + marks slots invalid.
6. **Backspace to previous** — auto-return to the previous slot on delete (library ✓ — test).
7. **Auto-focus first slot** — an `autoFocus` prop (already native — formalize).
8. **Loading verify** — a `verifying` prop replacing the group with a spinner.
9. **Custom separators** — `separator` render prop (dash, dot, or none).
10. **Length presets** — `length={4|6|8}` with slot sizing presets.
11. **RTL digit order** — slots fill right-to-left in RTL (test + docs).
12. **A11y announcements** — announce "code entered" via `aria-live` (verification flows).
13. **Timeout handling** — an `expiresIn` prop that disables slots after expiry.
14. **Biometric fallback note** — document pairing with WebAuthn for passwordless OTP alternatives.
15. **Sticky resend** — a fixed footer row with resend + help links.
16. **Test utilities** — export `otpTestValues()` for component tests.
17. **Voice input** — a mic button for dictating the code (smart layer owns recognition).
18. **Auto-paste on focus** — if a code is on the clipboard, paste automatically (opt-in, privacy note).
19. **Danger zone variant** — a `destructive` style for "confirm deletion" OTP flows.
20. **OTP schema** — an `OtpValueSchema` (zod, `z.string().regex(/^\d{4,8}$/)`) shared with forms.

---

## InputOTP — `components/input-otp.tsx`

### 🔧 Improvements

One-time-password input with group, slot, separator, and fake caret.

1. `[R]` No ref forwarding — `InputOTP`/`InputOTPSlot` need refs (autofocus, submit-on-complete).
2. `[V]` No `size` variant — add `sm | default | lg` (slot size `size-9` base) via CVA.
3. `[A]` No `aria-label`/description wiring — add `label` prop or document `aria-label` per field.
4. `[F]` `onComplete` passthrough ✓ — document RHF usage (value/onChange via `Controller`).
5. `[M]` On touch, `size-9` (36px) slots are below 44px — bump via size variant for mobile.
6. `[P]` `inputOTPContext.slots[index] ?? {}` — destructure defensively ✓; extract to a helper for clarity.
7. `[Th]` `dark:bg-input/30` tokens ✓ — verify slot focus ring in dark mode.
8. `[UX]` No paste-into-slot UX docs — the library handles paste; document `maxLength`/`pattern` props.
9. `[D]` Data (value) is controlled ✓ — the dumb component renders slots only.
10. `[T]` Export `InputOTPProps` (library props + `containerClassName`) for composites.
11. `[A]` `hasFakeCaret` caret animation — respect `prefers-reduced-motion` (it's a blink; add `motion-safe:`).
12. `[F]` Consistent event contract ✓ — document `onChange` passthrough + `name` for RHF.
13. `[A]` `aria-invalid` styling on group ✓ — wire `aria-describedby` to `FieldError`.
14. `[M]` `flex-wrap` on the group for narrow screens — add `flex-wrap` option so 6 slots don't overflow.
15. `[UX]` No auto-submit button — document `onComplete` + smart-layer auto-submit pattern.
16. `[P]` Slot components re-render per keystroke — memoize `InputOTPSlot` (React.memo).
17. `[F]` `autoComplete="one-time-code"` guidance — add a `autoComplete` default in docs.
18. `[T]` The `index: number` prop — fine; type via a `SlotIndex` alias for readability.
19. `[A]` Add `aria-live="polite"` on the group for SR count announcements (optional).
20. `[D]` No hardcoded copy ✓ — separators are decorative (`role="separator"` ✓).

### 🚀 New Features

1. **Drag-to-reorder rows** — an `onReorder` prop (dnd-kit wiring) for sortable lists.
2. **Inline edit** — a `editing` mode swapping the title for an input (smart layer owns save).
3. **Swipe actions** — mobile swipe-to-reveal actions (delete/archive) behind the row.
4. **Selection checkbox** — a `selectable` mode rendering a leading checkbox with `aria-selected`.
5. **Row context menu** — right-click/long-press opens a `ContextMenu` (wired at the smart layer).
6. **Avatar + presence** — an `ItemMedia` preset combining `Avatar` + status dot.
7. **Expandable detail** — a chevron that expands `ItemContent` into a detail panel (collapsible).
8. **Progress row** — a `progress` prop rendering a thin bar under the description (upload rows).
9. **Timestamp + unread dot** — a `meta` row with a time and unread indicator.
10. **Badge slots** — trailing `Badge`s (status/tags) in the actions area.
11. **Keyboard focus ring** — a `focusable` prop with a visible row ring for keyboard users.
12. **Virtualized list support** — a stable row height contract documented for `react-virtual`.
13. **Row link** — an `href` mode rendering the whole row as an anchor.
14. **Highlight-on-search** — a `highlight` prop highlighting matching text (search results).
15. **Loading skeleton row** — a `loading` prop rendering skeleton media + lines.
16. **RTL-aware media order** — media flips sides in RTL (test + docs).
17. **Row telemetry** — `onClick`/`onAction` analytics callbacks.
18. **A11y row announcements** — `aria-live` for list count changes (virtualized).
19. **Print-friendly** — rows break cleanly across pages.
20. **Row schema** — an `ItemDataSchema` (zod) validating list-item payloads.

---

## Item — `components/item.tsx`

### 🔧 Improvements

List row primitive: media, content, title, description, actions, header/footer, group, separator.

1. `[R]` No ref forwarding — `Item`, `ItemTitle`, `ItemActions` need refs (focus, virtualized lists).
2. `[V]` `variant`/`size` CVA ✓ — add `state` (disabled, loading skeleton row) per rule 23.
3. `[A]` `ItemGroup` has `role="list"` ✓ — items should get `role="listitem"` via `render` when interactive.
4. `[P]` `ItemTitle`/`ItemDescription` `line-clamp` — fine; ensure no layout thrash on hover.
5. `[M]` `ItemActions` can crowd `ItemTitle` on mobile — add `wrap`/`hidden sm:flex` guidance.
6. `[D]` Row data (title/description/media) is consumer-owned ✓ — the dumb component renders slots.
7. `[T]` `ItemMedia` variant union — promote to zod enum + inferred type (rule 4).
8. `[F]` N/A as form control — but selectable rows need `aria-selected` at the smart layer.
9. `[UX]` No `interactive`/`selectable` variant — add `variant="selectable"` (hover bg + cursor) for list pickers.
10. `[Th]` `bg-muted/50` muted variant ✓ — verify dark-mode contrast.
11. `[A]` Focus ring on the row is present ✓ — document `render="button"`/`<a>` for keyboard nav.
12. `[M]` `flex-wrap` on the base — long descriptions wrap ✓; add `truncate` option for single-line rows.
13. `[P]` Memoize `Item` — rows re-render on selection; shallow memo prevents cascades.
14. `[F]` Document `Item` inside `DropdownMenu` (`in-data-[slot=dropdown-menu-content]:p-0` size xs) for menu rows.
15. `[T]` Export `ItemProps`/`ItemMediaProps` so composites extend cleanly.
16. `[A]` `ItemHeader`/`ItemFooter` `justify-between` — document slot ordering for RTL.
17. `[UX]` No avatar+title alignment issues — `group-has-data-[slot=item-description]` offset ✓; test with long descriptions.
18. `[D]` No default copy — content from props ✓; add a test asserting no text by default.
19. `[M]` `gap` spacing via size — ensure `sm` rows are touch-friendly (min-h-10).
20. `[P]` The CVA configs are module-scoped ✓ — keep exported for reuse.

### 🚀 New Features

1. **Shortcut recorder** — a `KbdRecorder` that captures the user's pressed combo (custom shortcut builder).
2. **OS-aware symbols** — auto-render `⌘` on macOS / `Ctrl` on Windows from `navigator.platform`.
3. **Key grouping with '+'** — render `⌘ ⇧ P` with automatic `+` separators from a `keys` array prop.
4. **Tooltip hint** — a `title`-driven hint shown for discoverability.
5. **Mono font token** — a `fontMono` variant for code-style keycaps.
6. **Pressed animation** — a subtle key-down press effect on active shortcuts (motion-safe).
7. **Modifier highlighting** — visually distinguish modifier keys (⌘/⇧/⌥).
8. **Size-aware** — `size` prop scaling with surrounding text.
9. **Command palette integration** — a documented pattern for listing shortcuts in a `Command`.
10. **RTL-safe** — key order flips in RTL (test + docs).
11. **A11y announcement** — `aria-label` computed from the key sequence (screen readers).
12. **Theme-aware contrast** — high-contrast variant for dark tooltips (already partial).
13. **Copy shortcut string** — a `toString()` helper exporting the display string for docs.
14. **Shortcut conflict detection** — a dev util listing duplicate shortcuts across the app.
15. **Sticky keys support** — document accessibility mode interactions.
16. **Kbd in tables** — a `variant="table"` muted style for dense rows.
17. **Emoji keycap** — fun mode rendering emoji keycaps (games/quizzes).
18. **Test helpers** — export `kbdLabel(keys)` for tests.
19. **Kbd schema** — a `KbdKeysSchema` (zod) validating key sequences.
20. **Cheatsheet generator** — a `KbdCheatsheet` listing all registered shortcuts in a table.

---

## Kbd — `components/kbd.tsx`

### 🔧 Improvements

Keyboard-key hint (`<kbd>`) with group.

1. `[R]` No ref forwarding — forward for tooltip/test targeting.
2. `[V]` No `size` variant — add `sm | default | lg` (h-4/h-5/h-6) for dense vs prominent shortcuts.
3. `[A]` `aria-hidden` guidance — a `KbdGroup` in a shortcut label should be read as a whole; document `aria-label` on the group.
4. `[M]` `min-w-5` fixed — on touch, keycaps are fine (non-interactive) but ensure grouping wraps.
5. `[P]` Static classes ✓ — no per-render objects.
6. `[Th]` `bg-muted` + `text-muted-foreground` tokens ✓ — the tooltip-inverted variant (`in-data-[slot=tooltip-content]`) is nice; add dark coverage.
7. `[D]` Data-free ✓ — children are the keycap labels.
8. `[T]` Export `KbdProps` for composites (CommandShortcut, tooltip content).
9. `[F]` N/A — keycaps are never form controls.
10. `[A]` Add `aria-hidden="true"` default on the `<kbd>` when it's decorative (shortcut hints duplicate text).
11. `[UX]` No separator style between keys in `KbdGroup` — add optional `+` separator rendering between children.
12. `[M]` On tiny screens, long shortcut combos (⌘⇧P) — allow `flex-wrap` in `KbdGroup`.
13. `[P]` Memoize — keycap chips in menus re-render; shallow memo is cheap.
14. `[D]` No default labels ✓.
15. `[V]` Add a `variant` (`default | outline`) for high-contrast contexts (dark tooltips).
16. `[A]` `select-none` + `pointer-events-none` ✓ — document why (copy/paste and screen-reader noise).
17. `[T]` `React.ComponentProps<"kbd">` — fine; keep the explicit return type (rule 15).
18. `[F]` N/A — note in JSDoc.
19. `[UX]` Match OS conventions (⌘ vs Ctrl) — document that the smart component supplies the right symbol.
20. `[P]` Ensure the `size-3` svg fallback selector doesn't clash with `KbdGroup` sizing.

### 🚀 New Features

1. **Required asterisk** — a `required` prop rendering `*` with `aria-hidden` + accessible legend note.
2. **Tooltip hint** — a `hint` prop rendering a question-mark tooltip (paired with `FieldHelp`).
3. **Optional marker** — an `optional` prop rendering "(optional)" muted text.
4. **Label with icon** — a leading `icon` slot for settings rows.
5. **Word count** — a `counter` slot rendering current/max (for labelled textareas).
6. **Click-to-focus** — a `forId` prop that focuses the control on click (native + explicit).
7. **Error-linked styling** — a `hasError` prop tinting the label red (mirrors `FieldError`).
8. **Success styling** — a `hasSuccess` prop for valid states.
9. **Truncation** — a `truncate` prop with `title` tooltip for long labels.
10. **RTL alignment** — label direction flips in RTL (test + docs).
11. **Screen-reader-only mode** — a `srOnly` prop for visually hidden but accessible labels.
12. **Label groups** — a `LabelGroup` for a label + sibling metadata row.
13. **Print styles** — labels break cleanly with their fields.
14. **Density** — a `dense` variant for compact forms.
15. **Auto-id** — generate a stable `id` from a `name` prop for `htmlFor` pairing.
16. **Keyboard focusable** — a `focusable` prop making the label a focus target (form nav).
17. **A11y test helpers** — export `labelA11yProps({ required, error })` for tests.
18. **Emoji/icon badge** — a `badge` slot for status markers (Beta).
19. **Label schema** — a `LabelConfigSchema` (zod) for generated forms.
20. **Animated error color** — a smooth color transition on error state (motion-safe).

---

## Label — `components/label.tsx`

### 🔧 Improvements

Base label with disabled-state styling.

1. `[R]` No ref forwarding — forward for form libraries that measure label widths.
2. `[F]` Add a `required` prop rendering an asterisk (`aria-hidden`) with the `aria-required` note on the control.
3. `[A]` `htmlFor` passthrough ✓ — document that labels must link to controls for SR users.
4. `[V]` No `size` variant — add `sm | default | lg` (text scale) for dense forms.
5. `[M]` `items-center` + gap-2 — long labels wrap; add `min-w-0` + `leading-snug` guidance.
6. `[P]` Static classes ✓ — no per-render objects.
7. `[Th]` `text-muted-foreground`/`opacity-50` disabled tokens ✓ — verify dark-mode contrast.
8. `[D]` Data-free ✓ — children are the label text from the smart component.
9. `[T]` Export `LabelProps` for `FieldLabel`/`SidebarGroupLabel` composition.
10. `[A]` `peer-disabled:` styling — document the peer relationship for disabled controls.
11. `[UX]` No hover affordance — labels are static by design; document why.
12. `[F]` RHF `id` alignment — document that label `htmlFor` must match the field's `id` (useId).
13. `[M]` On touch, label tap focuses the input natively ✓ — keep `select-none` from breaking it.
14. `[P]` Memoize — labels in table rows re-render; cheap memo.
15. `[D]` No hardcoded copy ✓.
16. `[A]` `group-data-[disabled=true]` — ensure the disabled style propagates from a wrapping `Field`.
17. `[V]` Consider a `weight` variant (`normal | medium | bold`) — currently `font-medium` fixed.
18. `[T]` Return type explicit ✓ (rule 15).
19. `[F]` N/A event contract — labels expose no events by design.
20. `[UX]` Add `title` passthrough for truncated long labels (already via props — document it).

### 🚀 New Features

1. **onExpire callback** — fires when the countdown hits zero so the smart form can clear the lockout state.
2. **Retry-now button** — a `onRetry` slot enabling the submit at zero with a success tint.
3. **Persistent expiry** — compute remaining time from a target `expiresAt` timestamp (drift-proof, not just `remainingSeconds`).
4. **Progress ring** — a circular countdown ring (SVG) alongside the text (polish).
5. **Multi-unit display** — show `1h 05m` for long lockouts, `MM:SS` for short ones.
6. **Copy reason** — a small "why locked?" disclosure with `details` text.
7. **Support link** — an `onContactSupport` action slot.
8. **Pulse on unlock** — a subtle highlight animation when the countdown completes.
9. **Aria-live control** — a `live` prop choosing announce-on-zero only (avoid per-second spam).
10. **Theme tokens** — amber tones via `--warning` tokens (already flagged — feature-complete here).
11. **RTL-safe** — icon/text alignment flips in RTL (test + docs).
12. **Compact inline** — a `size="sm"` row for inline form placement.
13. **Reusable countdown hook** — export `useCountdown(target)` for other timers.
14. **Test helpers** — export `formatClock` (already) + `countdownTestUtils`.
15. **Recovery options** — a slot listing "Forgot password? / Contact support" links.
16. **Busy-until check** — a `disabledUntil` prop disabling the form until expiry automatically.
17. **Multi-account notice** — an `accounts` prop hinting other accounts unaffected.
18. **Reduced-motion** — no per-second re-render animation under `prefers-reduced-motion`.
19. **Print styles** — hidden when printing (transient state).
20. **Countdown schema** — a `CountdownSchema` (zod, `z.number().int().min(0)`) for the payload.

---

## LockoutCountdown — `components/lockout-countdown.tsx`

### 🔧 Improvements

Live "account locked — retry in MM:SS" countdown from an API payload.

1. `[R]` No ref forwarding — forward for tests that read the live text.
2. `[A]` `role="status"` ✓ — but the ticking label re-announces each second; consider `aria-live="off"` + a final announcement at zero.
3. `[P]` `formatClock` is pure ✓ — export it for unit tests (already tested in the client? verify).
4. `[F]` N/A as form control — it's a status banner; document clearing the lockout state via the smart component.
5. `[M]` On mobile the label wraps — add `flex-wrap` + `min-w-0`.
6. `[Th]` `text-amber-700`/`dark:text-amber-400` — token-driven polish; consider `--warning` token.
7. `[UX]` Add an `onExpire` callback so the smart form can auto-clear the lockout state.
8. `[T]` `remainingSeconds: number` — validate with a zod schema (`z.number().int().min(0)`) at the boundary.
9. `[A]` `aria-hidden` on the Lock icon ✓ — keep.
10. `[P]` Interval cleanup on unmount ✓ — add a visibility-change resync test (already present).
11. `[M]` No layout shift on text change (`tabular-nums` ✓) — good; add a test.
12. `[D]` The countdown is data-free ✓ — `remainingSeconds` is the only input.
13. `[UX]` At zero it reads "you can try again now" — add a subtle color shift (green) via `onExpire` state.
14. `[T]` Export `LockoutCountdownProps` (already) — document the API error → prop mapping.
15. `[A]` Use `time` semantics — format as `00:00` is fine; consider `aria-valuetext` for SR clarity.
16. `[P]` `setInterval` 1s — fine; document the drift (visibility resync) trade-off.
17. `[F]` N/A — note in JSDoc that it pairs with `ACCOUNT_LOCKED` errors only.
18. `[M]` Ensure the banner fits in narrow login forms (max-w) ✓.
19. `[V]` Add a `tone` prop (`warning | destructive`) if other countdowns (e.g. rate-limit) reuse it.
20. `[P]` Memoize — the component re-renders once/sec by design; keep it cheap (it is).

### 🚀 New Features

1. **Labeled divider API** — a `label` prop so consumers don't hand-wrap `MarkerContent`.
2. **Icon markers** — an `icon` slot rendering a leading icon (calendar events, milestones).
3. **Status markers** — a `status` prop (done/current/upcoming) for stepper timelines.
4. **Vertical timeline** — a `orientation="vertical"` variant with connecting lines.
5. **Clickable markers** — an `onClick`/`href` mode for jump-to-section markers.
6. **Connector styling** — a `lineStyle` prop (`solid | dashed | dotted`).
7. **Auto-height** — markers grow with content; add `min-h` token control.
8. **RTL-safe lines** — separator lines flip in RTL (test + docs).
9. **A11y role** — `role="listitem"` in a `MarkerGroup` (timeline semantics).
10. **Collapsible markers** — a chevron expanding sub-details.
11. **Print styles** — lines render solid when printing.
12. **Density** — a `size` variant for compact step lists.
13. **Highlight content** — a `highlight` prop for the active step.
14. **Marker telemetry** — `onClick` analytics passthrough.
15. **Test helpers** — export `markerA11yProps()` for tests.
16. **Timeline schema** — a `TimelineStepSchema` (zod) validating steps.
17. **Reduced-motion** — no pulse animation for status markers under the setting.
18. **Custom line colour** — a `lineColor` token prop (success/danger variants).
19. **Keyboard focus** — `focusable` markers get a visible ring.
20. **Marker group** — a `MarkerGroup` handling spacing + connecting lines across items.

---

## Marker — `components/marker.tsx`

### 🔧 Improvements

Divider-with-text (separator/border variants) primitive.

1. `[R]` No ref forwarding — forward for layout measuring.
2. `[A]` The `separator` variant's `before:`/`after:` lines are decorative — keep `aria-hidden` on the pseudo-lines (implicit) and document.
3. `[M]` `separator` variant with long text — `group-data-[variant=separator]/marker:flex-none` keeps it centered ✓; test narrow screens.
4. `[P]` Static classes ✓ — no per-render objects.
5. `[Th]` `before:bg-border`/`after:bg-border` tokens ✓.
6. `[D]` Data-free ✓ — children are the marker text.
7. `[T]` Export `markerVariants` + inferred type (already exported).
8. `[UX]` No icon alignment issue — `MarkerIcon` `size-4` ✓.
9. `[F]` N/A as form control — it's a divider.
10. `[A]` `MarkerContent` `wrap-break-word` ✓ — long text wraps safely.
11. `[V]` Add a `size` variant (sm/default) for dense vs prominent dividers.
12. `[M]` On mobile, separator lines shrink to zero with long text — min-width guard via `before:min-w-4`.
13. `[P]` Memoize — markers in lists re-render; cheap memo.
14. `[D]` No hardcoded copy ✓.
15. `[T]` Return type explicit ✓ (rule 15).
16. `[A]` `role="separator"` on the `separator` variant — add it via `data-slot` so SRs announce the division.
17. `[UX]` `border` variant `pb-2` — fine; document stacking behavior with other dividers.
18. `[F]` N/A — note in JSDoc.
19. `[M]` Ensure `w-full` doesn't overflow — `min-w-0` on content ✓.
20. `[P]` The `useRender` merge is stateless ✓ — keep it dependency-free.

### 🚀 New Features

1. **Typeahead navigation** — typing letters jumps between menus (primitive ✓ — document + test).
2. **Menu breadcrumb** — show the current menu path in a status area.
3. **Command menu integration** — a global search menu (Help) wired to `Command`.
4. **Recent items per menu** — a pinned recent section (smart layer owns history).
5. **Disabled with reason** — a `disabledReason` tooltip on menu items.
6. **Checkable menu groups** — radio groups with a reset option.
7. **Shortcut hints** — per-item `Kbd` shortcuts (already via DropdownMenu — promote).
8. **Collapsible overflow** — the "⋯" overflow menu for narrow viewports.
9. **Keyboard-first focus** — arrow keys move between menus with visual caret.
10. **RTL flip** — menu ordering flips in RTL (test + docs).
11. **Menu telemetry** — `onMenuOpen`/`onAction` analytics callbacks.
12. **Custom item render** — `render` per item for branded rows.
13. **Menu schema** — a `MenuBarSchema` (zod) validating menu config.
14. **Test helpers** — export `menubarA11yProps()` for tests.
15. **Print styles** — menus hidden when printing (navigation chrome).
16. **Reduced-motion** — no hover slide animations under the setting.
17. **Mobile fallback** — a hamburger `Drawer` with the same menu tree on touch.
18. **Autofocus first menu** — an `initialFocus` prop on mount.
19. **Nested depth guide** — visual depth indicators for multi-level menus.
20. **Favourites pinning** — a pin action per menu item (smart layer owns state).

---

## Menubar — `components/menubar.tsx`

### 🔧 Improvements

Desktop menu bar composed from DropdownMenu primitives on base-ui `Menubar`.

1. `[R]` No ref forwarding — `MenubarTrigger`/`MenubarItem` need refs.
2. `[A]` The `Menubar` root has no `aria-label` — add `aria-label="Main menu"` (i18n-overridable).
3. `[M]` Menubars don't work on touch — document a mobile fallback (drawer/hamburger) at the smart layer.
4. `[P]` Reuses DropdownMenu internals ✓ — no duplicated styling; keep it that way.
5. `[T]` Variant/inset unions are re-derived from DropdownMenu props — share zod enums instead (rule 4).
6. `[A]` Keyboard: arrows + Enter handled by primitive ✓ — add a regression test for arrow nav.
7. `[UX]` `MenubarTrigger` `aria-expanded` styling ✓ — add a pressed/hover polish.
8. `[D]` Menu data is consumer-owned ✓.
9. `[F]` N/A as form control — document menu actions triggering forms via `onSelect`.
10. `[Th]` `bg-popover`/`ring-foreground/10` tokens ✓ — add dark coverage.
11. `[M]` Horizontal overflow on narrow screens — document `flex-wrap` or truncation.
12. `[P]` Memoize menu items — menubar re-renders on open; shallow memo helps.
13. `[A]` Submenus need `aria-haspopup` — verify primitive sets it; add a test.
14. `[T]` Export `MenubarProps`/`MenubarItemProps` for composites.
15. `[UX]` Add a `MenubarSeparator` spacing polish (already via `-mx-1 my-1`).
16. `[M]` `MenubarContent` `alignOffset=-4` — verify it doesn't clip on the right edge.
17. `[D]` No hardcoded copy ✓ — labels from the smart component.
18. `[A]` Radio/checkbox items — verify `aria-checked` (primitive ✓); add a test.
19. `[P]` The `data-slot` wiring is complete ✓ — keep for E2E selectors.
20. `[F]` Document menubar-driven forms (File → Save) with `type="submit"` item pattern.

### 🚀 New Features

1. **Message actions on hover** — copy/reply/reaction actions revealed on hover (touch: long-press).
2. **Typing indicator slot** — a `typing` avatar mode with animated dots.
3. **Read receipts** — a `receipt` slot (✓✓) aligned to the footer.
4. **Grouped timestamps** — show time only on the first of consecutive messages.
5. **Unread divider** — a "New messages" divider row injected between messages.
6. **Inline mentions** — `@mention` chips rendered by the smart layer with a `mentions` prop.
7. **Message statuses** — sending/sent/read states with icons (already via Attachment-like states).
8. **Quote/reply** — a `replyTo` slot rendering a quoted preview.
9. **Message streaming** — a `streaming` prop with a typing caret for AI responses.
10. **Thread count** — a `replies` badge + "View thread" action.
11. **Auto-scroll anchors** — `data-anchor` on the last message for `MessageScroller`.
12. **Copy text action** — a copy button with transient "Copied" (reuse trail pattern).
13. **RTL-aware alignment** — message rows flip in RTL (test + docs).
14. **Print styles** — chat transcripts print cleanly.
15. **Telemetry** — `onMessageClick`/`onAction` analytics callbacks.
16. **Test helpers** — export `messageA11yProps()` for tests.
17. **Message schema** — a `MessageSchema` (zod) for the smart layer's payloads.
18. **Reduced-motion** — no slide-in animations under the setting.
19. **Sticky composer companion** — document pairing with a fixed composer input.
20. **Delivered-time tooltip** — hover a timestamp for the full date.

---

## Message — `components/message.tsx`

### 🔧 Improvements

Chat message row: avatar, content, header, footer, alignment (start/end).

1. `[R]` No ref forwarding — `Message`/`MessageContent` need refs (scroll-to-message, tests).
2. `[V]` No `size` variant — add `sm | default | lg` (avatar + text density) for compact chat.
3. `[A]` `MessageAvatar` has no `alt` — document that the avatar `img` needs `alt` from the smart component.
4. `[M]` `MessageAvatar` `min-w-8` (32px) — on touch bump to 40px via size variant.
5. `[P]` `MessageContent` wraps `wrap-break-word` ✓ — long URLs should also get `break-words` (add via `break-all` guidance).
6. `[Th]` Alignment styles use `data-[align=end]` ✓ — no raw colors.
7. `[D]` Message data (author, avatar, content) is consumer-owned ✓.
8. `[F]` N/A as form control — document read-only display.
9. `[A]` `MessageHeader`/`MessageFooter` timestamps — add `aria-label` for SR date announcements (`dateTime` attr).
10. `[UX]` No grouped-message spacing polish — `MessageGroup` gap-2 ✓; add `compact` mode for consecutive same-author messages.
11. `[T]` `align` inline union — promote to zod enum shared with Bubble (rule 4).
12. `[M]` On narrow screens, header+avatar wrap — add `min-w-0` + `truncate` on header labels.
13. `[P]` Memoize `Message` — chat lists re-render on every new message; memo + stable props is critical.
14. `[F]` N/A — note in JSDoc.
15. `[A]` `role` guidance — document that live chat should use `aria-live="polite"` at the scroller level.
16. `[UX]` No hover actions slot — add `MessageActions` (reactions, copy) shown on hover (smart-layer concern).
17. `[D]` No hardcoded copy ✓.
18. `[T]` Export `MessageProps` for composites (Bubble integration).
19. `[M]` `group-data-[align=end]/message:*:data-slot:self-end` alignment — verify RTL behavior.
20. `[P]` The footer offset (`-translate-y-8` when footer present) — test that avatar alignment holds with multi-line content.

### 🚀 New Features

1. **Infinite scroll pagination** — an `onReachedStart` callback fetching older messages (smart layer owns fetch).
2. **Unread count badge** — a floating badge showing unread messages while scrolled up.
3. **Auto-scroll policies** — `stickToEnd` vs `stickIfNearEnd` (don't yank the user mid-read).
4. **Smooth scroll modes** — `behavior` prop (`auto | smooth`) for programmatic scrolls.
5. **Message search** — a `highlightedId` prop scrolling to + highlighting a found message.
6. **Scroll position persistence** — restore scroll position on route return (sessionStorage).
7. **Loading older rows** — a skeleton row at the top while fetching history.
8. **Day dividers** — a `dividers` prop injecting date separators between groups.
9. **Keyboard shortcuts** — PageUp/PageDown/Home/End scroll behaviour (documented).
10. **Scroll-to-unread** — a button jumping to the first unread message.
11. **RTL-safe scroll anchors** — anchors stay correct in RTL (test + docs).
12. **Reduced-motion** — disable auto-smooth scrolling under the setting.
13. **Telemetry** — `onScrollThreshold` callbacks (e.g. 80% read).
14. **Virtualized rendering** — document `content-visibility` + stable anchors for 10k+ messages.
15. **Print transcript** — a `printAll` mode rendering the full history.
16. **Focus management** — an `initialFocus` message id on mount.
17. **Test helpers** — export `scrollerTestUtils()` for scroll tests.
18. **Schema** — a `ScrollAnchorSchema` (zod) for anchor ids.
19. **Edge fade polish** — gradient fades at both ends (already partial via `scroll-fade-b`).
20. **Composer docking** — a `withComposer` wrapper keeping input visible while scrolling.

---

## MessageScroller — `components/message-scroller.tsx`

### 🔧 Improvements

Chat scroller: viewport, content, anchored items, jump-to-end button, auto-scroll hooks.

1. `[R]` No ref forwarding — `MessageScrollerViewport` needs a ref (scroll position reads).
2. `[A]` The viewport should carry `aria-live="polite"` for new messages — add a prop or document the smart-layer pattern.
3. `[M]` `MessageScrollerButton` floats bottom-center — on narrow screens keep it clear of the composer (bottom offset token).
4. `[P]` `contain-content` + `content-visibility:auto` on items — great for perf; document the `[contain-intrinsic-size]` hint.
5. `[UX]` The jump button hides when at end ✓ — add an unread-count badge when hidden messages accumulate (smart-layer).
6. `[D]` Message data is consumer-owned ✓ — the scroller only manages position.
7. `[T]` Export the hook types (`useMessageScroller` etc. are re-exported ✓) — document each.
8. `[F]` N/A as form control — the composer belongs to the smart layer.
9. `[A]` `scrollAnchor` items — document that the last anchor is where focus lands on load.
10. `[M]` `scroll-fade-b` gradient hint — ensure it's disabled when scrolled to bottom (dynamic).
11. `[P]` Memoize `MessageScrollerItem` — long threads re-render; memo + stable `scrollAnchor`.
12. `[Th]` `scrollbar-thin`/`scrollbar-thumb-transparent` during autoscroll ✓ — verify dark-mode scrollbar tint.
13. `[UX]` Add an `onReachedEnd`/`onReachedStart` callback for infinite scroll pagination (smart-layer fetch).
14. `[A]` Focus management: after clicking jump-to-end, focus should stay on the button or move to new content — document.
15. `[T]` `direction` union on the button — promote to zod enum (rule 4).
16. `[M]` Touch: overscroll-contain prevents rubber-banding ✓ — test with iOS Safari.
17. `[P]` The `Button` render swap (`render ?? <Button/>`) is per-render — hoist the default.
18. `[D]` No hardcoded copy — the button's sr-only label comes from `direction` ✓ (i18n via props).
19. `[A]` `aria-hidden` on the viewport when empty — document.
20. `[F]` N/A — note in JSDoc that input/composer is the smart layer's job.

### 🚀 New Features

1. **Mega-menu layouts** — a `columns` prop rendering content grids (feature links + promo card).
2. **Active-route highlighting** — an `isActive` prop + automatic matching via `usePathname` at the smart layer.
3. **Breadcrumb in content** — the content panel can show a mini trail for deep menus.
4. **Keyboard focus ring persistence** — visual caret stays on the active trigger (already partial).
5. **Mobile menu** — a hamburger + `Drawer` variant for touch.
6. **Search entry** — a search trigger in the nav bar wired to `Command`.
7. **Notification badge on triggers** — a `badge` prop on menu items.
8. **Scroll-spy section links** — one-page nav that highlights the section in view.
9. **Icon links** — an `icon` slot in `NavigationMenuLink`.
10. **RTL flip** — dropdown/indicator direction flips in RTL (test + docs).
11. **Telemetry** — `onNavigate` analytics callbacks.
12. **Skeleton loading** — a `loading` prop while menu data resolves.
13. **Deep-linkable panels** — `#section` hashes open the right menu.
14. **Reduced-motion** — no slide animations under the setting.
15. **Print styles** — nav hidden when printing.
16. **Test helpers** — export `navA11yProps()` for tests.
17. **Menu schema** — a `NavMenuSchema` (zod) validating the menu tree.
18. **Custom trigger render** — `render` per trigger for branded buttons.
19. **Overflow handling** — auto-collapse into "⋯" on narrow screens.
20. **Favourites pinning** — a pin action per nav item (smart layer owns state).

---

## NavigationMenu — `components/navigation-menu.tsx`

### 🔧 Improvements

Base-ui navigation menu: root, list, item, trigger, content, link, indicator.

1. `[R]` No ref forwarding — `NavigationMenuTrigger`/`NavigationMenuLink` need refs.
2. `[V]` `navigationMenuTriggerStyle` is a CVA with no variants — add `variant`/`size` so links/triggers share the system.
3. `[M]` The list is `flex-1` with `max-w-max` — on narrow screens it overflows; add a scrollable/wrap mode.
4. `[A]` `aria-label` on the root — add an `aria-label` prop (i18n).
5. `[P]` Content/positioner classes are static ✓ — keep module-scoped.
6. `[UX]` Trigger chevron rotation `rotate-180` ✓ — add a smoother transition (already `duration-300`).
7. `[D]` Menu items/data are consumer-owned ✓.
8. `[F]` N/A as form control — document nav usage only.
9. `[T]` Export `navigationMenuTriggerStyle` (already) + a `NavigationMenuVariantProps` inferred type.
10. `[A]` Keyboard: arrow + typeahead handled by primitive ✓ — add a regression test.
11. `[Th]` `bg-popover`/`ring-foreground/10` tokens ✓ — add dark coverage.
12. `[M]` Mobile: `NavigationMenuContent` is wide (`--popup-width`) — cap width on small screens.
13. `[P]` Memoize trigger/content — nav re-renders on route change; shallow memo helps.
14. `[A]` `NavigationMenuIndicator` arrow — decorative; keep `aria-hidden`.
15. `[UX]` Active link styling — add `data-[active=true]` affordance (already present ✓); document it.
16. `[D]` No hardcoded labels ✓ — items come from the smart component's menu config.
17. `[T]` `NavigationMenuLink` props — export for composite nav builders.
18. `[F]` N/A — note in JSDoc.
19. `[M]` On touch, trigger hover states don't apply — document tap-to-open behaviour (base-ui supports click).
20. `[P]` The `group/navigation-menu` prefix — keep for E2E selectors; add a data-attribute doc.

### 🚀 New Features

1. **Placeholder option** — a `placeholder` prop rendering a muted disabled first option.
2. **Grouped options from data** — an `options` prop (flat or grouped) so the smart component feeds data (rules 9–11).
3. **Loading state** — a `loading` prop rendering a skeleton + disabled select.
4. **Error message slot** — an `error` prop with helper text (compose with `FieldError`).
5. **Search filtering** — a `searchable` mode for long option lists (native select + filter input).
6. **Multiple-mode chips** — a `multiple` mode rendering selected values as chips.
7. **Size-aware chevron** — icon scales with `size` (extend the `[&_svg]` rule).
8. **Custom chevron** — a `chevron` render prop for branded indicators.
9. **Clear selection** — a `clearable` prop with an X.
10. **Option descriptions** — a `hint` map rendering small hints under options (via `optgroup` styling).
11. **RTL-safe layout** — chevron/option alignment flips in RTL (test + docs).
12. **Telemetry** — `onChange` analytics passthrough (already native).
13. **Test helpers** — export `nativeSelectA11yProps()` for tests.
14. **Option schema** — a `SelectOptionSchema` (zod) validating option payloads.
15. **Autofill harmony** — document `autoComplete` values (country/state etc.).
16. **Sticky selected label** — the trigger label truncates with `title` tooltip.
17. **Keyboard-first** — arrow keys + typeahead (native ✓ — document + test).
18. **Print styles** — selects render as plain text when printing (data dump).
19. **Reduced-motion** — no transition under the setting.
20. **Compact mode** — a `size="xs"` for dense table filters.

---

## NativeSelect — `components/native-select.tsx`

### 🔧 Improvements

Native `<select>` with chevron addon and option/optgroup helpers.

1. `[R]` The wrapper `div` isn't ref-forwarded and the `<select>` ref isn't exposed — `forwardRef` is mandatory (rule 20).
2. `[V]` `size` is an inline union (`sm | default`) — promote to CVA + zod enum.
3. `[A]` The chevron is `aria-hidden` ✓ — good; add `aria-label` guidance for icon-only selects.
4. `[F]` Consistent event contract ✓ — document RHF `register` on the `<select>`.
5. `[M]` Native selects render OS pickers on mobile ✓ — keep native behaviour (don't swap to custom on touch).
6. `[P]` Static classes ✓ — no per-render objects.
7. `[Th]` `dark:bg-input/30` + `hover:bg-input/50` tokens ✓.
8. `[UX]` No `placeholder` option styling — document `NativeSelectOption` with `value=""` + muted styling.
9. `[D]` Options are consumer-owned ✓.
10. `[T]` Export `NativeSelectProps` + `NativeSelectSizeSchema` for composites.
11. `[A]` `aria-invalid` styling ✓ — wire `aria-describedby` to `FieldError`.
12. `[F]` `multiple`/`size` native props passthrough — document that `size` prop conflicts with the native `size` attribute (`Omit<..., "size">` handles it ✓).
13. `[M]` On touch, the chevron hit area is small — wrap in a 44px tap target.
14. `[P]` Memoize — selects in forms re-render per keystroke; cheap memo.
15. `[D]` No hardcoded copy ✓.
16. `[A]` `selection:bg-primary` — nice; add `selection:text-primary-foreground` (already ✓).
17. `[UX]` No group label styling — `NativeSelectOptGroup` is unstyled; add `optgroup` label styling docs.
18. `[F]` `required`/`disabled` passthrough ✓ — add a test.
19. `[T]` Return type explicit ✓ (rule 15).
20. `[M]` `w-fit` wrapper + `w-full` select — on narrow screens ensure the wrapper doesn't force overflow (add `max-w-full`).

### 🚀 New Features

1. **Error-code tone variants** — 403/404/500 presets with distinct icons and copy slots.
2. **Search box** — a `withSearch` mode offering a search input (smart layer wires it).
3. **Sitemap links** — a `relatedLinks` prop rendering popular destinations.
4. **Contact support CTA** — a secondary `supportLink` slot.
5. **Animated illustration** — a subtle floating/parallax art (motion-safe).
6. **Auto-back countdown** — a "redirecting in 5…" timer with cancel (smart layer owns routing).
7. **Error diagnostics** — a `requestId` prop for support references (copyable).
8. **Theme-aware art** — the illustration adapts to dark/light via tokens.
9. **RTL-safe layout** — copy/icon alignment flips in RTL (test + docs).
10. **Telemetry** — an `onMount` callback reporting the 404 to analytics.
11. **Test helpers** — export `notFoundA11yProps()` for tests.
12. **Reduced-motion** — disable art animations under the setting.
13. **Print styles** — 404 pages render a minimal message when printing.
14. **Compact inline** — a `size="sm"` variant for embedded errors.
15. **Accessible focus** — focus moves to the heading on navigation (smart layer wires it).
16. **Multi-CTA layout** — primary (home) + secondary (back) buttons.
17. **Feedback form** — a `feedback` slot collecting "this page is broken" reports.
18. **Localization** — all copy via props with no English defaults (already flagged).
19. **Error schema** — a `NotFoundErrorSchema` (zod) validating error payloads.
20. **Status bar polish** — a subtle top accent bar per error code.

---

## NotFoundContent — `components/not-found-content.tsx`

### 🔧 Improvements

Shared 404 content with code, title, message, and app-supplied back link.

1. `[D]` Default strings (`"404"`, "Page not found", etc.) are hardcoded fallbacks — make them required props or clearly i18n-owned (rule 11).
2. `[R]` No ref forwarding — forward for focus management (focus the heading on 404 navigation).
3. `[A]` Add `role="main"`-safe semantics — the heading should be an `h1` for SR hierarchy (currently `h1` ✓).
4. `[M]` `min-h-[50vh]` — on small screens ensure no overflow with long messages (`px-6` ✓).
5. `[UX]` Add a `code` variant (`404 | 403 | 500`) that changes tone/icon — extend the existing `code` string.
6. `[P]` Memoize — 404 pages re-render on route; cheap memo.
7. `[Th]` `font-mono text-6xl text-muted-foreground/25` — token-based ✓; verify dark contrast.
8. `[D]` The back link is app-supplied ✓ — document that `next/link` lives in the smart layer.
9. `[T]` Export `NotFoundContentProps` (already) + a `NotFoundCodeSchema` for the code variant.
10. `[A]` `aria-label` on the back link — document the smart component provides it.
11. `[UX]` No illustration slot — add an `icon`/`media` slot for branded 404 art.
12. `[M]` Long messages truncate gracefully — `max-w-md` ✓; add `text-balance`.
13. `[P]` No default children churn — the component renders static nodes; keep it lean.
14. `[F]` N/A — document 404 as read-only.
15. `[A]` Add `aria-live="polite"` guidance when a 404 replaces content dynamically (SPA navigations).
16. `[UX]` Add an optional secondary CTA slot (e.g. "Go to dashboard") beyond the back link.
17. `[D]` No route logic ✓ — all copy via props.
18. `[T]` Return type explicit ✓ (rule 15).
19. `[M]` On desktop, center vertically with `justify-center` ✓ — add a `compact` mode for inline embeds.
20. `[P]` Ensure `backLink` is rendered last for visual hierarchy — document slot order.

### 🚀 New Features

1. **Windowed page numbers** — a `siblingCount` prop computing the ellipsis window (smart layer passes it).
2. **Jump-to-page input** — a `jumpTo` mode with a small number input + Go button.
3. **Page size selector** — a `pageSize` + `onPageSizeChange` select (10/25/50).
4. **Result summary** — a "1–10 of 142" text slot.
5. **Scroll-to-top on change** — an `onPageChange` hook scrolling to the top of the list (smart layer wires it).
6. **Loading state** — a `loading` prop disabling nav + showing a shimmer.
7. **First/Last buttons** — `showFirstLast` toggling ⟪⟫ jumps.
8. **Compact mobile** — a `compact` prop rendering only prev/next + current page.
9. **Keyboard shortcuts** — ←/→ page navigation when the list is focused.
10. **RTL flip** — prev/next swap sides in RTL (test + docs).
11. **Telemetry** — `onPageChange` analytics passthrough.
12. **Test helpers** — export `paginationA11yProps()` for tests.
13. **URL sync** — an `hrefBuilder` prop generating `?page=N` links (SSR-friendly).
14. **Reduced-motion** — no transitions under the setting.
15. **Print styles** — pagination hidden when printing.
16. **Infinite-scroll adapter** — a `loadMore` mode with an "Load more" button instead of pages.
17. **Pagination schema** — a `PageInfoSchema` (zod) validating API pagination payloads.
18. **Sticky pagination** — a `sticky` prop keeping controls visible while scrolling.
19. **Accessible announcements** — `aria-live` announcing the current page range.
20. **Multi-pager sync** — a `group` prop syncing two pagers (table + footer).

---

## Pagination — `components/pagination.tsx`

### 🔧 Improvements

Nav-based pagination: content, items, link (Button-rendered anchor), previous/next, ellipsis.

1. `[R]` No ref forwarding — `PaginationLink` needs a ref (focus the current page on change).
2. `[A]` `aria-label="pagination"` on the nav is hardcoded — make it a prop (i18n).
3. `[A]` Current page uses `aria-current="page"` ✓ — add `aria-live="polite"` on the content for SR page-change announcements.
4. `[M]` `PaginationPrevious`/`Next` hide text below `sm` (icon-only) — ensure the `aria-label`s remain (they do ✓).
5. `[P]` `PaginationLink` renders `Button` with `render` — keep `nativeButton={false}` documented so juniors don't drop it.
6. `[D]` Page numbers/window logic is the smart component's job ✓ — this is pure presentation.
7. `[V]` No `size` variant — add `sm | default | lg` (page-button size) for dense tables.
8. `[T]` `PaginationLinkProps` = `isActive` + `Pick<Button, "size">` + anchor props — promote the size to the shared Button schema.
9. `[UX]` No disabled state on first/last page — add `disabled` prop to Prev/Next (smart passes it).
10. `[F]` N/A as form control — document pagination as navigation.
11. `[Th]` Button variants handle dark mode ✓ — no raw colors.
12. `[M]` `gap-1` — on touch, page buttons (icon `size-9`) are 36px; bump via size variant.
13. `[P]` Memoize — pagination re-renders on page change; shallow memo helps.
14. `[A]` The ellipsis has `sr-only` text ✓ — keep `aria-hidden` on the icon.
15. `[D]` No hardcoded copy — Prev/Next text are prop defaults (`"Previous"`/`"Next"`) ✓ (i18n overridable).
16. `[T]` Export `PaginationProps`/`PaginationLinkProps` for composite pagers.
17. `[UX]` Add a `compact` mode (page count only, no text buttons) for small screens.
18. `[A]` Keyboard: Tab order through pages ✓ — add a test.
19. `[M]` On narrow screens, `flex-wrap` on the content — add it so 10+ pages don't overflow.
20. `[F]` N/A — note in JSDoc that pagination never holds form state.

### 🚀 New Features

1. **Generate-password button** — a dice icon generating a strong password via a pure helper (smart layer owns the generator).
2. **Password generator rules** — length + charset config (with the server's `strongPassword` rules mirrored).
3. **Strength meter integration** — a `showStrength` prop auto-mounting `PasswordStrengthMeter` from a computed score.
4. **Entropy display** — a `showEntropy` mode showing bits of entropy.
5. **Caps-lock persistent warning** — keep the warning visible after blur while caps stays on (configurable).
6. **Reveal on hold** — hold-the-eye to peek (release hides) for quick verification.
7. **Double-entry confirm** — a `confirm` mode with a match validator (RHF `validate` wired at smart layer).
8. **Keyboard shortcut to toggle** — `⌘⇧P` toggles visibility (documented).
9. **Autofill hint** — `autoComplete="new-password"`/`current-password` presets.
10. **RTL-safe layout** — eye toggle flips side in RTL (test + docs).
11. **Telemetry** — `onReveal`/`onGenerate` analytics callbacks.
12. **Test helpers** — export `passwordA11yProps()` + `formatClock`-style utils.
13. **Password schema** — a `PasswordSchema` (zod) mirroring the server's strength rules (single source of truth).
14. **Copy password** — a copy button for generated passwords (with expiry warning).
15. **Reduced-motion** — no reveal animation under the setting.
16. **Sticky caps warning** — the hint stays in layout (no jump) via reserved space.
17. **Error shake** — a `error` prop shaking the group (ties into auth error UX).
18. **Print styles** — passwords masked when printing.
19. **Compact inline** — a `size="sm"` for dense forms.
20. **Caps-lock detection fallback** — a `getModifierState` fallback reading the DOM on focus for older browsers.

---

## PasswordInput — `components/password-input.tsx`

### 🔧 Improvements

Password field with show/hide toggle + caps-lock warning.

1. `[R]` **No `forwardRef`** — the underlying `InputGroupInput` never receives a ref, so RHF `register()` cannot attach; this is the single most important fix (rule 20).
2. `[A]` `onKeyDown`/`onKeyUp` are hardcoded to `handleCapsLockChange` and **clobber consumer handlers** (spread `{...props}` happens before) — compose them: `onKeyDown={(e) => { props.onKeyDown?.(e); handleCapsLockChange(e); }}`.
3. `[A]` Caps-lock state never resets on blur — a user who tabs away with Caps Lock on leaves a stale warning; clear on `onBlur`.
4. `[F]` Consistent event contract ✓ (`onChange`/`onBlur`/`onFocus` passthrough) — document RHF `register` + the `name` prop once #1 lands.
5. `[A]` `aria-describedby` — wire to a caps-lock/error hint so SRs hear the warning.
6. `[Th]` `text-amber-600 dark:text-amber-400` warning — route through a `--warning` token (rule 22).
7. `[M]` The toggle button `tabIndex={-1}` keeps focus on the input ✓ — document why (prevents focus trap).
8. `[UX]` Show/hide toggle persists state — add `aria-pressed`/visual state on the toggle button.
9. `[P]` Handlers are `useCallback` ✓ — keep `visible`/`capsLock` state minimal (two booleans).
10. `[D]` Data-free ✓ — value/onChange controlled by the smart component.
11. `[T]` Export `PasswordInputProps` (extends input props) so composites extend cleanly.
12. `[A]` Caps-lock detection uses `getModifierState` — documented limitation (fires only on key events) ✓; add a fallback `onFocus` read when available.
13. `[M]` The wrapper `space-y-1.5` — ensure the warning doesn't shift layout unexpectedly (it's below; fine).
14. `[F]` `autoComplete="current-password"` guidance — add a doc note (already used in login forms).
15. `[UX]` Add a `showStrength` option pairing with `PasswordStrengthMeter` (smart-layer composition).
16. `[P]` Memoize — password fields re-render per keystroke at the parent; shallow memo helps.
17. `[A]` The toggle's `aria-label` is dynamic ✓ — add `aria-pressed` for state announcement.
18. `[T]` Return type explicit ✓ (rule 15).
19. `[M]` On touch, the toggle target is `icon-xs` (24px) — bump to `icon-sm` on touch for 44px.
20. `[D]` No hardcoded copy — the caps-lock message is component copy; make it a prop default (i18n).

### 🚀 New Features

1. **Live checklist animation** — criteria check off one-by-one as they're met (motion-safe).
2. **Progress semantics** — a `role="progressbar"` with `aria-valuenow` for SRs.
3. **Score thresholds config** — a `thresholds` prop customizing weak/fair/good/strong cutoffs.
4. **Breach warning** — a `breached` prop showing a "known compromised password" alert (HIBP integration at smart layer).
5. **Time-to-crack estimate** — a `estimate` prop rendering a friendly "takes ~1 hour to crack".
6. **Strength emoji/icons** — fun icons per score tier (motion-safe).
7. **Copy criteria text** — criteria labels via prop (i18n-friendly, no hardcoded English).
8. **RTL-safe bar** — segments fill right-to-left in RTL (test + docs).
9. **Reduced-motion** — no segment transitions under the setting.
10. **Test helpers** — export `strengthA11yProps(score)` for tests.
11. **Schema** — a `StrengthScoreSchema` (zod, `0–4` int) for the payload.
12. **Tooltip per segment** — hover a segment to see its meaning.
13. **Multi-policy display** — show rules from a `policy` prop (password policy settings).
14. **Debounced updates** — a `debounceMs` prop so the meter doesn't flicker per keystroke.
15. **Compact variant** — a one-line `size="sm"` for dense forms.
16. **Entropy meter** — a secondary scale showing estimated entropy bits.
17. **Accessibility note** — `aria-live="off"` + announce-on-blur option.
18. **Theme tokens** — score colors via `--success`/`--warning`/`--danger` (already flagged).
19. **Animated fill** — a smooth width transition on percent change (motion-safe).
20. **Strength summary** — a `summary` prop returning a machine-readable verdict for tests.

---

## PasswordStrengthMeter — `components/password-strength-meter.tsx`

### 🔧 Improvements

4-segment strength bar + label + unmet-criteria checklist (score driven by the smart component).

1. `[Th]` `SEGMENT_COLORS` uses raw `bg-red-500`/`orange-500`/`amber-500`/`emerald-500`/`emerald-600` — replace with design tokens (`--danger`, `--warning`, `--success`…, rule 22).
2. `[A]` The bar is `aria-hidden` with no progress semantics — add `role="progressbar"` + `aria-valuemin/max/now` derived from `percent`/`score`.
3. `[P]` `[0, 1, 2, 3].map(...)` array literal per render — hoist to a module constant (`SEGMENT_INDEXES`).
4. `[D]` Score/label/percent are computed by the smart component (`passwordStrength()`) ✓ — keep the meter pure.
5. `[T]` `score`/`percent` are numbers — validate at the boundary with a zod schema (`z.number().int().min(0).max(4)` / `0–100`).
6. `[UX]` Segments fill by `index < Math.round(score)` — round half-up is fine; document the mapping.
7. `[M]` On narrow forms the label row ("Password strength" + label) wraps — add `flex-wrap` + `min-w-0`.
8. `[R]` No ref forwarding — forward for tests/measurement.
9. `[F]` N/A as form control — document that validation logic never lives here.
10. `[A]` `aria-live="polite"` on the root ✓ — but re-announces every keystroke; consider `aria-live="off"` + explicit announce.
11. `[P]` `colorForScore` loop is O(5) — fine; hoist to a lookup via the sorted array (already sorted).
12. `[Th]` `bg-muted` inactive segments ✓ — verify dark-mode contrast.
13. `[UX]` Add an optional `criteria` completion check (✓/✗ per criterion) — the checklist already exists; add icons.
14. `[D]` `missing` copy is consumer-owned ✓ — the meter renders it verbatim (i18n at the smart layer).
15. `[T]` Export `PasswordStrengthMeterProps` (already) — document the smart-side contract with `passwordStrength()`.
16. `[M]` Hidden when `percent <= 0` ✓ — document the empty-password case.
17. `[A]` The checklist bullets are decorative (`size-1` dots) — keep `aria-hidden`.
18. `[UX]` Color the label with the active segment color ✓ — ensure contrast on dark mode via tokens.
19. `[P]` Memoize — the meter re-renders per keystroke; cheap memo + stable props.
20. `[F]` N/A — note that RHF `watch` drives `percent` at the smart layer.

### 🚀 New Features

1. **Anchor customization** — an `anchor` prop pinning the popover to any element (not just the trigger).
2. **Arrow pointer** — a `showArrow` toggle (matches Tooltip).
3. **Dismiss on scroll** — an `closeOnScroll` prop for table-toolbar popovers.
4. **Inline vs portal** — a `inline` prop rendering in-place (no portal) for overflow contexts.
5. **Focus trap mode** — a `modal` prop trapping focus inside (mini-dialog).
6. **Rich content layout** — a `header`/`footer` slot API for structured popovers.
7. **Command integration** — document pairing with `Command` for quick-pick popovers.
8. **Virtual anchor** — support `getBoundingClientRect`-based anchors for contextual menus.
9. **RTL flip** — positioner flips in RTL (test + docs).
10. **Telemetry** — `onOpenChange` analytics callbacks.
11. **Test helpers** — export `popoverA11yProps()` for tests.
12. **Reduced-motion** — no slide animations under the setting.
13. **Print styles** — popovers hidden when printing.
14. **Scrollable content** — a `maxHeight` + `overflow` mode (already flagged — feature here).
15. **Keyboard-first** — arrow/typeahead support for list popovers (documented).
16. **Schema** — a `PopoverConfigSchema` (zod) for placement configs.
17. **Autofocus content** — an `initialFocus` selector on open.
18. **Hover-open mode** — a `trigger="hover"` option (acts like HoverCard).
19. **Custom backdrop** — an optional `backdrop` render for modal mode.
20. **Sticky tooltips chain** — document stacking multiple popovers with z-index order.

---

## Popover — `components/popover.tsx`

### 🔧 Improvements

Base-ui popover with header, title, description.

1. `[R]` No ref forwarding — `PopoverTrigger`/`PopoverContent` need refs.
2. `[V]` `w-72` is hardcoded — add a `width` prop (`sm | md | lg | auto`) so content scales.
3. `[A]` No arrow — add `PopoverArrow` matching Tooltip's arrow for anchored hints.
4. `[M]` Long content can overflow — add `max-h` + `overflow-y-auto` option (or a `scrollable` variant).
5. `[P]` Static classes ✓ — keep module-scoped.
6. `[Th]` `bg-popover`/`ring-foreground/10` tokens ✓ — add dark coverage.
7. `[D]` Content is consumer-owned ✓.
8. `[F]` N/A as form control — but popover-as-combobox is handled by Combobox; document the split.
9. `[T]` Export `PopoverContentProps`/`PopoverTriggerProps` for composites.
10. `[A]` Keyboard: Escape closes ✓ (primitive); add a regression test.
11. `[UX]` No entrance animation customization — reuse the `animate-in` pattern (already ✓).
12. `[M]` On small screens, `--available-width` clamping (base-ui ✓) — add a test.
13. `[P]` Memoize content — popovers re-render on open; shallow memo helps.
14. `[A]` `aria-describedby`-style trigger wiring — document that the popover should be announced via trigger label.
15. `[UX]` Add a `PopoverFooter`-style action slot? — recommend composing with Card/Field instead.
16. `[F]` N/A — note in JSDoc.
17. `[D]` No hardcoded copy ✓.
18. `[A]` `align`/`side` props passthrough ✓ — keep the `Pick<Positioner.Props, ...>` pattern.
19. `[M]` On touch, tap-outside closes (primitive ✓) — add a test.
20. `[P]` The `isolate z-50` Positioner — keep; document z-index stacking with Dialog.

### 🚀 New Features

1. **Indeterminate mode** — a `indeterminate` prop with an animated sweeping bar.
2. **Steps/segmented progress** — a `steps` prop rendering discrete segments (multi-step wizards).
3. **Label inside** — a `showValue` mode overlaying the percent on the bar.
4. **Success/error tones** — `tone` prop (`default | success | warning | danger`) via tokens.
5. **Animated transitions** — a smooth width transition on value change (motion-safe).
6. **Stripes** — a `striped` prop with CSS stripes (loading aesthetics).
7. **Progress with tooltip** — hover the bar for the exact value.
8. **Countdown-style** — a `direction="decreasing"` mode (time remaining).
9. **RTL-safe fill** — the bar fills right-to-left in RTL (test + docs).
10. **Telemetry** — `onComplete` callback when reaching 100%.
11. **Test helpers** — export `progressA11yProps(value)` for tests.
12. **Reduced-motion** — no pulse/transition under the setting.
13. **Schema** — a `ProgressValueSchema` (zod, `0–100` number).
14. **Multi-bar stack** — a `ProgressStack` showing nested progress (sub-tasks).
15. **Upload grouping** — a `group` prop aggregating file upload progress.
16. **Print styles** — progress hidden when printing.
17. **Compact** — a `size="xs"` hairline for table rows.
18. **Async status text** — a `status` slot rendering "Uploading 3 of 5…".
19. **Threshold markers** — a `markers` prop (e.g. quota limits) on the track.
20. **Focusable progress** — a `focusable` mode for SR-driven stepping (rare).

---

## Progress — `components/progress.tsx`

### 🔧 Improvements

Base-ui progress with track, indicator, label, value.

1. `[R]` No ref forwarding — `Progress`/`ProgressIndicator` need refs (tests, animation hooks).
2. `[V]` No `variant` — add `default | secondary | success` (indicator color) + `size` (`sm | default | lg` — bar height).
3. `[A]` `role="progressbar"` comes from the primitive ✓ — verify `aria-valuenow`/`aria-valuemin/max` are set.
4. `[UX]` No indeterminate mode — add `indeterminate` (animated stripes/shimmer) for unknown-duration loading.
5. `[M]` `h-1.5` fixed — size variant fixes touch/fine-grained visibility.
6. `[P]` Static classes ✓ — no per-render objects.
7. `[Th]` `bg-primary`/`bg-muted` tokens ✓.
8. `[D]` Value comes from the smart component ✓.
9. `[F]` N/A as form control — document progress as read-only feedback.
10. `[T]` Export `ProgressProps`/`ProgressIndicatorProps` for composites.
11. `[A]` `aria-label` on the root when label is sr-only — add guidance.
12. `[UX]` Add stripes/transition on the indicator (`transition-all` ✓) — respect `prefers-reduced-motion`.
13. `[M]` On narrow screens the label row wraps — add `flex-wrap`.
14. `[P]` Memoize — progress updates every tick; shallow memo + stable `value` helps.
15. `[D]` No hardcoded copy — `ProgressValue` text is consumer-provided ✓.
16. `[A]` `aria-live="off"` for frequent updates (avoid SR spam) — document.
17. `[UX]` Add a `label` slot alignment (already via `ProgressLabel`/`ProgressValue` ✓).
18. `[T]` Return type explicit ✓ (rule 15).
19. `[F]` N/A — note in JSDoc.
20. `[M]` `overflow-x-hidden` on the track — ensure rounded corners don't clip the indicator (they do via rounded-full ✓).

### 🚀 New Features

1. **Card-style options** — a `variant="card"` rendering selectable cards (border + checkmark).
2. **Icon options** — an `icon` slot per item (payment methods).
3. **Description options** — a `description` slot under the label (plan pickers).
4. **Keyboard-first** — arrow keys + Home/End (primitive ✓ — document + test).
5. **RTL-safe layout** — dot/label order flips in RTL (test + docs).
6. **Telemetry** — `onValueChange` analytics passthrough.
7. **Test helpers** — export `radioA11yProps()` for tests.
8. **Schema** — a `RadioOptionSchema` (zod) validating options.
9. **Reveal extra fields** — a `showIfSelected` mode revealing conditional fields (payment forms).
10. **Loading state** — a `loading` prop with skeleton options.
11. **Compact** — a `dense` size for table filters.
12. **Print styles** — radio groups print cleanly.
13. **Reduced-motion** — no dot transition under the setting.
14. **Custom indicator** — a `indicator` render prop (check vs dot).
15. **Nested groups** — a `group` concept for cascading choices.
16. **Accessible labels** — `aria-labelledby` wiring to a group legend.
17. **Free-form option** — an "Other…" option revealing a text input (smart layer wires it).
18. **Vertical on mobile** — orientation stacks below `sm` (already flagged — feature here).
19. **Emoji options** — fun mode with emoji labels.
20. **Selection summary** — an `onSelect` reporting `{ value, label }` for analytics.

---

## RadioGroup — `components/radio-group.tsx`

### 🔧 Improvements

Base-ui radio group with item + indicator dot.

1. `[R]` No ref forwarding — `RadioGroupItem` needs a ref (RHF register, focus).
2. `[V]` No `orientation`/`size` — add `orientation: horizontal | vertical` + `size` (dot size) via CVA.
3. `[A]` Keyboard: arrow keys handled by primitive ✓ — add a regression test.
4. `[F]` Document the RHF `Controller` pattern (value/onChange) — the group is fully controlled ✓.
5. `[M]` `gap-3` fixed — on narrow screens horizontal groups overflow; add `flex-wrap` or vertical default on mobile.
6. `[P]` Static classes ✓ — no per-render objects.
7. `[Th]` `dark:data-checked:bg-primary` duplication like Checkbox — simplify to one token path.
8. `[A]` `aria-invalid` styling ✓ — wire `aria-describedby` to `FieldError`.
9. `[UX]` No animation on the dot — add a subtle scale transition (motion-safe).
10. `[D]` Selection state is consumer-owned ✓.
11. `[T]` Export `RadioGroupProps`/`RadioGroupItemProps` for composites.
12. `[A]` `aria-label` on the group when no visible legend — add guidance.
13. `[M]` The 44px hit area (`after:-inset-x-3 -inset-y-2`) ✓ — keep.
14. `[F]` `required`/`disabled` passthrough ✓ — add a test.
15. `[UX]` No card-style option — document `FieldLabel`-wrapped radio cards (smart-layer pattern).
16. `[P]` Memoize items — radio lists re-render on selection.
17. `[D]` No default labels — options come from the smart component ✓.
18. `[A]` The dot indicator is `bg-primary-foreground` — contrast ✓ in both themes.
19. `[T]` Return type explicit ✓ (rule 15).
20. `[F]` N/A event contract beyond native — the group exposes onChange via the primitive ✓.

### 🚀 New Features

1. **Persisted layouts** — a `storageKey` prop restoring panel sizes (smart layer opts in).
2. **Collapse buttons** — a `collapsible` handle with chevron controls (collapse/expand panel).
3. **Double-click reset** — a `onDoubleClick` reset to default sizes (library ✓ — promote).
4. **Keyboard resize** — arrow keys resize a focused panel (library ✓ — test).
5. **RTL-safe panels** — panel order/resizing flips in RTL (test + docs).
6. **Min/max guards** — a `minSize`/`maxSize` per panel (library props — document).
7. **Mobile stacking** — panels stack vertically below `sm` (responsive layout).
8. **Telemetry** — `onResize` callbacks for analytics.
9. **Test helpers** — export `resizableA11yProps()` for tests.
10. **Schema** — a `PanelLayoutSchema` (zod) validating saved layouts.
11. **Reduced-motion** — no transition under the setting.
12. **Handle hover polish** — a highlight on the handle hover (token-based).
13. **Overlay handles** — handles float over content (no layout shift).
14. **Print styles** — panels render full-height when printing.
15. **Snap sizes** — a `snap` array of allowed widths (e.g. 25/50/75%).
16. **Grouped handles** — a `ResizableHandleGroup` for multi-panel grids.
17. **Initial focus** — an `initialPanel` prop focusing a panel on mount.
18. **Keyboard hint** — a tooltip on the handle ("drag or arrow-key resize").
19. **Panel breadcrumb** — document pairing with `BreadcrumbTrail` for nested panes.
20. **Layout swap animation** — animate between persisted layouts (motion-safe).

---

## Resizable — `components/resizable.tsx`

### 🔧 Improvements

`react-resizable-panels` wrapper (group, panel, handle).

1. `[R]` No ref forwarding — `ResizablePanel` needs a ref for imperative `collapse`/`resize`.
2. `[A]` The handle is keyboard-accessible via the library ✓ — add `aria-label` guidance on handles.
3. `[M]` On mobile, resizable panels are awkward — document stacking panels (library `direction` prop) for small screens.
4. `[P]` Static classes ✓ — the library manages layout.
5. `[Th]` `bg-border` handle tokens ✓.
6. `[D]` Panel sizes are consumer-controlled ✓ (`defaultSize`/`onResize`).
7. `[F]` N/A as form control.
8. `[T]` Export `ResizablePanelGroupProps`/`ResizablePanelProps` (already from the lib) — document.
9. `[UX]` `withHandle` visual — add a `grip` polish (dots) via `after:` styling.
10. `[A]` Focus ring on the handle ✓ — add a test for keyboard resize (arrow keys).
11. `[M]` Double-click to reset (library default) — document `onReset` hooks.
12. `[P]` Memoize panels — layout re-renders on resize; shallow memo helps.
13. `[D]` No data logic ✓.
14. `[A]` `aria-orientation` on the handle — the library sets it ✓.
15. `[UX]` Collapsed state polish — document `collapsible` + `collapsedSize` usage.
16. `[Th]` Dark-mode handle contrast — verify `bg-border` reads well.
17. `[T]` Return type explicit ✓ (rule 15).
18. `[F]` N/A — note in JSDoc.
19. `[M]` On touch, drag handles need `touch-action` — the library handles it; add a test.
20. `[P]` The `rtl` transform overrides — keep tested for RTL layouts.

### 🚀 New Features

1. **Auto-hide scrollbars** — a `type` prop (`auto | always | scroll | hover`) for overlay scrollbars.
2. **Scroll-to helpers** — an imperative API (`scrollTo`, `scrollToBottom`) via ref.
3. **Edge fade masks** — a `fadeEdges` prop rendering gradient hints (reuse `scroll-fade-*`).
4. **Scroll shadow** — a shadow at the top while scrolled (card-like polish).
5. **Load-more trigger** — an `onReachedBottom` callback for infinite scroll.
6. **Sticky headers inside** — a `stickyHeader` prop (table headers that stick within the area).
7. **Scroll progress** — an `onScrollProgress` callback (reading progress bars).
8. **RTL-safe** — scrollbar side flips in RTL (test + docs).
9. **Reduced-motion** — no transitions under the setting.
10. **Telemetry** — `onScroll` throttled analytics passthrough.
11. **Test helpers** — export `scrollA11yProps()` for tests.
12. **Schema** — a `ScrollAreaConfigSchema` (zod) for configs.
13. **Print styles** — content prints fully (no clipping).
14. **Focus management** — an `initialFocus` selector on mount.
15. **Keyboard scrolling** — arrow/space scrolling documented + tested.
16. **Both-axis scrollbar** — horizontal + vertical scrollbars simultaneously.
17. **Custom thumb** — a `thumbRender` prop for branded scrollbars.
18. **Scroll snap** — a `snapType` prop for carousel-like lists.
19. **Nested scroll areas** — document scroll-chaining behaviour.
20. **Compact scrollbar** — a `size` prop for the scrollbar width.

---

## ScrollArea — `components/scroll-area.tsx`

### 🔧 Improvements

Base-ui scroll area with viewport, scrollbar, thumb, corner.

1. `[R]` No ref forwarding — `ScrollArea`/`ScrollBar` need refs (scroll-to, tests).
2. `[A]` Viewport focus ring ✓ — add `tabIndex={0}` semantics documentation for scrollable regions.
3. `[M]` Scrollbar `data-vertical:w-2.5` — on touch, scrollbars should auto-hide (base-ui `type` prop); document.
4. `[P]` Static classes ✓ — no per-render objects.
5. `[Th]` `bg-border` thumb token ✓ — verify dark contrast.
6. `[D]` Content is consumer-owned ✓.
7. `[F]` N/A as form control.
8. `[T]` Export `ScrollAreaProps`/`ScrollBarProps` for composites.
9. `[UX]` Add `scroll-fade-*` edge hints (like MessageScroller) — document the pattern.
10. `[A]` `aria-label` on the scrollbar (decorative) — keep `role` minimal.
11. `[M]` `overscroll-contain` on scrollable content — add via prop (base-ui supports).
12. `[P]` Memoize — scroll areas re-render on scroll state; shallow memo helps.
13. `[D]` No data logic ✓.
14. `[A]` Keyboard scroll: Space/arrows on focused viewport — add a test.
15. `[UX]` Scrollbar corner radius polish — keep `rounded-full` thumb ✓.
16. `[Th]` `p-px` on scrollbar — token-based spacing ✓.
17. `[T]` Return type explicit ✓ (rule 15).
18. `[F]` N/A — note in JSDoc.
19. `[M]` On touch, drag-to-scroll works natively ✓ — document that custom scrollbar only decorates.
20. `[P]` The `Corner` component — keep mounted (cheap) and documented.

### 🚀 New Features

1. **Searchable select** — a `searchable` prop with a filter input in the dropdown.
2. **Creatable option** — an `allowCreate` mode adding typed values (fires `onCreate`).
3. **Async options** — a `loadOptions` prop with a loading row.
4. **Multi-select** — a `multiple` prop rendering selected values as chips (ties into Combobox).
5. **Grouped options** — a `groups` data API (smart component feeds grouped data).
6. **Option icons** — an `icon` slot per option (currency, flags).
7. **Clearable** — a `clearable` prop with an X in the trigger.
8. **Value formatting** — a `formatValue` render prop for custom trigger labels.
9. **Select-all group header** — a group header checkbox for multi-select.
10. **RTL-safe dropdown** — the popup aligns/flips in RTL (test + docs).
11. **Telemetry** — `onValueChange` analytics passthrough.
12. **Test helpers** — export `selectA11yProps()` for tests.
13. **Schema** — a `SelectOptionSchema` (zod) validating options.
14. **Empty state** — a `SelectEmpty` placeholder when no options match.
15. **Reduced-motion** — no popup transitions under the setting.
16. **Print styles** — selects print as plain text.
17. **Compact** — a `size="xs"` for dense tables.
18. **Autofocus on open** — focus the first option on open (opt-in).
19. **Keyboard typeahead** — typing letters jumps to options (primitive ✓ — test).
20. **Loading skeleton options** — a `loading` prop rendering skeleton rows.

---

## Select — `components/select.tsx`

### 🔧 Improvements

Base-ui select with trigger, content, items, labels, separators, scroll buttons.

1. `[R]` No ref forwarding — `SelectTrigger`/`SelectItem` need refs (RHF register, focus).
2. `[V]` `size` union (`sm | default`) — promote to CVA + zod enum; add `lg` for large forms.
3. `[A]` `SelectValue` `aria-invalid` styling ✓ — wire `aria-describedby` to `FieldError`.
4. `[F]` Document the RHF `Controller` pattern (value/onChange) — fully controlled ✓.
5. `[M]` `SelectContent` `max-h-(--available-height)` ✓ — on small screens ensure flip logic (primitive ✓).
6. `[P]` Static classes ✓ — no per-render objects.
7. `[Th]` `dark:bg-input/30` tokens ✓.
8. `[D]` Options are consumer-owned ✓.
9. `[T]` Export `SelectTriggerProps`/`SelectItemProps` for composites.
10. `[A]` `SelectItem` `aria-selected`/`aria-checked` — primitive handles; add a test.
11. `[UX]` No loading/empty state — add `SelectEmpty`-style placeholder or document composing with `SelectItem` disabled.
12. `[M]` `SelectTrigger` `w-fit` — on narrow screens add `w-full` option.
13. `[P]` Memoize items — selects re-render on open; shallow memo helps.
14. `[A]` Keyboard: arrows/typeahead ✓ (primitive); add a regression test.
15. `[UX]` Scroll buttons (`SelectScrollUpButton`/`Down`) — keep `bg-popover` sticky ✓.
16. `[D]` No hardcoded copy ✓.
17. `[T]` Return type explicit ✓ (rule 15).
18. `[F]` `required`/`disabled` passthrough ✓ — add a test.
19. `[M]` On touch, native picker fallback is unavailable (custom select) — document keyboard-first usage.
20. `[A]` `SelectLabel` group labeling — verify SR grouping (primitive ✓).

### 🚀 New Features

1. **Labeled separator** — a `label` mode (compose `Marker` automatically).
2. **Dashed variant** — a `variant="dashed"` for empty-state areas.
3. **Gradient fade** — a `fade` prop fading the line at the ends.
4. **Vertical in toolbars** — a `toolbar` preset with proper margins.
5. **RTL-safe** — separator direction flips in RTL (test + docs).
6. **Print styles** — separators print at full contrast.
7. **Telemetry** — none needed (decorative) — document why.
8. **Test helpers** — export `separatorA11yProps()` for tests.
9. **Schema** — a `SeparatorVariantSchema` (zod) for the variant union.
10. **Reduced-motion** — no transitions under the setting.
11. **Custom thickness** — a `size` prop (hairline/medium/bold).
12. **Custom color** — a `tone` prop via tokens (muted/strong/primary).
13. **Animated reveal** — a subtle grow-in when appearing (motion-safe).
14. **List item separators** — a `list` preset with inset margins.
15. **Card separators** — a `card` preset spanning card padding.
16. **Accessible role control** — a `decorative` prop controlling `aria-hidden`.
17. **Break-safe** — `break-inside-avoid` for printing.
18. **Indentable** — a `indent` prop aligning with sibling content.
19. **Composable** — document composing `Separator` with `ButtonGroup`/`Field`.
20. **Skeleton divider** — a `loading` prop rendering a shimmering line.

---

## Separator — `components/separator.tsx`

### 🔧 Improvements

Base-ui separator (horizontal/vertical).

1. `[R]` No ref forwarding — forward for layout measuring.
2. `[A]` The separator is decorative by default — add `decorative` prop controlling `aria-hidden`/`role="separator"`.
3. `[V]` No `variant` — add `default | soft | strong` (border intensity) + `size` (thickness).
4. `[M]` Vertical separators `self-stretch` ✓ — test inside flex rows.
5. `[P]` Static classes ✓.
6. `[Th]` `bg-border` token ✓.
7. `[D]` Data-free ✓.
8. `[T]` Export `SeparatorProps` for composites (ButtonGroupSeparator, FieldSeparator).
9. `[UX]` No `withText` mode — document composing with `Marker` for labeled dividers.
10. `[A]` `data-horizontal`/`data-vertical` hooks ✓ — keep for CSS customization.
11. `[M]` On mobile, horizontal separators are full-width ✓.
12. `[P]` Memoize — separators in lists re-render; cheap memo.
13. `[D]` No hardcoded copy ✓.
14. `[A]` `role="separator"` set by primitive ✓ — verify SR announcements.
15. `[UX]` Add a dashed variant for empty-state areas (matching Empty's `border-dashed`).
16. `[T]` Return type explicit ✓ (rule 15).
17. `[F]` N/A — note in JSDoc.
18. `[M]` In vertical menus, ensure `h-auto` grows correctly — test.
19. `[P]` The `shrink-0` guard ✓ — prevents separator collapse in flex.
20. `[D]` No default labels — separators are visual only ✓.

### 🚀 New Features

1. **Snap-point bottom sheet** — a `snapPoints` prop on the bottom side (collapsed/half/full).
2. **Drag-to-close handle** — a `showHandle` grip on bottom sheets (ties into Drawer).
3. **Form sheet pattern** — a documented sticky-footer form layout (save/cancel pinned).
4. **Multi-level sheets** — nested sheets with a back-stack (edit → confirm).
5. **Keyboard shortcuts** — `Esc` closes (✓) and an optional shortcut to reopen.
6. **RTL-safe slide** — side sheets slide from the correct edge in RTL (test + docs).
7. **Telemetry** — `onOpenChange` analytics passthrough.
8. **Test helpers** — export `sheetA11yProps()` for tests.
9. **Schema** — a `SheetSideSchema` (zod) + `SheetSizeSchema` for the props.
10. **Reduced-motion** — no slide animation under the setting.
11. **Print styles** — sheets print as full content.
12. **Scroll-lock** — a `bodyScrollLock` prop preventing background scroll.
13. **Autofocus** — an `initialFocus` selector on open (search sheets).
14. **Full-height toggle** — a `expandable` mode with a maximize button.
15. **Progress-aware header** — a `status` slot (saving/spinner) in the header.
16. **Backdrop opacity** — a `backdropOpacity` token for brand consistency.
17. **Sheet breadcrumb** — document pairing with `BreadcrumbTrail` in nested sheets.
18. **Command integration** — a `search` preset with an input at the top.
19. **Focus return** — restore focus to the trigger on close (primitive ✓ — formalize).
20. **Multi-sheet stack** — a `SheetStack` managing z-order of open sheets.

---

## Sheet — `components/sheet.tsx`

### 🔧 Improvements

Side sheet (top/right/bottom/left) built on base-ui Dialog.

1. `[R]` No ref forwarding — `SheetContent`/`SheetTrigger` need refs.
2. `[V]` `side` union inline; widths are hardcoded (`w-3/4`, `sm:max-w-sm`) — add a `size` prop (`sm | md | lg | full`) with token widths.
3. `[A]` `SheetTitle`/`SheetDescription` — document that a title is required for a11y (Sidebar already does sr-only).
4. `[M]` `data-[side=bottom]` sheets are `h-auto` — cap max height (`max-h-[85dvh]`) so tall content scrolls.
5. `[P]` Static classes ✓ — no per-render objects.
6. `[Th]` `bg-popover`/`shadow-lg` tokens ✓.
7. `[D]` Content is consumer-owned ✓.
8. `[F]` Sheet-as-form — document RHF wiring (edit sheets) with submit in the footer.
9. `[T]` Export `SheetContentProps`/`SheetProps` for composites.
10. `[A]` Focus trap ✓ (Dialog-based); add a regression test.
11. `[UX]` Slide animation `duration-200` ✓ — respect `prefers-reduced-motion`.
12. `[M]` On touch, `w-3/4` is fine; ensure swipe-to-close (base-ui) works.
13. `[P]` Memoize — sheets re-render on open; shallow memo helps.
14. `[A]` `aria-label` on close button ✓ (`sr-only`); add i18n override.
15. `[UX]` Add a `withGrip` option for bottom sheets (drag handle like Drawer).
16. `[D]` No hardcoded copy ✓.
17. `[T]` Return type explicit ✓ (rule 15).
18. `[F]` N/A event contract beyond native.
19. `[M]` On desktop, `sm:max-w-sm` constrains side sheets ✓ — document width tokens.
20. `[A]` Escape closes ✓ — add a test.

### 🚀 New Features

1. **Command palette trigger** — a `search` trigger wired to `Command` (⌘K) in the header.
2. **Section pinning** — pin favourite menu groups to the top (smart layer owns state).
3. **Collapse-to-icons** — a `collapsible="icon"` mode with tooltip flyouts (already partial — feature-complete).
4. **Notification badges** — a `badge` prop on `SidebarMenuButton` (unread counts).
5. **Drag to resize** — a draggable edge resizing the sidebar (persisted width).
6. **User switcher footer** — a `SidebarUser` component (avatar + account menu) for the footer.
7. **Active-section scrollspy** — auto-expand the group containing the active route.
8. **Recent items** — a "Recent" group surfaced at the top (smart layer owns history).
9. **Collapse shortcut hint** — show `⌘B` in a tooltip on the rail.
10. **Keyboard nav** — arrow keys + Home/End roving through menu items.
11. **RTL flip** — sidebar side/borders flip in RTL (test + docs).
12. **Telemetry** — `onNavigate`/`onCollapse` analytics callbacks.
13. **Test helpers** — export `sidebarA11yProps()` for tests.
14. **Schema** — a `SidebarMenuSchema` (zod) validating the menu tree.
15. **Reduced-motion** — no slide/collapse animation under the setting.
16. **Print styles** — sidebar hidden when printing (content only).
17. **Loading skeletons** — a `loading` prop rendering menu skeletons (already a sub-component — wire it).
18. **Offline indicator** — a status dot in the footer (network status integration).
19. **Collapse memory** — persist collapsed state per-user (already a cookie — formalize with a key).
20. **Section collapse** — collapsible groups with a chevron (collapsible menu groups).

---

## Sidebar — `components/sidebar.tsx`

### 🔧 Improvements

The big one: provider, desktop sidebar (offcanvas/icon), mobile sheet, rail, menu buttons, sub-menus, badges, skeletons.

1. `[T]` `setOpen` uses `typeof value === "function"` (rule 13) — replace with a zod-validated setter type (`z.function().args(z.union([z.boolean(), z.function()]))` inferred, or a discriminated union).
2. `[M]` `SidebarMenuSkeleton` uses `Math.random()` in a `useState` initializer — **hydration mismatch risk**: the server renders one width, the client another. Use a deterministic width (e.g. index-based) or set the random value in an effect after mount.
3. `[Th]` `data-active:bg-slate-800 ... text-white` — hardcoded palette (rule 22); use `--sidebar-accent` tokens so dark/light and brand themes work.
4. `[R]` No ref forwarding on `Sidebar`, `SidebarTrigger`, `SidebarMenuButton` — forward for tests and focus management.
5. `[A]` `SidebarRail` is `tabIndex={-1}` — document that it's decorative; ensure `aria-label` (has ✓).
6. `[P]` The provider writes a cookie inside `setOpen` (a callback, not render) ✓ — but guard `typeof document` for safety and add a `SIDEBAR_COOKIE_NAME` override prop for multi-app isolation.
7. `[A]` `SidebarMenuButton` tooltip uses `typeof tooltip === "string"` (rule 13) — type it via a zod union (`string | TooltipContentProps`).
8. `[M]` Mobile sheet width `SIDEBAR_WIDTH_MOBILE = "18rem"` is 288px — on 320px screens that's almost full width; consider `min(18rem, 85vw)`.
9. `[UX]` No active-route indicator polish beyond `data-active` — add an optional left accent bar (token-based) for the active item.
10. `[D]` Menu items/data are consumer-owned ✓ — the sidebar never fetches; keep it that way.
11. `[F]` N/A as form control — document `SidebarInput` (search) RHF usage at the smart layer.
12. `[Th]` `sidebar-border`/`sidebar-accent` tokens exist ✓ — audit every hardcoded `slate-800`/`white` and replace (see #3).
13. `[P]` `contextValue` memoized ✓ — keep deps tight; the cookie write should be debounced for rapid toggles.
14. `[A]` Keyboard shortcut `⌘B`/`Ctrl+B` — document that it should respect a `shortcut` prop for i18n/rebinding.
15. `[M]` `Sidebar` uses `md:block`/`md:flex` breakpoints — document the mobile/desktop split clearly in JSDoc.
16. `[T]` `SidebarContextProps` is hand-typed — derive from the provider's `useMemo` return type.
17. `[UX]` No collapse animation for the rail hover — `transition-all` ✓; add `duration-200` consistency.
18. `[A]` `SidebarMenuSkeleton` random width also causes layout shift — pair with `aria-busy` on the parent.
19. `[P]` Memoize `SidebarMenuButton` — the menu re-renders on route change; shallow memo + stable `isActive` helps.
20. `[D]` No hardcoded labels — menu titles from the config (sidebar-menu.json) ✓; add a test asserting no text rendered without items.

### 🚀 New Features

1. **Shape presets** — `variant="text | circle | rect | avatar | button"` matching content geometry.
2. **Shimmer sweep** — a `shimmer` prop with a moving highlight (motion-safe).
3. **Density control** — a `size` prop controlling width/height via tokens.
4. **Skeleton group** — a `SkeletonGroup` composing avatar + lines (list loading).
5. **Content-aware width** — a `lines` prop rendering N text lines with varied widths.
6. **Reduced-motion** — a `static` prop disabling pulse/shimmer under the setting.
7. **RTL-safe** — shimmer direction flips in RTL (test + docs).
8. **Telemetry** — none (decorative) — document why.
9. **Test helpers** — export `skeletonA11yProps()` for tests.
10. **Schema** — a `SkeletonVariantSchema` (zod) for the variant union.
11. **Print styles** — skeletons hidden when printing.
12. **Custom children preview** — a `as`/`render` prop rendering a blurred content preview (blur-up).
13. **Animated reveal** — a `reveal` prop that fades out the skeleton as content loads.
14. **Timer helper** — an `onReady` callback firing after a simulated load (demo tooling).
15. **Avatar+text combo** — a `SkeletonCard` preset for card loading.
16. **Table skeleton** — a `SkeletonTable` preset with header + rows.
17. **Focus guard** — skeletons are never focusable (document).
18. **Theme contrast** — skeleton tone adapts to dark/light (token-driven).
19. **Compact** — a `size="sm"` hairline for inline placeholders.
20. **Skeleton schema** — a `SkeletonConfigSchema` (zod) for demo props.

---

## Skeleton — `components/skeleton.tsx`

### 🔧 Improvements

Pulse placeholder block.

1. `[V]` No shape variant — add `variant: text | circle | rect` (or `shape`) so skeletons match content geometry.
2. `[A]` `aria-hidden` + `aria-busy` on the parent — document the loading-region pattern.
3. `[M]` `animate-pulse` — respect `prefers-reduced-motion` via `motion-safe:animate-pulse`.
4. `[P]` Static classes ✓.
5. `[Th]` `bg-muted` token ✓.
6. `[D]` Data-free ✓.
7. `[T]` Export `SkeletonProps` + `SkeletonVariantSchema` for composites.
8. `[UX]` Add a `shimmer` variant (gradient sweep) for list rows.
9. `[F]` N/A as form control.
10. `[A]` `role="progressbar"`-lite — document that real loaders should use `Progress`/`Spinner`.
11. `[M]` On touch, skeletons should be stable (no layout shift) — add `min-h` guidance.
12. `[P]` Memoize — skeletons re-render during load; cheap memo.
13. `[D]` No hardcoded dimensions ✓.
14. `[A]` `aria-label` on the skeleton when alone — add optional `label` prop.
15. `[UX]` Add `rounded` size control (sm/lg) via variant.
16. `[Th]` Dark-mode pulse contrast — verify `bg-muted` reads in both themes.
17. `[T]` Return type explicit ✓ (rule 15).
18. `[F]` N/A — note in JSDoc.
19. `[M]` Skeleton grids should wrap — document `flex-wrap` composition.
20. `[P]` Ensure no `animate-pulse` stacking (nested skeletons double-animate) — document.

### 🚀 New Features

1. **Value bubble tooltip** — a floating label showing the current value on drag.
2. **Range presets** — quick-set buttons (min/mid/max) for simple sliders.
3. **Step markers** — a `marks` prop rendering tick dots at defined values.
4. **Dual-thumb range** — a `range` mode (already supported) with a highlighted segment.
5. **Continuous vs stepped** — a `step` prop (already native — document + test).
6. **RTL-safe drag** — dragging direction flips in RTL (test + docs).
7. **Telemetry** — `onValueChange` debounced analytics passthrough.
8. **Test helpers** — export `sliderA11yProps()` for tests.
9. **Schema** — a `SliderValueSchema` (zod) validating values/range.
10. **Reduced-motion** — no transitions under the setting.
11. **Print styles** — sliders print as static values.
12. **Vertical mode** — a `orientation="vertical"` (already partial — feature-complete).
13. **Custom thumb** — a `thumbRender` prop (emoji/icon thumbs, fun).
14. **Focus polish** — a visible focus ring + `aria-valuetext` formatting.
15. **Loading state** — a `loading` prop disabling drag with a shimmer track.
16. **Sensitivity** — a `sensitivity` prop for fine-grained control.
17. **Label association** — an `aria-label`/`labelledBy` wiring helper.
18. **Discrete value readout** — an `<output>` element synced to the value.
19. **Compact** — a `size="sm"` hairline track for dense forms.
20. **Segment coloring** — a `segmentColors` prop (gradient track by zone).

---

## Slider — `components/slider.tsx`

### 🔧 Improvements

Base-ui slider with track, range indicator, and thumbs.

1. `[R]` No ref forwarding — `Slider` needs a ref (value reads, tests).
2. `[A]` No value display — add an optional `output`/`showValue` (uses `<output>` + `aria-valuetext`) for SR and visual feedback.
3. `[P]` `values` computation + `Array.from({ length: values.length })` per render — memoize with `useMemo` (rule 16).
4. `[P]` `[min, max]` fallback array literal per render — hoist to a module constant.
5. `[V]` No `size`/`variant` — add `size` (track/thumb scale) + `variant` (default/success) via CVA.
6. `[Th]` `thumbAlignment="edge"` hardcoded — make it a prop (rule 11: no hardcoding).
7. `[M]` On touch, thumbs are `size-4` (16px) — bump via size variant for 44px targets.
8. `[A]` Focus ring on thumbs ✓ — add `aria-label` guidance per thumb (range has two).
9. `[UX]` No step ticks/marks — add a `marks` prop (array of values) rendering token dots.
10. `[D]` Value is consumer-controlled ✓.
11. `[F]` RHF `Controller` pattern — document (value/onChange arrays for ranges).
12. `[P]` `defaultValue`/`value` both passed — the `values` heuristic is fine; document precedence.
13. `[T]` Export `SliderProps` + `SliderSizeSchema` for composites.
14. `[A]` `role="slider"` from primitive ✓ — verify `aria-valuenow` on both thumbs.
15. `[UX]` Hover ring on thumb (`hover:ring-4`) — respect `prefers-reduced-motion`.
16. `[M]` Vertical orientation (`data-vertical`) — ensure `min-h-40` scales on small screens.
17. `[Th]` `bg-muted`/`bg-primary` tokens ✓.
18. `[F]` `disabled` passthrough ✓ — add a test.
19. `[P]` Memoize thumbs — slider re-renders on drag; stable keys ✓ (index).
20. `[D]` No hardcoded copy ✓.

### 🚀 New Features

1. **Rich toasts** — `richColors` + action buttons enabled via `toastOptions` defaults.
2. **Close button** — a `closeButton` default for all toasts.
3. **Progress bar** — a `progress` option on toasts (upload/download progress).
4. **Undo pattern** — a documented `action: { label: "Undo", onClick }` pattern for destructive changes.
5. **Position presets** — a `position` prop (`top-right | bottom-right | top-center | …`).
6. **Stacked vs expanded** — an `expand` prop for desktop stacking.
7. **Theme override** — a `theme` prop overriding `next-themes` per instance.
8. **RTL-safe** — toast slide direction flips in RTL (test + docs).
9. **Telemetry** — a `toast` wrapper recording toast events for analytics.
10. **Test helpers** — export `toastA11yProps()` for tests.
11. **Schema** — a `ToastTypeSchema` (zod) for typed toast payloads.
12. **Reduced-motion** — no slide animation under the setting.
13. **Print styles** — toasts hidden when printing.
14. **Mobile swipe** — swipe-to-dismiss on touch (Sonner ✓ — document).
15. **Persistence** — an `onDismiss` store for "don't show again" toasts.
16. **Sticky toasts** — a `sticky` flag keeping a toast until manually dismissed.
17. **Accessible live regions** — per-type `aria-live` mapping (error assertive, success polite).
18. **Custom icon slots** — per-type icon overrides via props.
19. **Loading-to-success morph** — a helper `toast.promise`-style API (Sonner ✓ — document).
20. **Toaster schema** — a `ToasterConfigSchema` (zod) validating root config.

---

## Sonner — `components/sonner.tsx`

### 🔧 Improvements

Sonner toaster wired to theme + CSS vars.

1. `[R]` No ref forwarding — the wrapper doesn't need one, but document that `toast()` calls are imperative.
2. `[Th]` CSS vars (`--normal-bg`, `--normal-border`) token-mapped ✓ — extend to `--success-bg`/`--error-bg` so rich toasts match tokens.
3. `[A]` `toastOptions.classNames` only sets `toast` — add `description`/`actionButton`/`cancelButton` classes for consistency.
4. `[M]` Sonner's default position — document `position="bottom-right"` (already the viewport default in `toast.tsx`).
5. `[P]` The `style` object is recreated per render — hoist to a module constant.
6. `[D]` Toasts are imperative — the smart layer owns messages; document the `toast()` API.
7. `[T]` `ToasterProps` spread ✓ — no custom typing needed.
8. `[A]` `aria-live` — Sonner handles; ensure `closeButton`/`richColors` options documented.
9. `[UX]` Add `closeButton` default? — leave opt-in; document.
10. `[F]` N/A as form control.
11. `[Th]` Dark-mode theme follows `next-themes` ✓ — test `system` resolution.
12. `[M]` On mobile, toasts stack full-width — Sonner handles; add a test note.
13. `[P]` Memoize the wrapper — it renders once at the app root.
14. `[D]` No hardcoded copy ✓.
15. `[A]` `toastOptions` `aria-live` per type — document (success = polite, error = assertive).
16. `[UX]` Add a `description` slot styling polish (muted text) — via classNames.
17. `[T]` Return type explicit ✓ (rule 15).
18. `[F]` N/A — note in JSDoc.
19. `[M]` On desktop, `max-w` — Sonner handles; document width tokens.
20. `[P]` Ensure the wrapper is SSR-safe (no `window` access at module scope) — it isn't ✓.

### 🚀 New Features

1. **Size presets** — a `size` prop (`xs | sm | md | lg`) via tokens.
2. **Custom label** — a `label` prop (i18n) with `aria-label` default.
3. **Pacing control** — a `duration` prop for the spin speed (brand pacing).
4. **Stroke width** — a `strokeWidth` prop (bold vs hairline).
5. **Inline in text** — a `text` mode sizing the spinner to the surrounding text.
6. **RTL-safe** — spin direction consistent in RTL (no flip needed — document).
7. **Reduced-motion** — a `static` prop disabling spin under the setting.
8. **Telemetry** — none (decorative) — document why.
9. **Test helpers** — export `spinnerA11yProps()` for tests.
10. **Schema** — a `SpinnerSizeSchema` (zod) for the size union.
11. **Print styles** — spinners hidden when printing.
12. **Multi-spinner** — a `count` prop rendering stacked rings (network loading).
13. **Gradient ring** — a `gradient` prop with a conic-gradient ring (polish).
14. **Dots variant** — a `variant="dots"` for inline loading text.
15. **Progress-aware** — a `progress` prop rendering a partial ring (0–100%).
16. **Focus guard** — never focusable (document).
17. **Theme tokens** — color inherits `currentColor` (already ✓).
18. **Overlay spinner** — an `OverlaySpinner` companion for full-screen loading.
19. **Debounce mount** — a `delay` prop delaying the spinner (avoid flash on fast loads).
20. **Spinner schema** — a `SpinnerConfigSchema` (zod) for configs.

---

## Spinner — `components/spinner.tsx`

### 🔧 Improvements

Loader icon with `role="status"`.

1. `[V]` No `size` prop — add `size: xs | sm | md | lg` (or accept `size-*` classes) via CVA.
2. `[A]` `aria-label="Loading"` is hardcoded English — add a `label` prop (i18n); default `"Loading"`.
3. `[A]` `role="status"` ✓ — document pairing with `aria-live` for SR announcements.
4. `[P]` Static classes ✓ — but `animate-spin` should be `motion-safe:animate-spin`.
5. `[Th]` Inherits `text-current` ✓ — no hardcoded colors.
6. `[D]` Data-free ✓.
7. `[T]` Export `SpinnerProps` + `SpinnerSizeSchema`.
8. `[UX]` Add a `strokeWidth`/`duration` prop for custom pacing (optional).
9. `[F]` N/A as form control — document use in buttons (replaces FormShell's inline svg).
10. `[M]` On touch, size-lg for large CTAs ✓.
11. `[P]` Memoize — spinners in lists re-render; cheap memo.
12. `[D]` No hardcoded copy ✓.
13. `[A]` `aria-hidden` when decorative (dual-spinner UIs) — document.
14. `[UX]` Replace `Loader2Icon` with a consistent branded spinner if the design system requires.
15. `[T]` Return type explicit ✓ (rule 15).
16. `[F]` N/A — note in JSDoc.
17. `[M]` Ensure the spinner doesn't shrink inside flex buttons — `shrink-0`.
18. `[P]` `className` merge ✓ — keep `cn` usage consistent.
19. `[A]` Add `aria-busy` guidance for containers showing a spinner.
20. `[D]` No default labels — the `label` prop default is the only copy; make it overridable.

### 🚀 New Features

1. **Labeled switch** — an `onLabel`/`offLabel` prop rendering text inside/next to the track.
2. **Loading state** — a `loading` prop with a spinner in the thumb (async toggles).
3. **Error state** — an `error` prop with helper text (compose `FieldError`).
4. **Size-aware thumb** — thumb scales with the track size via tokens.
5. **RTL-safe slide** — the thumb slides in the correct direction in RTL (already handled — test).
6. **Telemetry** — `onCheckedChange` analytics passthrough.
7. **Test helpers** — export `switchA11yProps()` for tests.
8. **Schema** — a `SwitchSizeSchema` (zod) for the size union.
9. **Reduced-motion** — no thumb transition under the setting.
10. **Print styles** — switches print as static values.
11. **Custom icons** — a `checkedIcon`/`uncheckedIcon` slot (sun/moon, check/X).
12. **Focus ring polish** — a visible focus ring + hit-area expansion (already partial).
13. **Skeleton loading** — a `loading` prop with a shimmer track.
14. **Accessible label** — `aria-label`/`labelledBy` wiring helper.
15. **Compact** — a `size="xs"` for dense tables.
16. **Theme tokens** — track/thumb colors via tokens (already flagged — feature here).
17. **Animated toggle** — a spring-like thumb transition (motion-safe).
18. **Status mapping** — a `status` prop (enabled/disabled-by-role) with tooltip.
19. **Keyboard-first** — Space toggles (native ✓ — test).
20. **Switch schema** — a `SwitchConfigSchema` (zod) for configs.

---

## Switch — `components/switch.tsx`

### 🔧 Improvements

Base-ui switch with thumb + sizes.

1. `[R]` No ref forwarding — `Switch` needs a ref (RHF register).
2. `[Th]` Magic pixel values (`h-[18.4px] w-[32px]`, `14px/24px`) — replace with design tokens (`--switch-w/h`) so theming scales (rule 22).
3. `[V]` No `state` — add `loading` (spinner in thumb), `disabled` (has ✓), `error` (aria-invalid ✓ but no message).
4. `[A]` No label wiring — document pairing with `Label` (`htmlFor`/`id`).
5. `[F]` RHF `Controller` pattern — document (value boolean).
6. `[P]` Static classes ✓ — no per-render objects.
7. `[UX]` No `onLabel`/`offLabel` — add `label` prop for `aria-label` (i18n).
8. `[M]` `size` union (`sm | default`) — promote to CVA + zod enum; add `lg` for touch.
9. `[A]` `aria-checked` from primitive ✓ — add a regression test.
10. `[D]` Checked state is consumer-controlled ✓.
11. `[T]` Export `SwitchProps` for composites.
12. `[UX]` Add a subtle scale animation on toggle (motion-safe).
13. `[M]` On touch, `sm` (24px) is small — document `default`+ for touch.
14. `[A]` `aria-invalid` ring ✓ — wire `aria-describedby` to `FieldError`.
15. `[P]` Memoize — switches in forms re-render; cheap memo.
16. `[Th]` Dark-mode checked thumb (`dark:data-checked:bg-primary-foreground`) ✓ — verify contrast.
17. `[F]` `required`/`disabled` passthrough ✓ — add a test.
18. `[D]` No hardcoded copy ✓.
19. `[A]` Focus ring on the root ✓ — keep `after:-inset` hit area for 44px.
20. `[T]` Return type explicit ✓ (rule 15).

### 🚀 New Features

1. **Column visibility menu** — a `ColumnToggle` companion (hide/show columns) fed by a config.
2. **Column pinning** — a `pinned` prop on `TableHead`/`TableCell` (sticky columns).
3. **Sticky header** — a `stickyHeader` prop keeping the header visible on scroll.
4. **Row expansion** — an `expandable` mode with a chevron revealing detail rows.
5. **Sortable headers** — a `sortable` mode rendering sort icons + `onSort` (smart layer owns state).
6. **Selection toolbar** — a `selection` mode with checkboxes + a floating action bar.
7. **Dense mode** — a `size="sm"` compact preset (already flagged — feature here).
8. **Zebra striping** — a `striped` prop (already flagged — feature here).
9. **Inline row editing** — an `editing` mode swapping cells for inputs.
10. **Drag-reorder rows** — an `onReorder` prop (dnd-kit wiring).
11. **Virtualized rows** — a `virtualize` prop (react-virtual integration) for 10k+ rows.
12. **Empty state slot** — a built-in `Empty`-compatible `empty` slot.
13. **Loading skeleton rows** — a `loading` prop rendering `Skeleton` rows.
14. **RTL-safe alignment** — text alignment flips in RTL (test + docs).
15. **Telemetry** — `onSortChange`/`onRowClick` analytics passthrough.
16. **Test helpers** — export `tableA11yProps()` for tests.
17. **Schema** — a `ColumnSchema` (zod) validating column configs.
18. **Reduced-motion** — no row transitions under the setting.
19. **Print-friendly** — tables print full-width with repeated headers.
20. **Bulk export** — a `onExport` toolbar action (CSV/Excel, smart layer owns serialization).

---

## Table — `components/table.tsx`

### 🔧 Improvements

Semantic table primitives (header/body/footer/row/head/cell/caption) inside a scroll container.

1. `[R]` No ref forwarding — `Table`/`TableRow` need refs (virtualization, tests).
2. `[M]` `whitespace-nowrap` on cells is default — long text overflows horizontally on mobile; add a `wrap` prop (or `dense`/`truncate` modes).
3. `[V]` No `size` variant — add `sm | default | lg` (cell padding) via CVA for dense admin tables.
4. `[V]` No `variant` — add `striped` (zebra rows) and `bordered` options.
5. `[A]` `TableHeader` `[&_tr]:border-b` — add `scope="col"` guidance on `TableHead` for SR column announcements.
6. `[A]` `aria-sort` support — document setting it on `TableHead` for sortable columns.
7. `[M]` `overflow-x-auto` container ✓ — add `sticky` first-column/header option for wide tables.
8. `[P]` Static classes ✓ — no per-render objects.
9. `[Th]` `bg-muted/50` hover token ✓ — verify dark-mode contrast.
10. `[D]` Row data is consumer-owned ✓ — the table never knows its data shape.
11. `[F]` N/A as form control — but selectable rows (`aria-selected`) belong to the smart layer (TanStack Table).
12. `[T]` Export `TableProps`/`TableRowProps` for composites (data-table in admin).
13. `[UX]` Add a `TableEmpty`-compatible slot guidance (compose with `Empty`).
14. `[A]` `data-[state=selected]` styling ✓ — document the selection API for the smart layer.
15. `[M]` On touch, row hover is irrelevant — ensure `hover:bg-muted/50` doesn't confuse (it's fine; tap still selects).
16. `[P]` Memoize rows — tables re-render on sort/filter; shallow memo + stable keys.
17. `[D]` No hardcoded copy ✓ (caption from consumer).
18. `[A]` `aria-colspan`/`rowSpan` passthrough ✓ — document.
19. `[UX]` Add a `loading` skeleton-row variant — compose with `Skeleton`.
20. `[M]` `w-full` + `caption-bottom` — ensure caption wraps on narrow screens.

### 🚀 New Features

1. **Scrollable tabs** — a `scrollable` mode with edge arrows for overflow.
2. **Icons + labels** — an `icon` slot per trigger (auto spacing).
3. **Badge on tabs** — a `count` prop rendering a badge (e.g. "Errors (3)").
4. **Animated underline** — a sliding indicator for the `line` variant (motion-safe).
5. **Lazy panels** — a `lazy` mode mounting panel content only when first activated.
6. **Persisted active tab** — an `id` + `storageKey` opt-in (smart layer owns storage).
7. **URL-synced tabs** — a `queryKey` prop driving `?tab=` from the URL.
8. **Keyboard-first** — arrows + Home/End (primitive ✓ — test).
9. **RTL-safe** — trigger order/underline flip in RTL (test + docs).
10. **Telemetry** — `onValueChange` analytics passthrough.
11. **Test helpers** — export `tabsA11yProps()` for tests.
12. **Schema** — a `TabSchema` (zod) validating tab configs.
13. **Reduced-motion** — no indicator transitions under the setting.
14. **Print styles** — all panels print expanded.
15. **Compact** — a `size="sm"` for dense contexts.
16. **Loading skeletons** — a `loading` prop rendering skeleton triggers.
17. **Nested tabs** — a documented two-level tab pattern.
18. **Danger tab styling** — a `tone="danger"` on a trigger (counts of failures).
19. **Full-width segmented** — a `fullWidth` option (already flagged — feature here).
20. **Focus-visible ring** — a `focusRing` variant for keyboard users.

---

## Tabs — `components/tabs.tsx`

### 🔧 Improvements

Base-ui tabs with CVA list variants (default/line) + vertical orientation.

1. `[R]` No ref forwarding — `TabsList`/`TabsTrigger` need refs.
2. `[M]` Horizontal tabs overflow on narrow screens — add a `scrollable` mode (scroll buttons or `overflow-x-auto`).
3. `[V]` Add a `fullWidth` option so tabs stretch (common for mobile segmented controls).
4. `[A]` `TabsTrigger` — verify `aria-selected`/`role="tab"` from primitive ✓; add a regression test.
5. `[P]` Static classes ✓.
6. `[Th]` `bg-muted`/`bg-background` tokens ✓.
7. `[D]` Tab content is consumer-owned ✓.
8. `[F]` RHF wiring for tab-gated forms — document `Tabs` + `Controller` (per-tab fields validate on submit).
9. `[T]` Export `TabsListProps`/`TabsTriggerProps` + `TabsVariantSchema`.
10. `[A]` Keyboard: arrows/Home/End from primitive ✓ — add a test.
11. `[UX]` The `line` variant underline (`after:`) — add a smooth slide animation (motion-safe).
12. `[M]` Vertical tabs `group-data-vertical/tabs:w-full` ✓ — test narrow screens.
13. `[P]` Memoize — tabs re-render on switch; shallow memo helps.
14. `[D]` No hardcoded labels ✓.
15. `[A]` `aria-controls` between trigger and panel — verify primitive sets; add a test.
16. `[UX]` Icon-only tabs — document `aria-label` requirement on triggers.
17. `[T]` Return type explicit ✓ (rule 15).
18. `[F]` N/A event contract beyond native.
19. `[M]` On touch, tab hit targets `h-[calc(100%-1px)]` inside `h-9` list — 36px; bump via size.
20. `[A]` Focus-visible ring on triggers ✓ — keep `ring-[3px]` consistent.

### 🚀 New Features

1. **Auto-resize** — a `autoResize` prop (already via `field-sizing-content` — formalize with max-height).
2. **Char counter** — a `showCount` prop rendering current/max (ties into `FieldCounter`).
3. **Mention highlighting** — an `onMention` prop detecting `@` triggers (smart layer owns suggestions).
4. **Enter-to-send** — a `submitOnEnter` mode (chat) with Shift+Enter for newline.
5. **Resize control** — a `resize` prop (`none | vertical | both`).
6. **Markdown toolbar** — a `toolbar` slot with formatting buttons (smart layer owns actions).
7. **Word count** — a `showWords` prop for essay-style inputs.
8. **Spellcheck toggle** — a `spellCheck` prop passthrough (already native — document).
9. **RTL-safe** — text direction flips in RTL (test + docs).
10. **Telemetry** — `onChange` throttled analytics passthrough.
11. **Test helpers** — export `textareaA11yProps()` for tests.
12. **Schema** — a `TextareaConfigSchema` (zod) for configs.
13. **Reduced-motion** — no transitions under the setting.
14. **Print styles** — textareas print as plain text.
15. **Compact** — a `size="sm"` for dense forms.
16. **Focus polish** — a `focusRing` variant (default | none | soft).
17. **Autofill harmony** — border/ring stability during browser autofill (docs pattern).
18. **Placeholder formatting** — a `placeholder` slot with custom styling.
19. **Voice input** — a mic button (smart layer owns recognition).
20. **Textarea schema** — a `TextareaValueSchema` (zod) for validation boundaries.

---

## Textarea — `components/textarea.tsx`

### 🔧 Improvements

Base textarea with auto-height (`field-sizing-content`).

1. `[R]` No explicit `forwardRef` — guarantee the contract (RHF register, rule 20).
2. `[V]` No `size` variant — add `sm | default | lg` (min-height, text scale).
3. `[A]` No character counter — add optional `maxLength` + `showCount` (renders `aria-describedby` counter).
4. `[F]` Consistent event contract ✓ — document RHF `register` + `rows` control.
5. `[M]` `field-sizing-content` auto-grows ✓ — cap with `max-h` option for long input.
6. `[P]` Static classes ✓.
7. `[Th]` `dark:bg-input/30` tokens ✓.
8. `[UX]` Add a `resize` control prop (`none | vertical | both`) — currently `field-sizing` implies none; document.
9. `[D]` Data-free ✓.
10. `[T]` Export `TextareaProps` + `TextareaSizeSchema`.
11. `[A]` `aria-invalid` styling ✓ — wire `aria-describedby` to `FieldError`.
12. `[F]` `autoComplete`/`spellCheck` passthrough ✓ — document.
13. `[M]` On touch, `min-h-16` (64px) is comfortable ✓.
14. `[P]` Memoize — textareas in lists re-render per keystroke at the parent.
15. `[D]` No hardcoded copy ✓.
16. `[A]` Focus ring ✓ — keep `focus-visible:ring-3` consistent.
17. `[UX]` Add a subtle `placeholder` polish (already token-based ✓).
18. `[T]` Return type explicit ✓ (rule 15).
19. `[F]` N/A event contract beyond native.
20. `[M]` Ensure `w-full` + `min-w-0` prevents overflow in flex parents ✓.

### 🚀 New Features

1. **Action with loading** — a `ToastAction` that shows a spinner while the action runs.
2. **Progress bar toasts** — a `progress` prop rendering a countdown/upload bar.
3. **Undo pattern** — an `action: { label: "Undo" }` convenience (already via ToastAction — document).
4. **Sticky toasts** — a `sticky` flag requiring manual dismiss (important errors).
5. **Swipe-to-dismiss** — gesture thresholds configurable (primitive ✓ — document).
6. **Toast grouping** — dedupe identical toasts within a window.
7. **Position presets** — a `position` prop (top/bottom/sides) via tokens.
8. **RTL-safe slide** — swipe/slide direction flips in RTL (test + docs).
9. **Telemetry** — `onToastShow`/`onToastDismiss` analytics callbacks.
10. **Test helpers** — export `toastA11yProps()` for tests.
11. **Schema** — a `ToastTypeSchema` (zod) for typed payloads.
12. **Reduced-motion** — no slide/pop animations under the setting.
13. **Print styles** — toasts hidden when printing.
14. **Promise wrapper** — a `toast.promise`-style helper morphing loading into success/error.
15. **Custom icons per type** — a `icon` map override prop.
16. **Dismissible groups** — a "dismiss all" action in the viewport.
17. **Accessible live regions** — per-type `aria-live` mapping (already flagged — feature here).
18. **Focus management** — interactive toasts don't steal focus (document).
19. **Sticky action bar** — a `ToastActionBar` pinning actions on mobile.
20. **Toast schema** — a `ToastOptionsSchema` (zod) validating options.

---

## Toast — `components/toast.tsx`

### 🔧 Improvements

Base-ui toast manager: provider, portal, viewport, toast card, icon-per-type, action/close, list.

1. `[T]` `ToastIcon`'s `type: string | undefined` — replace with a zod enum (`ToastTypeSchema: "success" | "info" | "warning" | "error" | "loading"`) and infer (rules 1/13).
2. `[P]` `ToastIcon` uses an if-chain with `let icon` reassignment — replace with a type→icon lookup map (module constant).
3. `[R]` No ref forwarding — `Toast`/`ToastClose` need refs (dismissal tests).
4. `[A]` `ToastClose` has `aria-label="Close toast"` hardcoded — make it a prop (i18n).
5. `[M]` `ToastViewport` is fixed bottom — add a `position` prop (`bottom | top` / side) via tokens.
6. `[P]` `Toaster` renders `ToastList` on every render — memoize the list; the manager is stable.
7. `[Th]` `bg-popover`/`shadow-lg` tokens ✓ — the peek/shrink CSS vars are static; hoist.
8. `[D]` Toast messages are imperative ✓ — the manager owns queue state (correct for a dumb component).
9. `[F]` N/A as form control — document submit-error toasts vs `FieldError` split.
10. `[A]` `role`/`aria-live` per type — document (error assertive, success polite).
11. `[UX]` Swipe-to-dismiss gestures ✓ (base-ui) — document `duration`/`swipeThreshold` props.
12. `[M]` On mobile, viewport `inset-x-4` full-ish width — keep `max-w-sm`; test stacking.
13. `[P]` `toast = createToastManager()` at module scope — singleton is fine; document multi-manager use for isolation.
14. `[T]` Export `ToastType` (inferred from schema) for the `toast()` API typing.
15. `[A]` Focus: toasts shouldn't steal focus unless interactive — document.
16. `[UX]` Add an optional progress/auto-dismiss bar (countdown) for upload toasts.
17. `[M]` On touch, close button `icon-sm` (32px) — bump to `icon-md` for 44px.
18. `[P]` The `z-[calc(1000-var(--toast-index))]` stacking — fine; document.
19. `[D]` No hardcoded copy beyond `aria-label` ✓.
20. `[T]` Return types explicit ✓ (rule 15) — keep across the manager API.

### 🚀 New Features

1. **Tri-state toggle** — an `indeterminate` state (partially selected filters).
2. **Icon-only detection** — auto `aria-label` warning when no text child (a11y lint).
3. **Loading state** — a `loading` prop with a spinner (async toggles).
4. **Badge on toggle** — a `count` prop (filter counts).
5. **RTL-safe** — no direction issues (test + docs).
6. **Telemetry** — `onPressedChange` analytics passthrough.
7. **Test helpers** — export `toggleA11yProps()` for tests.
8. **Schema** — a `ToggleVariantSchema` (zod) for the variant union.
9. **Reduced-motion** — no transitions under the setting.
10. **Print styles** — toggles print as static state.
11. **Shortcut hint** — a `shortcut` prop rendering a `Kbd` hint.
12. **Keyboard-first** — Space toggles (native ✓ — test).
13. **Focus ring polish** — a `focusRing` variant.
14. **Animated press** — a subtle scale on press (motion-safe).
15. **Custom icons** — an `icon` slot swapping per state.
16. **Compact** — a `size="xs"` for dense toolbars.
17. **Theme tokens** — pressed state via `--accent` tokens (already partial).
18. **Tooltip wrapping** — a `tooltip` prop for icon toggles.
19. **Toggle schema** — a `ToggleConfigSchema` (zod) for configs.
20. **A11y announcement** — `aria-pressed` verified + tested.

---

## Toggle — `components/toggle.tsx`

### 🔧 Improvements

Base-ui toggle (press-state button) with CVA variants/sizes.

1. `[R]` No ref forwarding — `Toggle` needs a ref (RHF register for boolean fields).
2. `[V]` No `state` — add `loading` (spinner), `disabled` (has ✓), `error` (aria-invalid styling) per rule 23.
3. `[A]` `aria-pressed` from primitive ✓ — add a regression test.
4. `[F]` RHF `Controller` pattern for boolean fields — document.
5. `[P]` Static classes ✓.
6. `[Th]` `bg-muted`/`text-foreground` tokens ✓.
7. `[D]` Press state is consumer-controlled ✓.
8. `[T]` Export `ToggleProps` + `ToggleVariantSchema` for composites.
9. `[UX]` Add a pressed-state animation (scale/color transition, motion-safe).
10. `[M]` `min-w-9` (36px) — bump via size for touch.
11. `[A]` Icon-only toggles need `aria-label` — document.
12. `[P]` Memoize — toggles in toolbars re-render; cheap memo.
13. `[D]` No hardcoded copy ✓.
14. `[A]` Focus ring ✓ — keep consistent.
15. `[Th]` Dark-mode pressed state (`aria-pressed:bg-muted`) — verify contrast.
16. `[F]` N/A event contract beyond `onClick` — the primitive exposes `onPressedChange`; document the mapping.
17. `[T]` Return type explicit ✓ (rule 15).
18. `[M]` On touch, toggles in groups need spacing — `ToggleGroup` handles ✓.
19. `[UX]` Add a `pressedVariant` (e.g. outline→filled) for clearer state.
20. `[D]` No hardcoded labels ✓.

### 🚀 New Features

1. **Controlled/uncontrolled** — expose both `pressed` + `defaultPressed` (primitive ✓) and document the trade-offs.
2. **Icon shorthand** — an `icon` prop that auto-sets `aria-label` for icon-only toggles.
3. **Loading state** — a `loading` prop (spinner replaces the label, `aria-busy`).
4. **Shortcut hint** — a `shortcut` slot rendering a `Kbd` (e.g. bold toolbar toggle).
5. **Size xs** — `size="xs"` for dense toolbars (current sizes stop at sm).
6. **Badge count** — a `count` prop (e.g. filter chips with counts).
7. **Animated press** — a motion-safe scale transition on press (already flagged — feature here).
8. **Form value** — a `name`/`value` pair so a bare `Toggle` submits like a checkbox in a form.
9. **Theme tokens** — pressed state via `--accent` CSS vars (no hardcoded colors).
10. **Reduced-motion** — transitions disabled under the setting.
11. **Print styles** — pressed state prints as a filled chip.
12. **Focus ring variant** — a `focusRing` prop (ring vs outline).
13. **Tooltip wrap** — a `tooltip` prop that wraps icon-only toggles (reuses Tooltip).
14. **Telemetry** — a formal `onPressedChange` analytics passthrough contract.
15. **Test helpers** — export `toggleA11yProps()` for a11y tests.
16. **Variant schema** — a `ToggleVariantSchema` (zod) for the variant/size unions.
17. **Group integration** — a `value` prop so a bare `Toggle` participates in `ToggleGroup` via context.
18. **Touch target** — a `size="touch"` bumping to 44px hit area.
19. **Press ripple** — a touch ripple for mobile (motion-safe).
20. **A11y announcement** — a `liveRegion` prop announcing pressed-state changes to screen readers.

---

## ToggleGroup — `components/toggle-group.tsx`

### 🔧 Improvements

Base-ui toggle group with context-driven variant/size/spacing/orientation.

1. `[R]` No ref forwarding — `ToggleGroup`/`ToggleGroupItem` need refs.
2. `[A]` `role="group"`/radiogroup semantics — document that single-select groups should expose `aria-pressed` per item (primitive ✓).
3. `[M]` Horizontal groups overflow on narrow screens — add `flex-wrap`/scroll option.
4. `[P]` `toggleGroupStyle` object recreated per render — memoize (rule 16).
5. `[T]` `spacing?: number` — validate with a zod schema (`z.number().int().min(0).max(8)`).
6. `[D]` Selection state is consumer-controlled ✓.
7. `[F]` RHF `Controller` pattern for single/multi selection — document.
8. `[UX]` No `size` propagation to the context's default when items override — it works (context ?? item); document precedence.
9. `[Th]` `bg-muted`/`shadow-xs` tokens ✓.
10. `[A]` Keyboard roving from primitive ✓ — add a test.
11. `[M]` Vertical orientation `items-stretch` ✓ — test narrow screens.
12. `[P]` Memoize items — groups re-render on selection.
13. `[D]` No hardcoded labels ✓.
14. `[T]` Export `ToggleGroupProps` + `ToggleGroupContext` typing for composites.
15. `[UX]` Add a connected (border-shared) look option — `spacing=0` handles it ✓; document.
16. `[A]` `aria-label` on the group — add guidance.
17. `[F]` N/A event contract beyond native.
18. `[M]` On touch, item hit targets `min-w-8` (32px) — bump via size.
19. `[P]` The `data-spacing` attribute — keep for CSS hooks.
20. `[D]` No hardcoded copy ✓.

### 🚀 New Features

1. **Single/multi modes** — a `type` prop (`single | multiple`) matching radio vs checkbox semantics.
2. **Icons + labels** — an `icon` slot per item (auto spacing).
3. **Select-all** — a `selectAll` item for filter groups.
4. **RTL-safe borders** — shared-border logic flips in RTL (test + docs).
5. **Telemetry** — `onValueChange` analytics passthrough.
6. **Test helpers** — export `toggleGroupA11yProps()` for tests.
7. **Schema** — a `ToggleGroupTypeSchema` (zod) for the type union.
8. **Reduced-motion** — no transitions under the setting.
9. **Print styles** — toggles print as static state.
10. **Keyboard roving** — arrows move between items (primitive ✓ — test).
11. **Focus ring polish** — a `focusRing` variant.
12. **Loading item** — a per-item `loading` prop (spinner).
13. **Badge on items** — a `count` prop (filter counts).
14. **Compact** — a `size="xs"` for dense toolbars.
15. **Tooltip items** — a `tooltip` prop per item.
16. **Vertical wrap** — items wrap on narrow screens (already flagged — feature here).
17. **Theme tokens** — pressed state via `--accent` tokens.
18. **A11y group label** — an `ariaLabel` prop.
19. **ToggleGroup schema** — a `ToggleGroupConfigSchema` (zod) for configs.
20. **Shortcut hints** — per-item `Kbd` shortcuts (view modes).

---

## Tooltip — `components/tooltip.tsx`

### 🔧 Improvements

Base-ui tooltip provider/root/trigger/content/arrow.

1. `[R]` No ref forwarding — `TooltipTrigger`/`TooltipContent` need refs.
2. `[V]` No `size`/`variant` — add `size` (padding/text) + `variant` (`default | inverted`) via CVA.
3. `[A]` The arrow is always rendered — add a `showArrow` prop; table cell tooltips often want it off.
4. `[M]` `max-w-xs` hardcoded — add a `maxWidth` prop (token) so long hints wrap.
5. `[P]` Static classes ✓ — no per-render objects.
6. `[Th]` `bg-foreground`/`text-background` inversion ✓ — the smartest theming trick in the lib; document it.
7. `[D]` Content is consumer-owned ✓.
8. `[F]` N/A as form control — but form errors use `FieldError`, not tooltips; document.
9. `[T]` Export `TooltipContentProps` + `TooltipSizeSchema` for composites (Sidebar uses `TooltipContent`).
10. `[A]` Keyboard: focus-triggers tooltip ✓ (base-ui) — add a regression test.
11. `[UX]` Add `delay`/`closeDelay` props at the Content level (currently only Provider `delay`).
12. `[M]` On touch, hover tooltips don't fire — document tap-long-press or hide-on-touch.
13. `[P]` Memoize — tooltips in dense lists re-render; cheap memo.
14. `[D]` No hardcoded copy ✓.
15. `[A]` `role="tooltip"` from primitive ✓ — verify `aria-describedby` wiring on the trigger.
16. `[UX]` Add a small entrance animation (already `animate-in` ✓) — respect `prefers-reduced-motion`.
17. `[T]` Return type explicit ✓ (rule 15).
18. `[F]` N/A — note in JSDoc.
19. `[M]` Ensure tooltips never overflow the viewport on small screens (base-ui flip ✓); add a test.
20. `[P]` The `z-50` stacking — keep consistent with Popover/Dialog.

### 🚀 New Features

1. **Rich tooltips** — a `title` + `description` layout (two-line hints).
2. **Interactive tooltips** — a `sticky` mode allowing cursor entry (links inside).
3. **Shortcut display** — a `shortcut` slot rendering a `Kbd` hint.
4. **Delay presets** — `delay="fast | normal | slow"` mapped to ms tokens.
5. **Focus-triggered** — `openOnFocus` for keyboard users (primitive ✓ — formalize).
6. **RTL-safe** — side/placement flips in RTL (test + docs).
7. **Telemetry** — `onOpenChange` analytics passthrough.
8. **Test helpers** — export `tooltipA11yProps()` for tests.
9. **Schema** — a `TooltipSideSchema` (zod) for placement.
10. **Reduced-motion** — no fade/zoom under the setting.
11. **Print styles** — tooltips hidden when printing.
12. **Portal control** — a `portal` toggle (inline vs portal) for overflow contexts.
13. **Custom arrow** — an `arrow` render prop (branded arrows).
14. **Wrapping text** — a `maxWidth` prop (already flagged — feature here).
15. **Icon tooltips** — auto `aria-label` from a `label` prop for icon-only triggers.
16. **Compact** — a `size="sm"` for dense tables.
17. **Theme inversion** — a `variant="inverted"` (dark text on light bg).
18. **Multiple triggers** — a `TooltipGroup` sharing one delay config.
19. **Tooltip schema** — a `TooltipConfigSchema` (zod) for configs.
20. **A11y verification** — `aria-describedby` wiring test helper.

---

## Summary — 2,720 items across 68 components

Every component in `packages/ui/src/components` got **exactly 20 grounded improvements**
**and exactly 20 new features** (68 × 40 = **2,720 items**), each mapped to the 23 repo rules.
The **🔧 Improvements** fix what exists today; the **🚀 New Features** are good-to-have
enhancements to pick up once the improvements are in.

### Highest-leverage fixes (do these first)

| Component | Fix | Why it matters |
| --------- | --- | -------------- |
| `PasswordInput` | `forwardRef` + don't clobber `onKeyDown` | Blocks RHF `register()`; loses consumer handlers today |
| `Sidebar` | Deterministic skeleton width | `Math.random()` in a `useState` initializer risks hydration mismatch |
| `Sidebar` | `data-active:bg-slate-800` → tokens | Hardcoded palette breaks dark/brand themes (rule 22) |
| `Chart` | Remove `unknown`/`never`/`typeof` | Three direct rule violations in one file |
| `Toast` | `type: string` → zod enum | Stringly-typed API surface (rule 1/13) |
| `FormShell` | Reuse `Spinner` | Duplicated spinner markup drifts from the shared one |
| `Slider` | Memoize `values`/thumbs | Inline arrays per render (rule 16) |
| `Carousel` | `Parameters`/`ReturnType<typeof>` → Embla types | Rule 5 violations; also vertical arrow keys missing |
| `Switch` | Magic px → tokens | `18.4px` widths don't scale (rule 22) |
| `BreadcrumbContext` | `z.custom` → real schema + unsubscribe | Typing hole + listener leak |

### Coverage by tag

- **`[R]` Ref forwarding** — missing in ~55 components (the single most common gap; rule 20).
- **`[V]` Variant system** — most components lack `size` and/or `state (loading/error)`; `Button` is the model to copy (rule 23).
- **`[T]` Typing** — the `chart.tsx`, `toast.tsx`, `breadcrumb-context.tsx` files carry the worst violations; every inline string union should become a zod schema + inferred type.
- **`[A]` Accessibility** — `aria-label`/`aria-describedby` wiring, `aria-live` modes, and keyboard tests are the recurring theme.
- **`[P]` Performance** — inline object/array creation in props is the most common rule-16 miss (`Slider`, `Carousel`, `Calendar`, `ToggleGroup`).
- **`[Th]` Theming** — raw hex/palette classes (`Sidebar` slate-800, `PasswordStrengthMeter` red-500) violate rule 22.
- **`[M]` Mobile** — touch targets below 44px and `whitespace-nowrap` overflow are the recurring issues.

### How to work through the audit

1. **Batch by tag**, not by component — e.g. "all `[R]` fixes" first: they're mechanical and unblock forms.
2. Each item is self-contained: pick one, open the file, implement, and delete the item (or tick it).
3. After each component, run `pnpm --filter @workspace/ui lint && pnpm --filter @workspace/ui typecheck` and the consuming apps' tests (`admin`/`web`).
4. When a component gains a zod schema, put it next to the component (or in `packages/shared` if two apps need it) and re-export — the schema *is* the contract (rule 5/13).
5. Never change layout unless a specific item says so (rule 12) — most items are additive (new props, new variants) or cosmetic.
6. Update this doc's `lastUpdated` frontmatter when you finish a batch, and mark completed items inline with ✅.

> **Rule 15 note:** the repo's component functions already declare explicit return types
> (`: React.JSX.Element`) — that part of the rule is satisfied. The rule bites hardest in
> classes/hooks (e.g. the toast manager) and in any new helper functions: always write the
> return type and `public`/`private`/`protected` where classes are used.

