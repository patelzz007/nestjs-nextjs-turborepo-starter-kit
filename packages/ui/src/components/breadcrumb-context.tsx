"use client";

import * as React from "react";
import { z } from "zod";

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
	icon: z.custom<React.ComponentType<{ readonly className?: string }>>(),
});

export type BreadcrumbItem = z.infer<typeof BreadcrumbItemSchema>;

/**
 * The current state of the trail. `ready` carries the crumbs; `loading`
 * (renders a skeleton) and `error` (renders a muted message) let data-driven
 * pages show a sensible placeholder instead of a stale trail.
 */
export type BreadcrumbStatus =
	{ readonly kind: "loading" } | { readonly kind: "error"; readonly message: string } | { readonly kind: "ready"; readonly items: readonly BreadcrumbItem[] };

/** Validates an arbitrary trail and upgrades it to a `ready` status. */
function toReady(items: readonly BreadcrumbItem[]): BreadcrumbStatus {
	const parsed = z.array(BreadcrumbItemSchema).safeParse(items);
	if (!parsed.success) {
		return { kind: "error", message: "Breadcrumb trail failed validation" };
	}
	return { kind: "ready", items: parsed.data };
}

/** The initial (pre-resolution) status — nothing is known yet on the first render. */
const INITIAL_STATUS: BreadcrumbStatus = { kind: "loading" };

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
	 * Subscribes to trail changes (fire-and-forget — no unsubscribe
	 * returned). Lets shell chrome (document title, ⌘K palette) react to the
	 * trail without re-rendering the whole tree.
	 */
	readonly subscribe: (listener: () => void) => void;
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
		const listenersRef = React.useRef<Set<() => void>>(new Set());
		// The resolver is captured once (module scope) and never changes — a ref
		// keeps it out of effect/callback deps while still being always-current.
		const resolveRef = React.useRef(resolve);

		// Re-resolve only when the pathname actually changes. (No `notify()`
		// here: `notify` fires on explicit overrides — route changes flow to
		// subscribers through the normal context re-render.)
		React.useEffect(() => {
			setTrail(toReady(resolveRef.current(pathname)));
		}, [pathname]);

		const subscribe = React.useCallback((listener: () => void): void => {
			listenersRef.current.add(listener);
		}, []);

		const notify = React.useCallback((): void => {
			for (const listener of listenersRef.current) {
				listener();
			}
		}, []);

		const setItems = React.useCallback(
			(items: readonly BreadcrumbItem[]): void => {
				setTrail(toReady(items));
				notify();
			},
			[notify],
		);

		const setError = React.useCallback(
			(message: string): void => {
				setTrail({ kind: "error", message });
				notify();
			},
			[notify],
		);

		const reset = React.useCallback((): void => {
			setTrail(toReady(resolveRef.current(pathname)));
			notify();
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
