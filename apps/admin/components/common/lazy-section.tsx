"use client";

import * as React from "react";

import { hasGlobalConstructor } from "@workspace/shared";
import { useIsClient } from "@workspace/ui/hooks/use-is-client";

import { SectionBones } from "@/components/loading/section-skeleton";

export interface LazySectionProps {
	/** Reserved height while hidden (prevents layout shift, e.g. `h-40`). */
	readonly height: string;
	/** The section content — only mounted once the section nears the viewport. */
	readonly children: React.ReactNode;
	/**
	 * How far (px) past the viewport edge to pre-load. A positive value means
	 * the section starts loading *before* it's actually visible, so by the time
	 * the user scrolls there it's usually already rendered.
	 */
	readonly rootMargin?: string;
	/**
	 * What to draw until the content mounts, in place of the default section
	 * bones. For a long list of sections pass a static box: hundreds of animated
	 * bones repaint on every frame while the page scrolls.
	 */
	readonly placeholder?: React.ReactNode;
	/**
	 * How the content appears once mounted. `animate` (the default) fades and
	 * slides it in. `instant` shows it as is — for a long page of sections that
	 * mount well before they scroll into view (a large `rootMargin`), where a
	 * reveal would only ever play on screen as flicker.
	 */
	readonly reveal?: LazySectionReveal;
	/**
	 * How the mount is committed. `transition` (the default) time-slices a heavy
	 * mount so scrolling stays smooth, but React then holds every section that
	 * reveals in the same moment until all of their lazy chunks have loaded.
	 * `urgent` commits at once, so each section's own loading state shows and it
	 * fills in as soon as ITS chunk arrives — for a page of many sections that
	 * each load their own code (a showcase page's examples).
	 */
	readonly commit?: LazySectionCommit;
}

export type LazySectionCommit = "transition" | "urgent";

/** Overflow values that make an element scroll its content (and clip what lies outside it). */
const SCROLLING_OVERFLOW = /(auto|scroll|overlay)/u;

/**
 * The element `node` scrolls inside: its nearest ancestor whose content
 * scrolls vertically, or `null` for the document (the viewport). The observer
 * measures against it, because a `rootMargin` only extends the ROOT — a
 * section clipped by a scrolling ancestor (the panel's `<main>`) would
 * otherwise count as hidden however large the margin.
 */
export function scrollParentOf(node: HTMLElement): HTMLElement | null {
	for (let parent = node.parentElement; parent !== null; parent = parent.parentElement) {
		if (SCROLLING_OVERFLOW.test(getComputedStyle(parent).overflowY)) {
			return parent;
		}
	}
	return null;
}

export type LazySectionReveal = "animate" | "instant";

const REVEAL_CLASS_NAMES: Readonly<Record<LazySectionReveal, string | undefined>> = {
	animate: "animate-in duration-300 fill-mode-both fade-in slide-in-from-bottom-2",
	instant: undefined,
};

/**
 * Viewport-triggered mounting for below-the-fold sections.
 *
 * Renders fixed-height section bones until an `IntersectionObserver` reports the
 * wrapper is near the viewport (default: within 300px) — measured against the
 * element it scrolls inside, so the margin holds inside a scrolling panel —
 * then mounts `children`
 * with a fade + slide-up reveal animation. The mount is a transition, so React
 * renders it in slices between frames and scrolling stays smooth while a heavy
 * section mounts. Once revealed it stays mounted (no
 * unmount-on-scroll-away), so scrolling back up never re-triggers a load.
 *
 * The bones are hidden from assistive technology: nothing is loading yet, so
 * there is nothing to announce. Once the section mounts, a `next/dynamic`
 * child announces its own load (`SectionSkeleton`, an announced region).
 *
 * This sits OUTSIDE the `next/dynamic` boundary: the heavy chunk for the
 * section still only downloads/parses when the dynamic component is first
 * rendered — i.e. when this section actually scrolls into view — instead of
 * during hydration.
 *
 * SSR/hydration: the server and the hydrating client both render the
 * skeleton (`useIsClient` is false until hydration ends), so the output never
 * mismatches. A browser without `IntersectionObserver` reveals the content
 * right after hydration instead of never.
 *
 * ⚠️ Constraint: IntersectionObserver only reports elements that are *visible*
 * in the scroll path. Do NOT wrap a `LazySection` inside a `display: none`
 * container (closed tab/accordion) — it would never trigger until shown.
 */
export function LazySection({ height, children, rootMargin = "300px 0px", placeholder, reveal = "animate", commit = "transition" }: LazySectionProps): React.JSX.Element {
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const [hasIntersected, setHasIntersected] = React.useState(false);
	const isClient = useIsClient();
	const lacksIntersectionObserver = isClient && !hasGlobalConstructor("IntersectionObserver");
	const visible = hasIntersected || lacksIntersectionObserver;

	React.useEffect(() => {
		const node = containerRef.current;
		if (node === null || visible || !hasGlobalConstructor("IntersectionObserver")) {
			return undefined;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					if (commit === "urgent") {
						setHasIntersected(true);
					} else {
						// A transition: mounting a heavy section (a data grid, a chart) is
						// time-sliced and yields to scrolling instead of blocking frames.
						React.startTransition((): void => {
							setHasIntersected(true);
						});
					}
					observer.disconnect();
				}
			},
			{ root: scrollParentOf(node), rootMargin },
		);
		observer.observe(node);
		return (): void => {
			observer.disconnect();
		};
	}, [visible, rootMargin, commit]);

	return (
		<div ref={containerRef}>
			{visible ? <div className={REVEAL_CLASS_NAMES[reveal]}>{children}</div> : <div aria-hidden="true">{placeholder ?? <SectionBones height={height} />}</div>}
		</div>
	);
}
