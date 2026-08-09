"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { HEADING_SCROLL_OFFSET } from "@/lib/constants";
import type { TocHeading } from "@/lib/markdown";
import { findPageScrollContainer } from "@workspace/ui/lib/scroll-container";

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
 *    (not the nav itself). The ToC's own `<nav>` is scrollable too, so
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
 * A clean card with a header divider ("On this page" + reading-time pill), a
 * thin reading-progress fill under the header, and links with a soft pill
 * active state (`bg-primary/10` + primary text — the same active treatment the
 * rest of the admin uses). `h3` headings are indented (no borders, no guide
 * lines) so the hierarchy reads at a glance. Spacing is uniform: every link
 * gets the same `py-1.5` rhythm and Tailwind-class padding — no inline styles.
 */

export interface DocsTocProps {
	readonly headings: readonly TocHeading[];
	/**
	 * When `false` (mobile collapsible), the rail renders as a static list
	 * inside the `<details>` disclosure instead of a sticky sidebar rail.
	 */
	readonly sticky?: boolean;
	/** Estimated reading minutes — shown in the rail header on the sticky variant. */
	readonly readingTimeMinutes?: number;
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
			aria-current={isActive ? "location" : undefined}
			className={cn(
				"block rounded-md py-1.5 pr-2 text-[13px] leading-snug transition-colors duration-150",
				depth === 0 ? "pl-3" : "pl-8",
				isActive ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
			)}>
			{heading.text}
		</a>
	);
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

