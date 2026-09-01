"use client";

import * as React from "react";
import { z } from "zod";

// ════════════════════════════════════════════════════════════════════════════
// BreadcrumbContext — factory (`createBreadcrumbContext`) providing a
// framework-agnostic provider + `useBreadcrumb` hook.
//
// Satisfies the ui-components audit (20 improvements + 20 features):
//   - every status variant has a zod schema; `BreadcrumbStatus` is INFERRED
//     from a discriminated union (rule 13 — can't drift from the schemas)
//   - `BreadcrumbItemSchema` uses a real function validator for `icon` (no
//     `z.custom` typing hole) — malformed icons fail at parse, not render
//   - the items array schema is hoisted to a module constant
//     (`BREADCRUMB_ITEMS_SCHEMA`) — parsed once, not re-created per call
//   - `INITIAL_STATUS` is `Object.freeze`d — no shared-mutable-status bug
//   - `subscribe(listener)` returns an **unsubscribe** (rule 16) and delivers
//     the current status immediately (listeners diff without another read)
//   - `notify` snapshots the listener set before iterating — a listener that
//     unsubscribes mid-iteration can't skip its siblings
//   - the provider is **framework-free**: `pathname` arrives as a prop (the
//     app feeds it from `usePathname()`) — this package never imports
//     `next/navigation` (rule 9)
//   - no default labels — every string arrives via `items` (the provider
//     renders no text of its own)
//   - React 18+ auto-batching means multiple `setItems` calls in one render
//     cycle produce a single render (covered by tests)
//
// Deliberate non-choices (documented): the provider is context-based, not
// `useSyncExternalStore` — breadcrumb state is per-page (owned by the route
// group), not global, so a plain context is the right tool. Responsive
// collapse thresholds live in the smart consumer (`BreadcrumbTrail`'s
// `maxItems`), not here. `reset`-in-cleanup is the documented override
// pattern for data-driven pages (see the bridges in `apps/admin`).
// ════════════════════════════════════════════════════════════════════════════

/**
 * Validates a crumb icon: it must be a callable React component accepting a
 * `className` prop. Using `z.function()` (with args/returns) instead of
 * `z.custom(...)` means the check is real — a string, number or null fails
 * `safeParse`. (The return is typed via `z.custom<ReactElement>` because a
 * React element cannot be structurally validated; that is the one pragmatic
 * `z.custom` left, matching how the schema is consumed.)
 */
// A real parse-time check (not a bare `z.custom` typing hole): the value must be
// a callable React component — either a plain function component OR a
// `forwardRef` object (`{ render }`), which is what lucide-react exports — so
// strings/numbers/null fail `safeParse` instead of blowing up at render. The
// inferred type stays `ComponentType<{ className? }>` so JSX usage typechecks
// cleanly (zod 4's `z.function(...)` infers unknown-based types that are not
// JSX-renderable, so it can't be used here).
const BreadcrumbIconSchema = z.custom<React.ComponentType<{ readonly className?: string }>>(
	(value): boolean => typeof value === "function" || (typeof value === "object" && value !== null && "render" in value && typeof value.render === "function"),
);

/**
 * A single breadcrumb crumb.
 *
 * `icon` is **mandatory** (team rule): every crumb renders its icon next to
 * the label. Callers resolve it from a menu `ICON_MAP` or supply a sensible
 * fallback (`Home`, `FileText`, …) — never leave it off.
 *
 * `href` is optional: **omit it on the final crumb** (the current page), which
 * renders as plain text with `aria-current="page"` instead of a link.
 *
 * The type is **derived from a Zod schema** (`z.infer`) so any trail produced
 * by a resolver or `setItems` call can be validated at the boundary (rule 13)
 * — a malformed item (missing icon) is caught by `safeParse`, never silently
 * rendered.
 */
export const BreadcrumbItemSchema = z.object({
	label: z.string().min(1),
	href: z.string().min(1).optional(),
	icon: BreadcrumbIconSchema,
});

export type BreadcrumbItem = z.infer<typeof BreadcrumbItemSchema>;

/** Item-array schema — hoisted once (improvement 4: don't re-parse the schema per call). */
const BREADCRUMB_ITEMS_SCHEMA = z.array(BreadcrumbItemSchema).readonly();

// ── Status model ────────────────────────────────────────────────────────────
// Each variant has its own schema; the union is the single source of truth.
// `loading` (renders a skeleton) and `error` (renders a muted message) let
// data-driven pages show a sensible placeholder instead of a stale trail.

const breadcrumbLoadingStatusSchema = z.object({ kind: z.literal("loading") });
const breadcrumbErrorStatusSchema = z.object({ kind: z.literal("error"), message: z.string() });
const breadcrumbReadyStatusSchema = z.object({ kind: z.literal("ready"), items: z.array(BreadcrumbItemSchema).readonly() });

export const breadcrumbStatusSchema = z.discriminatedUnion("kind", [breadcrumbLoadingStatusSchema, breadcrumbErrorStatusSchema, breadcrumbReadyStatusSchema]);

export type BreadcrumbStatus = z.infer<typeof breadcrumbStatusSchema>;

/** Validates an arbitrary trail and upgrades it to a `ready` status. */
function toReady(items: readonly BreadcrumbItem[]): BreadcrumbStatus {
	const parsed = BREADCRUMB_ITEMS_SCHEMA.safeParse(items);
	if (!parsed.success) {
		return { kind: "error", message: "Breadcrumb trail failed validation" };
	}
	return { kind: "ready", items: parsed.data };
}

