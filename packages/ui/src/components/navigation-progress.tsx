"use client";

import * as React from "react";

import { cn } from "../lib/core/utils";

/** How long (ms) a navigation may run before the bar shows, so a prefetched route that commits at once never flashes it. */
export const NAVIGATION_PROGRESS_SHOW_DELAY_MS = 120;

/** How often (ms) the bar creeps forward while the next page is on its way. */
export const NAVIGATION_PROGRESS_TRICKLE_INTERVAL_MS = 200;

/** Where the bar starts once it shows (percent): enough to read as "moving" at a glance. */
export const NAVIGATION_PROGRESS_START_PERCENT = 12;

/** The bar never passes this (percent) on its own: only the arrived page completes it. */
export const NAVIGATION_PROGRESS_CEILING_PERCENT = 92;

/** The share of the remaining distance to the ceiling covered on each trickle step, so the bar slows as it nears it. */
export const NAVIGATION_PROGRESS_TRICKLE_RATIO = 0.08;

/** How long (ms) a finished bar takes to fill and fade before it resets: at least the 200ms transition. */
export const NAVIGATION_PROGRESS_FINISH_MS = 240;

const COMPLETE_PERCENT = 100;

const PRIMARY_MOUSE_BUTTON = 0;

/** Where the bar is in a navigation's life. */
export type NavigationProgressPhase = "idle" | "waiting" | "loading" | "finishing";

export interface NavigationProgressState {
	readonly phase: NavigationProgressPhase;
	/** Width of the bar, 0–100. */
	readonly percent: number;
}

export const IDLE_NAVIGATION_PROGRESS: NavigationProgressState = { phase: "idle", percent: 0 };

/** The next trickle step: a fixed share of the distance left to the ceiling, never past it. */
export function trickleNavigationProgress(percent: number): number {
	const next = percent + (NAVIGATION_PROGRESS_CEILING_PERCENT - percent) * NAVIGATION_PROGRESS_TRICKLE_RATIO;
	return Math.min(NAVIGATION_PROGRESS_CEILING_PERCENT, next);
}

/** Whether `target` loads a different page than `current`: another origin is the browser's job and a hash-only change never leaves the page. */
export function isNewPageLocation(target: URL, current: URL): boolean {
	return target.origin === current.origin && (target.pathname !== current.pathname || target.search !== current.search);
}

/**
 * The same-origin page a click on a link is about to open in this tab, or `null` when the
 * click is not one: a modified or non-primary click, a link opening elsewhere (`target`
 * other than `_self`), a download, an already-handled click or a link to the current page.
 */
