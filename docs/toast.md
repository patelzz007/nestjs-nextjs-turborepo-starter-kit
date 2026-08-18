---
title: "Toast & Toastr"
tags: ["toast", "notifications", "ui", "sonner", "migration"]
description: "The in-house base-ui Toast & Toastr manager — the typed toastMessage API (success/info/warning/error/loading/promise), six placements, progress bars, countdown bars, soft-solid theming, and the sonner migration that removed ~80 call sites."
order: 20
author: "Acme Inc."
lastUpdated: 1787011200000
coverImage: "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1600&q=80"
---

# Toast & Toastr

> [!NOTE] **What this is.** The repo's one toast system: a wrapper around base-ui's `Toast`
> manager with a typed imperative API (`toastMessage`), soft-solid per-type theming, six
> placements, an auto-dismiss **countdown bar** (with a ticking "Dismisses in Xs" label that
> freezes on hover/window-blur, in sync with base-ui's own timer), a manual **progress bar**
> via the `data` slot, and swipe-to-dismiss. It replaced sonner across the admin + docs apps —
> see [§Migration](#from-sonner).
>
> **Ground truth** (verified 2026-08-18):
>
> - Component: `packages/ui/src/components/feedback/toast.tsx` (~900 lines)
> - Mounted in: `apps/admin/app/layout.tsx` + `apps/docs/app/layout.tsx` (one `<Toaster />` per manager)
> - Call sites: ~80 across `apps/admin` (backup, telescope, settings, emails, showcases) + `apps/docs/components/lightbox.ts`
> - Showcase + tests: `apps/admin/components/showcase/toast-showcase.tsx`, `apps/admin/components/showcase/toast.test.tsx`

## Getting started

Mount **exactly one** `<Toaster />` in the root layout (a second instance bound to the same
manager renders a duplicate viewport):

```tsx
// apps/admin/app/layout.tsx
import { Toaster } from "@workspace/ui/components/feedback/toast";

<QueryProvider>
	<ClientAuthWrapper>
		<ThemeProvider>
			{children}
			<Toaster />
		</ThemeProvider>
	</ClientAuthWrapper>
</QueryProvider>
```

Then fire toasts from anywhere (module-level import — no provider needed):

```tsx
import { toastMessage } from "@workspace/ui/components/feedback/toast";

toastMessage.success({ title: "Backup completed", description: "475 KB · checksum e755cd…" });
toastMessage.error({ title: "Delete failed", description: "Backup is still running." });
toastMessage.info({ title: "Backup started", description: "Progress shows on the page." });
```

## API

### `toastMessage` — typed helpers (the API you'll use 99% of the time)

| Helper | Signature | Notes |
| --- | --- | --- |
| `success` / `info` / `warning` / `error` | `(options: ToastMessageOptions) => string` | Returns the toast id |
| `loading` | `(options) => string` | Spinner icon, no countdown — pair with `update`/`promise` |
| `dismiss` | `(id?: string) => void` | One toast, or **all** when omitted |
| `update` | `(id, Partial<ToastObject>) => void` | Patch a live toast in place |
| `promise` | `<V>(promise, {loading, success, error}) => Promise<V>` | loading → result automatically |

`ToastMessageOptions`:

```ts
interface ToastMessageOptions {
	title?: ReactNode;
	description?: ReactNode;
	/** Auto-dismiss after N ms; 0 = persistent. Default 5000. */
	timeout?: number;
	/** aria-live urgency; defaults from the type (errors are assertive). */
	priority?: "low" | "high";
	/** Action button props (+ onClick) — renders a Button in the card. */
	actionProps?: ButtonProps & { onClick?: () => void };
	/** Custom payload: { progress?: 0–100, icon?: ReactNode }. */
	data?: ToastData;
	onClose?: () => void;
}
```

### The `data` slot

- `data: { progress: number }` renders a **manual progress bar** (bottom edge, `role="progressbar"`)
  and **replaces** the auto-dismiss countdown. The backup flow uses this: a `loading` toast
  with `timeout: 0`, updated on each poll tick, then morphed via `toastMessage.update(id, { type: "success", … })`.
- `data: { icon }` overrides the per-type icon.

### `toast` — the raw manager

`toast` (the base-ui manager) stays exported for advanced use: `toast.add({ title, type, … })`,
`toast.update`, `toast.promise`, and multi-manager isolation via `createToastManager()` +
`createToastMessage(manager)` — e.g. separate stacks for "notifications" vs "system alerts".

## Common patterns

**Morph a loading toast into a result** (async job):

```tsx
const id = toastMessage.loading({ title: "Working…", timeout: 0 });
try {
	await doThing();
	toastMessage.update(id, { title: "Done", type: "success", timeout: 5000 });
} catch (error) {
	toastMessage.update(id, { title: "Failed", type: "error", description: String(error), timeout: 8000 });
}
```

**Promise helper** (same thing, less code):

```tsx
await toastMessage.promise(apiCall(), {
	loading: { title: "Saving…" },
	success: { title: "Saved" },
	error: (err) => ({ title: "Save failed", description: err.message }),
});
```

**Live progress** (the backup pattern — page-bound bar + corner toast updates):

```tsx
let lastPushed = -1;
// in the poll tick:
const percent = Math.round(easedProgress);
if (percent === lastPushed) return;
lastPushed = percent;
toastMessage.update(id, {
	description: `${stageLabel} · queue position ${position}`,
	data: { progress: percent },
});
```

**Action button** (e.g. "Undo"):

```tsx
toastMessage.success({
	title: "Backup deleted",
	actionProps: { onClick: () => restoreIt(), children: "Undo" },
});
```

## Theming & behavior

- **Soft-solid cards**: fully opaque `bg-{color}-soft` (pale pastel in light, deep tint in
  dark) with the full-saturation color for text/icons/border — no glassy translucency, no
  harsh near-black cards. Per-type: green (success), blue (info), amber (warning), red
  (error), neutral popover (loading).
- **Countdown bar**: drains over the auto-dismiss timeout with a `Dismisses in Xs` label
  (`tabular-nums`). Both freeze while **any** card is hovered/focused or the window blurs —
  mirroring base-ui's viewport-wide timer pause so text never drifts from reality.
- **Positions**: `position` prop on `<Toaster />` — `bottom-right` (default),
  `bottom-left/center`, `top-right/left/center`. Swipe dismissal is constrained per edge
  (bottom stacks dismiss downward, top stacks upward).
- **Stacking**: `limit={3}` default; older toasts scale/peek behind the frontmost.
- **a11y**: `toastA11yProps(type)` maps priority → `role` (`alert` for errors, `status`
  otherwise); the viewport is a labelled live region; close button has an i18n `closeLabel`.

## From sonner

Sonner was removed entirely (2026-08-18). The migration: swap the mounted `Toaster` in the
admin + docs layouts, convert every `toast.success("Title", { description })` (positional) to
`toastMessage.success({ title, description })` (named), update the `code-block.test.tsx` mock
to the named API, delete `components/feedback/sonner.tsx`, and drop `sonner` from the
`ui`/`admin`/`docs` package.json + lockfile.

Migration snippet:

```tsx
// before (sonner)
import { toast } from "sonner";
toast.success("Backup completed", { description: size });

// after (Toast & Toastr)
import { toastMessage } from "@workspace/ui/components/feedback/toast";
toastMessage.success({ title: "Backup completed", description: size });
```

Why: one consistent token-driven toast system across every app (sonner's `richColors` didn't
cover info toasts, and the in-house component is strictly nicer — soft-solid tokens,
countdown bars, per-type icons, swipe-to-dismiss, multi-manager isolation). `docs/ui-components.md`
documents the component's 20 improvements + 20 features.
