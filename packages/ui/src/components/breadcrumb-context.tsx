"use client";

import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { FileText } from "lucide-react";
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
//   - the route trail is computed during render — ready on first paint, and
//     page overrides / tail labels are pathname-scoped state, discarded when
//     the pathname changes, so a parent effect can never overwrite them and
//     they never leak onto another page or a later visit of the same page
//   - `subscribe(listener)` returns an **unsubscribe** (rule 16) and delivers
//     the current status immediately (listeners diff without another read)
//   - `notify` snapshots the listener set before iterating — a listener that
//     unsubscribes mid-iteration can't skip its siblings
//   - the provider is **framework-free**: `pathname` arrives as a prop (the
//     app feeds it from `usePathname()`) — this package never imports
//     `next/navigation` (rule 9)
//   - no default labels — every crumb string arrives via `items`; the one
//     string the provider produces itself (the `error` status message for a
//     malformed trail) is user-facing — apps render `status.message` — so it
//     comes from the `breadcrumbTrail` label family (`UiKitLabelsProvider`)
//   - React 18+ auto-batching means multiple `setItems` calls in one render
//     cycle produce a single render (covered by tests)
//
// Deliberate non-choices (documented): the provider is context-based, not
// `useSyncExternalStore` — breadcrumb state is per-page (owned by the route
// group), not global, so a plain context is the right tool. Responsive
// collapse thresholds live in the smart consumer (`BreadcrumbTrail`'s
// `maxItems`), not here. Data-driven pages name their final crumb with `setTailLabel`
// (or replace the trail with `setItems`) — both are scoped to the pathname.
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
const BreadcrumbIconShapeSchema = z.union([z.instanceof(Function), z.object({ render: z.instanceof(Function) })]);

const BreadcrumbIconSchema = z.custom<React.ComponentType<{ readonly className?: string }>>((value): boolean => BreadcrumbIconShapeSchema.safeParse(value).success);

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

/**
 * Validates an arbitrary trail and upgrades it to a `ready` status. A malformed
 * trail becomes an `error` status carrying `invalidTrailMessage` — the
 * user-facing copy, since apps render the status message on screen.
 */
function toReady(items: readonly BreadcrumbItem[], invalidTrailMessage: string): BreadcrumbStatus {
	const parsed = BREADCRUMB_ITEMS_SCHEMA.safeParse(items);
	if (!parsed.success) {
		return { kind: "error", message: invalidTrailMessage };
	}
	return { kind: "ready", items: parsed.data };
}

/** The current page's name — the final crumb's label once the trail is ready, otherwise `null`. */
export function breadcrumbPageLabel(status: BreadcrumbStatus): string | null {
	return status.kind === "ready" ? (status.items.at(-1)?.label ?? null) : null;
}

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
	 * Names the current page's final crumb (e.g. a user's or reward's name,
	 * known only at runtime) without replacing the rest of the trail; `null`
	 * clears it. Scoped to the current pathname — it never leaks onto another
	 * page, and the provider's own route resolution can't overwrite it.
	 */
	readonly setTailLabel: (label: string | null) => void;
	/**
	 * Subscribes to trail changes. The listener is invoked immediately with
	 * the CURRENT status (so shell chrome can diff without another context
	 * read) and on every later change. Returns an unsubscribe function —
	 * call it in effect cleanup so listeners never accumulate across
	 * navigations (rule 16).
	 */
	readonly subscribe: (listener: (status: BreadcrumbStatus) => void) => () => void;
}

export interface BreadcrumbProviderProps {
	readonly pathname: string;
	/**
	 * Optional per-mount resolver override (e.g. tenant-scoped href mapping).
	 * The trail is re-resolved whenever this function's identity changes, so
	 * memoize it on whatever it closes over (e.g. the organization slug).
	 */
	readonly resolve?: (pathname: string) => readonly BreadcrumbItem[];
	readonly children: React.ReactNode;
}

export interface BreadcrumbContextInstance {
	/** Renders the provider. `pathname` is passed by the app (from `usePathname`). */
	readonly provider: React.ComponentType<BreadcrumbProviderProps>;
	/** Reads the trail. Throws when used outside the provider. */
	readonly useBreadcrumb: () => BreadcrumbContextValue;
}

/** A value set by a page, valid only on the pathname it was set on. */
interface PathScoped<T> {
	readonly pathname: string;
	readonly value: T;
}

