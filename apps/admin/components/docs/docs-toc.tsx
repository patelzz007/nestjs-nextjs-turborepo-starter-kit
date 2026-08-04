"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { HEADING_SCROLL_OFFSET } from "@/lib/constants";
import type { TocHeading } from "@/lib/markdown";

/**
 * DocsToc — the sticky right-hand "On this page" rail. Dumb and presentational:
 * it receives the headings via props, highlights the section currently in view,
 * and smooth-scrolls to a heading on click.
 *
 * ## Why it stays in sync
 * The dashboard scrolls inside `<main className="flex-1 overflow-y-auto">`, NOT
 * the window — so a plain `window` scroll listener never fires. Three things
 * keep the rail correct:
 * 1. **The real scroll container is found by walking up from the nav's PARENT**
 *    (not the nav itself). The ToC's own `<nav>` is `overflow-y-auto` too, so
 *    starting the walk at the nav would mistake the rail for the page scroller
 *    — which broke the bottom-of-page correction on guides whose ToC is short
 *    enough to fit the viewport.
 * 2. A **capture-phase** listener on `window` (`{ capture: true }`): scroll
 *    events don't bubble, but they *do* pass through the capture phase, so a
 *    capture listener on `window` catches scrolls from any inner container.
 *    (Skipped when the detected container already IS the window.)
 * 3. A direct listener on the detected container itself.
 *
 * The active section is recomputed in a **rAF-throttled** handler (once per
 * frame): the last heading whose top has crossed the reading line. The
 * bottom-of-page correction — which forces the last heading active so the rail
 * never lags at the end of a doc — only fires when the container can actually
 * scroll (`scrollHeight > clientHeight`); otherwise a short page would pin the
 * last heading forever. State updates only ever happen inside rAF/event
 * callbacks — never in an effect body — to stay compliant with
 * `react-hooks/set-state-in-effect`.
 *
 * ## Clicking a link
 * Clicks scroll the **single detected container** with a manual
 * `scrollTo({ behavior: "smooth" })` computed from the heading's offset — NOT
 * `scrollIntoView`, which scrolls *every* scrollable ancestor (main + shell +
 * body) and causes the visible "jump around" when clicking a section far away.
 *
 * ## The rail
 * A visible 1px gray guide line on the far left (the same guide-line concept
 * the sidebar uses for nested items) with a **sliding 2px primary indicator**
 * that glides to the active heading. `h3` headings render **indented with
 * their own guide line** — mirroring the sidebar's nested-child indentation —
 * so sub-sections are visually grouped under their `h2`.
 */

export interface DocsTocProps {
	readonly headings: readonly TocHeading[];
}

interface TocLinkProps {
	readonly heading: TocHeading;
	readonly isActive: boolean;
	readonly onNavigate: (id: string) => void;
	/** 0 = top-level (h2), 1 = nested under an h2 (h3). */
	readonly depth: number;
}

function TocLink({ heading, isActive, onNavigate, depth }: TocLinkProps): React.JSX.Element {
	const handleClick = React.useCallback(
		(event: React.MouseEvent<HTMLAnchorElement>): void => {
			event.preventDefault();
			onNavigate(heading.id);
		},
		[heading.id, onNavigate],
	);

	return (
		<a
			href={`#${heading.id}`}
			data-toc-id={heading.id}
			onClick={handleClick}
			className={cn(
				"block py-1.5 pr-2 text-[13px] leading-snug transition-colors duration-150",
				isActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
			)}
			style={{ paddingLeft: depth === 0 ? 16 : 0 }}>
			{heading.text}
		</a>
	);
}

/**
 * Finds the element that actually scrolls the page content. Walks up from the
 * ToC's `<aside>` (the nav's parent) so the ToC's own scrollable `<nav>` is
 * never mistaken for the page scroller. Falls back to `window`.
 */
function findPageScrollContainer(from: HTMLElement | null): Window | HTMLElement {
	let current: HTMLElement | null = from;
	while (current !== null) {
		const overflowY = getComputedStyle(current).overflowY;
		if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
			return current;
		}
		current = current.parentElement;
	}
	return window;
}

/** Groups sequential h2/h3 headings into (root h2, nested h3s) buckets. Generic so the caller's extra fields (e.g. `key`) flow through. */
function groupHeadings<T extends TocHeading>(headings: readonly T[]): readonly { readonly root: T; readonly children: readonly T[] }[] {
	const groups: { root: T; children: T[] }[] = [];
	let current: { root: T; children: T[] } | null = null;

	for (const heading of headings) {
		if (heading.level <= 2) {
			current = { root: heading, children: [] };
			groups.push(current);
		} else if (current === null) {
			// Orphan h3 before any h2 — treat it as a top-level entry.
			current = { root: heading, children: [] };
			groups.push(current);
		} else {
			current.children.push(heading);
		}
	}

	return groups;
}