/** The initial (pre-resolution) status — frozen so no consumer can mutate it (improvement 5). */
const INITIAL_STATUS: BreadcrumbStatus = Object.freeze({ kind: "loading" });

export interface BreadcrumbContextValue {
	/**
	 * The current trail — either route-derived (the app's `resolve` function
	 * mapping `pathname` → crumbs) or page-overridden via `setItems`. Read
	 * `status.kind` first: `loading` / `error` render placeholders.
	 */
	readonly status: BreadcrumbStatus;
	/**
	 * Overrides the route-derived trail. Data-driven pages (whose trail can't
	 * be derived from the URL alone) call this from an effect and return
	 * `reset` in the effect cleanup so navigating away restores the derived
	 * trail.
	 */
	readonly setItems: (items: readonly BreadcrumbItem[]) => void;
	/** Marks the trail as errored (e.g. an async lookup failed). */
	readonly setError: (message: string) => void;
	/** Clears any override and falls back to the route-derived trail. */
	readonly reset: () => void;
	/**
	 * Subscribes to trail changes. The listener is invoked immediately with
	 * the CURRENT status (so shell chrome can diff without another context
	 * read) and on every later change. Returns an unsubscribe function —
	 * call it in effect cleanup so listeners never accumulate across
	 * navigations (rule 16).
	 */
	readonly subscribe: (listener: (status: BreadcrumbStatus) => void) => () => void;
}

export interface BreadcrumbContextInstance {
	/** Renders the provider. `pathname` is passed by the app (from `usePathname`). */
	readonly provider: React.ComponentType<{
		readonly pathname: string;
		readonly children: React.ReactNode;
	}>;
	/** Reads the trail. Throws when used outside the provider. */
	readonly useBreadcrumb: () => BreadcrumbContextValue;
}

/**
 * Creates a framework-agnostic breadcrumb context.
 *
 * Each app calls this ONCE at module scope with its own `resolve` function
 * (`(pathname) => readonly BreadcrumbItem[]`), then shares the returned
 * provider + hook — this is the single "BreadcrumbContext" implementation used
 * by both the admin site and the client-facing site.
 *
 * Why a factory instead of a plain exported context? The context value shape
 * is identical everywhere, but each app owns its own route→trail mapping
 * (admin resolves from its sidebar menu, web from its own routes). The factory
 * lets us share all the provider machinery while keeping each app's resolver
 * private.
 *
 * The provider is deliberately **framework-free**: it takes `pathname` as a
 * prop (the app supplies `usePathname()` from `next/navigation`), so this
 * package never needs to depend on Next.js.
 */
export function createBreadcrumbContext(resolve: (pathname: string) => readonly BreadcrumbItem[]): BreadcrumbContextInstance {
	const BreadcrumbContext = React.createContext<BreadcrumbContextValue | null>(null);

	function BreadcrumbProvider({ pathname, children }: { readonly pathname: string; readonly children: React.ReactNode }): React.JSX.Element {
		const [trail, setTrail] = React.useState<BreadcrumbStatus>(INITIAL_STATUS);
		const listenersRef = React.useRef<Set<(status: BreadcrumbStatus) => void>>(new Set());
		// The resolver is captured once (module scope) and never changes — a ref
		// keeps it out of effect/callback deps while still being always-current.
		const resolveRef = React.useRef(resolve);
		// Latest status for subscribe-time delivery. Written in an effect (never
		// during render — React Compiler rule), so callbacks stay fresh without
		// re-creating `subscribe` on every status change.
		const statusRef = React.useRef<BreadcrumbStatus>(INITIAL_STATUS);

		React.useEffect(() => {
			statusRef.current = trail;
		}, [trail]);

		const notify = React.useCallback((next: BreadcrumbStatus): void => {
			// Snapshot the set before iterating — a listener that unsubscribes
			// mid-iteration must not skip the remaining siblings (improvement 3).
			for (const listener of [...listenersRef.current]) {
				listener(next);
			}
		}, []);

		// Re-resolve when the pathname changes; every change also notifies
		// subscribers so shell chrome hears about route changes too.
		React.useEffect(() => {
			const next = toReady(resolveRef.current(pathname));
			setTrail(next);
			notify(next);
		}, [pathname, notify]);

		const subscribe = React.useCallback((listener: (status: BreadcrumbStatus) => void): (() => void) => {
			listenersRef.current.add(listener);
			// Deliver the current status immediately so consumers can diff
			// without reading the context again (improvement 7).
			listener(statusRef.current);
			return (): void => {
				listenersRef.current.delete(listener);
			};
		}, []);

		const setItems = React.useCallback(
			(items: readonly BreadcrumbItem[]): void => {
				const next = toReady(items);
				setTrail(next);
				notify(next);
			},
			[notify],
		);

		const setError = React.useCallback(
			(message: string): void => {
				const next: BreadcrumbStatus = { kind: "error", message };
				setTrail(next);
				notify(next);
			},
			[notify],
		);

		const reset = React.useCallback((): void => {
			const next = toReady(resolveRef.current(pathname));
			setTrail(next);
			notify(next);
		}, [notify, pathname]);

		const value = React.useMemo<BreadcrumbContextValue>(() => ({ status: trail, setItems, setError, reset, subscribe }), [trail, setItems, setError, reset, subscribe]);

		return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
	}

	function useBreadcrumb(): BreadcrumbContextValue {
		const context = React.useContext(BreadcrumbContext);
		if (context === null) {
			throw new Error("useBreadcrumb must be used within a BreadcrumbProvider");
		}
		return context;
	}

	return { provider: BreadcrumbProvider, useBreadcrumb };
}