/** Replaces the final crumb's label (or makes a one-crumb trail when there is none). */
function applyTailLabel(items: readonly BreadcrumbItem[], label: string): readonly BreadcrumbItem[] {
	const last = items.at(-1);
	if (last === undefined) {
		return [{ label, icon: FileText }];
	}
	return [...items.slice(0, -1), { label, icon: last.icon }];
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
export function createBreadcrumbContext(defaultResolve: (pathname: string) => readonly BreadcrumbItem[]): BreadcrumbContextInstance {
	const BreadcrumbContext = React.createContext<BreadcrumbContextValue | null>(null);

	function BreadcrumbProvider({ pathname, resolve, children }: BreadcrumbProviderProps): React.JSX.Element {
		const resolver = resolve ?? defaultResolve;
		const { errorMessage: invalidTrailMessage } = useUiKitLabels("breadcrumbTrail");
		// Page-supplied state is keyed by the pathname it was set on, so it is
		// ignored on any other page and the route trail below can never
		// overwrite it. It is also DISCARDED as soon as the pathname changes
		// (below), so returning to a page later never shows a label from the
		// previous visit — the page sets it again from its current data.
		const [override, setOverride] = React.useState<PathScoped<BreadcrumbStatus> | null>(null);
		const [tailLabel, setTailLabelState] = React.useState<PathScoped<string> | null>(null);
		const [scopedPathname, setScopedPathname] = React.useState<string>(pathname);
		const listenersRef = React.useRef<Set<(status: BreadcrumbStatus) => void>>(new Set());

		// Navigated: drop the previous page's override and label during render
		// (React's "reset state when a prop changes" pattern) — no effect, so no
		// frame ever shows them and no cleanup ordering can bring them back.
		if (scopedPathname !== pathname) {
			setScopedPathname(pathname);
			setOverride(null);
			setTailLabelState(null);
		}

		// The route-derived trail is computed during render (not in an effect):
		// it is ready on the first paint, and a child's override set in its own
		// effect is not raced by a later parent effect.
		const routeStatus = React.useMemo<BreadcrumbStatus>(() => toReady(resolver(pathname), invalidTrailMessage), [resolver, pathname, invalidTrailMessage]);

		const status = React.useMemo<BreadcrumbStatus>(() => {
			if (override !== null && override.pathname === pathname) {
				return override.value;
			}
			if (tailLabel !== null && tailLabel.pathname === pathname && routeStatus.kind === "ready") {
				return toReady(applyTailLabel(routeStatus.items, tailLabel.value), invalidTrailMessage);
			}
			return routeStatus;
		}, [override, tailLabel, pathname, routeStatus, invalidTrailMessage]);

		// Latest status for subscribe-time delivery (written in an effect, never during render).
		const statusRef = React.useRef<BreadcrumbStatus>(status);

		// Every change — route or page driven — notifies subscribers.
		React.useEffect(() => {
			statusRef.current = status;
			// Snapshot the set before iterating — a listener that unsubscribes
			// mid-iteration must not skip the remaining siblings (improvement 3).
			for (const listener of [...listenersRef.current]) {
				listener(status);
			}
		}, [status]);

		const subscribe = React.useCallback((listener: (next: BreadcrumbStatus) => void): (() => void) => {
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
				setOverride({ pathname, value: toReady(items, invalidTrailMessage) });
			},
			[pathname, invalidTrailMessage],
		);

		const setError = React.useCallback(
			(message: string): void => {
				setOverride({ pathname, value: { kind: "error", message } });
			},
			[pathname],
		);

		// Clearing is scoped too: a page's cleanup that runs after another page
		// set its own value never wipes that value.
		const reset = React.useCallback((): void => {
			setOverride((current) => (current !== null && current.pathname === pathname ? null : current));
		}, [pathname]);

		const setTailLabel = React.useCallback(
			(label: string | null): void => {
				const trimmed = label?.trim() ?? "";
				if (trimmed.length === 0) {
					setTailLabelState((current) => (current !== null && current.pathname === pathname ? null : current));
					return;
				}
				setTailLabelState({ pathname, value: trimmed });
			},
			[pathname],
		);

		const value = React.useMemo<BreadcrumbContextValue>(
			() => ({ status, setItems, setError, reset, setTailLabel, subscribe }),
			[status, setItems, setError, reset, setTailLabel, subscribe],
		);

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