export function navigationTargetOfClick(event: MouseEvent, current: URL): URL | null {
	if (event.button !== PRIMARY_MOUSE_BUTTON || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
	if (!(event.target instanceof Element)) return null;
	const anchor = event.target.closest("a[href]");
	if (!(anchor instanceof HTMLAnchorElement)) return null;
	const opensHere = anchor.target === "" || anchor.target === "_self";
	if (!opensHere || anchor.hasAttribute("download")) return null;
	const target = new URL(anchor.href, current);
	return isNewPageLocation(target, current) ? target : null;
}

interface NavigationProgressContextValue {
	/** Starts the bar for a navigation to `href` (resolved against the current URL); a no-op for the current page. */
	readonly start: (href: string) => void;
	/** Completes the bar: call it once the new page has arrived. */
	readonly done: () => void;
}

const NOOP_NAVIGATION_PROGRESS: NavigationProgressContextValue = {
	start: (): void => undefined,
	done: (): void => undefined,
};

const NavigationProgressContext = React.createContext<NavigationProgressContextValue>(NOOP_NAVIGATION_PROGRESS);

/** The surrounding `NavigationProgressProvider`'s controls; outside one, both are no-ops (tests, stories). */
export function useNavigationProgress(): NavigationProgressContextValue {
	return React.useContext(NavigationProgressContext);
}

function currentUrl(): URL {
	return new URL(window.location.href);
}

/** Path plus query: the part of a URL whose change means a new page arrived. */
function pageKeyOf(url: URL): string {
	return `${url.pathname}${url.search}`;
}

export interface NavigationProgressProviderProps {
	readonly children: React.ReactNode;
	/** Extra classes for the bar (colour, height). */
	readonly className?: string | undefined;
}

/**
 * A thin bar along the top of the viewport while the app moves to another page.
 *
 * It starts on its own for a plain click on a same-origin link (every `<a>`, so every
 * router's link component) and for the browser's back and forward buttons. Navigation
 * that happens in code calls `useNavigationProgress().start(href)` first. The router
 * integration calls `done()` once the new page has arrived; the kit knows no router.
 *
 * The bar is decorative (`aria-hidden`): the arriving page's own loading state is what a
 * screen reader announces. It only shows after `NAVIGATION_PROGRESS_SHOW_DELAY_MS`, so a
 * page that is already prefetched never flashes it, and it stays still under reduced motion.
 */
export function NavigationProgressProvider({ children, className }: NavigationProgressProviderProps): React.JSX.Element {
	const [state, setState] = React.useState<NavigationProgressState>(IDLE_NAVIGATION_PROGRESS);
	const phaseRef = React.useRef<NavigationProgressPhase>("idle");
	const timeoutRef = React.useRef<number | null>(null);
	const intervalRef = React.useRef<number | null>(null);
	/* The page the bar last saw arrive: back/forward has already changed the address by the time `popstate` fires. */
	const arrivedPageRef = React.useRef<string | null>(null);

	const clearTimers = React.useCallback((): void => {
		if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
		if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
		timeoutRef.current = null;
		intervalRef.current = null;
	}, []);

	const update = React.useCallback((next: NavigationProgressState): void => {
		phaseRef.current = next.phase;
		setState(next);
	}, []);

	const begin = React.useCallback((): void => {
		if (phaseRef.current === "waiting" || phaseRef.current === "loading") return;
		clearTimers();
		update({ phase: "waiting", percent: 0 });
		timeoutRef.current = window.setTimeout((): void => {
			timeoutRef.current = null;
			update({ phase: "loading", percent: NAVIGATION_PROGRESS_START_PERCENT });
			intervalRef.current = window.setInterval((): void => {
				setState((previous: NavigationProgressState): NavigationProgressState => ({ ...previous, percent: trickleNavigationProgress(previous.percent) }));
			}, NAVIGATION_PROGRESS_TRICKLE_INTERVAL_MS);
		}, NAVIGATION_PROGRESS_SHOW_DELAY_MS);
	}, [clearTimers, update]);

	const done = React.useCallback((): void => {
		arrivedPageRef.current = pageKeyOf(currentUrl());
		const phase = phaseRef.current;
		if (phase === "idle" || phase === "finishing") return;
		clearTimers();
		if (phase === "waiting") {
			update(IDLE_NAVIGATION_PROGRESS);
			return;
		}
		update({ phase: "finishing", percent: COMPLETE_PERCENT });
		timeoutRef.current = window.setTimeout((): void => {
			timeoutRef.current = null;
			update(IDLE_NAVIGATION_PROGRESS);
		}, NAVIGATION_PROGRESS_FINISH_MS);
	}, [clearTimers, update]);

	const start = React.useCallback(
		(href: string): void => {
			const current = currentUrl();
			if (isNewPageLocation(new URL(href, current), current)) begin();
		},
		[begin],
	);

	React.useEffect((): (() => void) => {
		arrivedPageRef.current = pageKeyOf(currentUrl());
		const handleClick = (event: MouseEvent): void => {
			if (navigationTargetOfClick(event, currentUrl()) !== null) begin();
		};
		const handlePopState = (): void => {
			if (pageKeyOf(currentUrl()) !== arrivedPageRef.current) begin();
		};
		// Capture phase: a router's link handler calls `preventDefault` on the bubble path.
		document.addEventListener("click", handleClick, { capture: true });
		window.addEventListener("popstate", handlePopState);
		return (): void => {
			document.removeEventListener("click", handleClick, { capture: true });
			window.removeEventListener("popstate", handlePopState);
			clearTimers();
		};
	}, [begin, clearTimers]);

	const value = React.useMemo((): NavigationProgressContextValue => ({ start, done }), [start, done]);
	// Finishing fills the bar while it fades, so the reset to 0 afterwards is never seen.
	const visible = state.phase === "loading";

	return (
		<NavigationProgressContext.Provider value={value}>
			{children}
			<div
				aria-hidden
				data-slot="navigation-progress"
				data-phase={state.phase}
				className={cn(
					"pointer-events-none fixed inset-x-0 top-0 z-toast h-0.5 origin-left bg-primary transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
					visible ? "opacity-100" : "opacity-0",
					className,
				)}
				style={{ transform: `scaleX(${String(state.percent / COMPLETE_PERCENT)})` }}
			/>
		</NavigationProgressContext.Provider>
	);
}