export function DocsToc({ headings, sticky = true, readingTimeMinutes }: DocsTocProps): React.JSX.Element | null {
	const [activeId, setActiveId] = React.useState<string | null>(() => headings[0]?.id ?? null);
	const navRef = React.useRef<HTMLElement | null>(null);
	const [progress, setProgress] = React.useState(0);
	const [collapsedGroups, setCollapsedGroups] = React.useState<ReadonlySet<number>>(new Set<number>());

	// Reset the active section when navigating to a different guide (the
	// component stays mounted across `/docs/a` → `/docs/b`). Uses React's
	// render-phase state adjustment, which is lint-safe.
	const [previousHeadings, setPreviousHeadings] = React.useState(headings);
	if (previousHeadings !== headings) {
		setPreviousHeadings(headings);
		setActiveId(headings[0]?.id ?? null);
	}

	// De-duplicate ids for React keys (duplicate heading text shares one anchor).
	const keyedHeadings = React.useMemo(() => {
		const counts = new Map<string, number>();
		return headings.map((heading) => {
			const count = counts.get(heading.id) ?? 0;
			counts.set(heading.id, count + 1);
			// First occurrence keeps the plain id; duplicates get `-1`, `-2`, …
			// (count is already the pre-increment occurrence index).
			return { ...heading, key: count === 0 ? heading.id : `${heading.id}-${String(count)}` };
		});
	}, [headings]);

	const grouped = React.useMemo(() => groupHeadings(keyedHeadings), [keyedHeadings]);

	/** Groups whose nested h3s collapse into a "+N" toggle (long subtrees only). */
	const collapsibleGroups = React.useMemo(() => {
		const result: Set<number> = new Set<number>();
		for (let index = 0; index < grouped.length; index += 1) {
			const group = grouped[index];
			if (group !== undefined && group.children.length > 3) {
				result.add(index);
			}
		}
		return result;
	}, [grouped]);

	const handleToggleGroup = React.useCallback((index: number): void => {
		setCollapsedGroups((current) => {
			const next = new Set(current);
			if (next.has(index)) {
				next.delete(index);
			} else {
				next.add(index);
			}
			return next;
		});
	}, []);

	/**
	 * Single stable click handler for the "Show N more" / "Show less" buttons —
	 * the group index travels on `data-group-index`, so no per-render closures
	 * are created (rule 16).
	 */
	const handleToggleFromButton = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			const raw = event.currentTarget.dataset.groupIndex;
			const index = raw === undefined ? -1 : Number.parseInt(raw, 10);
			if (index >= 0) {
				handleToggleGroup(index);
			}
		},
		[handleToggleGroup],
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
		// Both `Window` and `HTMLElement` expose the same `scrollTo` signature.
		container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
	}, []);

	const handleNavigate = React.useCallback(
		(id: string): void => {
			scrollHeadingIntoView(id);
			setActiveId(id);
		},
		[scrollHeadingIntoView],
	);

	// Scroll-spy: recompute the active heading on scroll/resize, throttled to
	// one rAF per frame, from whichever element actually scrolls. Only the
	// STICKY (desktop aside) instance spies — the mobile `<details>` instance
	// (`sticky={false}`) is click-activated only, and the desktop aside is
	// CSS-hidden below `lg` so spying there would be pure waste.
	React.useEffect(() => {
		if (headings.length === 0 || !sticky) {
			return undefined;
		}
		// The desktop aside only exists at `lg+` — below that it is CSS-hidden
		// but still mounted, so gate the listeners on the same breakpoint.
		if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) {
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
		let lastProgress = -1;

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
			}
			// Reading progress — a 1% step granularity keeps re-renders rare.
			const percent = scrollHeight > clientHeight ? Math.min(1, Math.max(0, scrollTop / Math.max(1, scrollHeight - clientHeight))) : 0;
			const percentStep = Math.round(percent * 100);
			if (percentStep !== lastProgress) {
				lastProgress = percentStep;
				setProgress(percent);
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
	}, [headings, sticky]);

	if (headings.length === 0) {
		return null;
	}

	return (
		<nav
			ref={navRef}
			aria-label="Table of contents"
			className={cn(
				"docs-toc flex flex-col",
				// Sticky desktop rail: a clean solid card. The list owns its own
				// scroll area (`flex-1 min-h-0`) so the header, progress fill and
				// keyboard hint stay pinned while the links scroll. (No "Back to
				// top" here — the global ScrollToTop in the shell covers that.)
				sticky && "sticky top-6 max-h-[calc(100svh-3rem)] overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm",
			)}>
			{/* Header + progress render ONLY on the sticky (desktop) variant — the
			    mobile <details> disclosure already supplies its own "On this page"
			    summary, so rendering a second header there would duplicate it. */}
			{sticky ? (
				<>
					<div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 pt-3 pb-2.5">
						<p className="text-[13px] font-semibold tracking-tight text-foreground">On this page</p>
						{readingTimeMinutes !== undefined && readingTimeMinutes > 0 ? (
							<span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{readingTimeMinutes} min</span>
						) : null}
					</div>
					{/* Reading progress — a thin fill that grows as you scroll */}
					<div aria-hidden="true" className="h-0.5 shrink-0 bg-muted/60">
						<div className="h-full bg-primary transition-[width] duration-150 ease-out" style={{ width: `${String(Math.round(progress * 100))}%` }} />
					</div>
				</>
			) : null}
			{/* Scrollable link list — padding only on the card variant (mobile sits
			    inside the details body which has its own padding) */}
			<div className={cn("relative min-h-0 flex-1 overflow-y-auto", sticky && "p-3")}>
				<ul className="space-y-0.5">
					{grouped.map((group, groupIndex) => {
						const isCollapsible = collapsibleGroups.has(groupIndex);
						const isCollapsed = collapsedGroups.has(groupIndex);
						const visibleChildren = isCollapsible && isCollapsed ? group.children.slice(0, 3) : group.children;
						return (
							<li key={group.root.key}>
								<TocLink heading={group.root} isActive={activeId === group.root.id} onNavigate={handleNavigate} depth={0} />
								{group.children.length > 0 ? (
									<>
										{/* Nested h3s — indented, no borders; hierarchy reads from indentation alone */}
										<div className="mt-0.5 space-y-0.5">
											{visibleChildren.map((child) => (
												<TocLink key={child.key} heading={child} isActive={activeId === child.id} onNavigate={handleNavigate} depth={1} />
											))}
										</div>
										{isCollapsible ? (
											<button
												type="button"
												data-group-index={String(groupIndex)}
												onClick={handleToggleFromButton}
												className="mt-0.5 ml-8 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground">
												{isCollapsed ? `Show ${String(group.children.length - 3)} more` : "Show less"}
											</button>
										) : null}
									</>
								) : null}
							</li>
						);
					})}
				</ul>
			</div>
			{/* Keyboard hint — a quiet, human ending for the rail */}
			{sticky ? <p className="shrink-0 border-t border-border/50 px-4 py-2 text-center text-[11px] text-muted-foreground/70">[ ] prev · next guide</p> : null}
		</nav>
	);
}