export function DocsToc({ headings }: DocsTocProps): React.JSX.Element | null {
	const [activeId, setActiveId] = React.useState<string | null>(() => headings[0]?.id ?? null);
	const containerRef = React.useRef<HTMLDivElement>(null);
	const navRef = React.useRef<HTMLElement | null>(null);
	const [indicator, setIndicator] = React.useState<{ readonly top: number; readonly height: number } | null>(null);

	// Reset the active section when navigating to a different guide (the
	// component stays mounted across `/docs/a` → `/docs/b`). Uses React's
	// render-phase state adjustment, which is lint-safe.
	const [previousHeadings, setPreviousHeadings] = React.useState(headings);
	if (previousHeadings !== headings) {
		setPreviousHeadings(headings);
		setActiveId(headings[0]?.id ?? null);
		setIndicator(null);
	}

	// De-duplicate ids for React keys (duplicate heading text shares one anchor).
	const keyedHeadings = React.useMemo(() => {
		const counts = new Map<string, number>();
		return headings.map((heading) => {
			const count = counts.get(heading.id) ?? 0;
			counts.set(heading.id, count + 1);
			return { ...heading, key: count === 0 ? heading.id : `${heading.id}-${String(count + 1)}` };
		});
	}, [headings]);

	const grouped = React.useMemo(() => groupHeadings(keyedHeadings), [keyedHeadings]);

	/** Measures and slides the active indicator under the given heading id. */
	const positionIndicator = React.useCallback((id: string): void => {
		const container = containerRef.current;
		if (container === null) {
			setIndicator(null);
			return;
		}
		const activeLink = container.querySelector<HTMLAnchorElement>(`[data-toc-id="${CSS.escape(id)}"]`);
		if (activeLink === null) {
			setIndicator(null);
			return;
		}
		const containerTop = container.getBoundingClientRect().top;
		const linkTop = activeLink.getBoundingClientRect().top;
		setIndicator({ top: linkTop - containerTop, height: activeLink.offsetHeight });
	}, []);

	/** Marks a section active and slides the indicator to it (used by link clicks). */
	const handleActivate = React.useCallback(
		(id: string): void => {
			setActiveId(id);
			positionIndicator(id);
		},
		[positionIndicator],
	);

	/**
	 * Smooth-scrolls the heading into view by scrolling the ONE detected page
	 * container — never `scrollIntoView`, which scrolls every scrollable
	 * ancestor (main + shell + body) and visibly jumps.
	 */
	const scrollHeadingIntoView = React.useCallback((id: string): void => {
		const element = document.getElementById(id);
		if (element === null) {
			return;
		}
		const container = findPageScrollContainer(navRef.current?.parentElement ?? null);
		const containerTop = container instanceof Window ? 0 : container.getBoundingClientRect().top;
		const containerScrollTop = container instanceof Window ? container.scrollY : container.scrollTop;
		// Element's absolute offset inside the container's content, minus the sticky topbar.
		const targetTop = element.getBoundingClientRect().top - containerTop + containerScrollTop - HEADING_SCROLL_OFFSET;
		if (container instanceof Window) {
			container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
		} else {
			container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
		}
	}, []);

	const handleNavigate = React.useCallback(
		(id: string): void => {
			scrollHeadingIntoView(id);
			handleActivate(id);
		},
		[scrollHeadingIntoView, handleActivate],
	);

	// Scroll-spy: recompute the active heading on scroll/resize, throttled to
	// one rAF per frame, from whichever element actually scrolls.
	React.useEffect(() => {
		if (headings.length === 0) {
			return undefined;
		}
		const elements = new Map<string, HTMLElement>();
		for (const heading of headings) {
			const element = document.getElementById(heading.id);
			if (element !== null) {
				elements.set(heading.id, element);
			}
		}
		if (elements.size === 0) {
			return undefined;
		}

		// The "reading line" sits just below the sticky topbar.
		const activationOffset = HEADING_SCROLL_OFFSET + 24;
		let frame: number | null = null;
		// Only touches state when the active section actually changes — this is
		// what keeps the rail from re-rendering on every scroll frame.
		let lastActive: string | null = null;

		// The real page scroll container — the shell scrolls inside `<main>`,
		// not the window. Start from the nav's PARENT so the ToC's own
		// scrollable `<nav>` is never mistaken for it.
		const scrollContainer = findPageScrollContainer(navRef.current?.parentElement ?? null);

		const update = (): void => {
			frame = null;
			let current: string | null = null;
			for (const heading of headings) {
				const element = elements.get(heading.id);
				if (element !== undefined && element.getBoundingClientRect().top <= activationOffset) {
					current = heading.id;
				} else {
					// Headings are in document order — once one is below the line,
					// every later heading is too.
					break;
				}
			}
			// At the very bottom of the page the last heading may never cross the
			// reading line — activate it anyway so the rail doesn't lag behind.
			// Only when the container can actually scroll: on a page whose content
			// fits the viewport, `scrollHeight <= clientHeight` is always true,
			// which would pin the LAST heading forever. Inline ternaries (not
			// helper closures) so TS can narrow the `Window | HTMLElement` union
			// on each branch.
			const scrollTop = scrollContainer instanceof Window ? scrollContainer.scrollY : scrollContainer.scrollTop;
			const clientHeight = scrollContainer instanceof Window ? scrollContainer.innerHeight : scrollContainer.clientHeight;
			const scrollHeight = scrollContainer instanceof Window ? document.documentElement.scrollHeight : scrollContainer.scrollHeight;
			if (scrollHeight > clientHeight && scrollTop + clientHeight >= scrollHeight - 2) {
				current = headings[headings.length - 1]?.id ?? null;
			}
			// Fall back to the first heading before anything has scrolled into place.
			current ??= headings[0]?.id ?? null;
			if (current !== null && current !== lastActive) {
				lastActive = current;
				setActiveId(current);
				positionIndicator(current);
			}
		};

		const schedule = (): void => {
			frame ??= requestAnimationFrame(update);
		};

		schedule();
		// Direct listener on the actual scroll container (usually `<main>`).
		scrollContainer.addEventListener("scroll", schedule, { passive: true });
		// Capture-phase listener catches scrolls from ANY inner container even
		// though scroll events don't bubble. Skipped when the detected container
		// already IS the window (its direct listener covers it — no duplicates).
		const windowCapture = scrollContainer !== window;
		if (windowCapture) {
			window.addEventListener("scroll", schedule, { capture: true, passive: true });
		}
		// Re-measure on viewport resizes AND container reflows (e.g. the
		// framer-motion sidebar collapse changes <main>'s width without a window
		// resize), so the indicator never sits stale.
		const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
		const observedTarget = scrollContainer instanceof HTMLElement ? scrollContainer : document.body;
		resizeObserver?.observe(observedTarget);
		window.addEventListener("resize", schedule);
		return (): void => {
			scrollContainer.removeEventListener("scroll", schedule);
			if (windowCapture) {
				window.removeEventListener("scroll", schedule, { capture: true });
			}
			window.removeEventListener("resize", schedule);
			resizeObserver?.disconnect();
			if (frame !== null) {
				cancelAnimationFrame(frame);
			}
		};
	}, [headings, positionIndicator]);

	if (headings.length === 0) {
		return null;
	}

	return (
		<nav ref={navRef} aria-label="Table of contents" className="sticky top-4 max-h-[calc(100svh-2rem)] overflow-y-auto pb-8">
			<p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">On this page</p>
			<div ref={containerRef} className="relative">
				{/* Static gray guide rail — clearly visible in both themes */}
				<div aria-hidden="true" className="absolute inset-y-0 left-0 w-px bg-muted-foreground/25" />
				{/* Sliding active indicator */}
				<div
					aria-hidden="true"
					className="absolute left-0 w-0.5 rounded-full bg-primary transition-all duration-300 ease-out"
					style={{
						top: `${String(indicator?.top ?? 0)}px`,
						height: `${String(indicator?.height ?? 0)}px`,
						opacity: indicator === null ? 0 : 1,
					}}
				/>
				<ul className="relative">
					{grouped.map((group) => (
						<li key={group.root.key}>
							<TocLink heading={group.root} isActive={activeId === group.root.id} onNavigate={handleNavigate} depth={0} />
							{group.children.length > 0 ? (
								/* Nested h3s: indented with their own guide line, like the sidebar's children */
								<div className="ml-7 border-l border-muted-foreground/20 pl-2">
									{group.children.map((child) => (
										<TocLink key={child.key} heading={child} isActive={activeId === child.id} onNavigate={handleNavigate} depth={1} />
									))}
								</div>
							) : null}
						</li>
					))}
				</ul>
			</div>
		</nav>
	);
}
