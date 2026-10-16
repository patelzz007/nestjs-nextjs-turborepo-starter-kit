"use client";

// Ported from ReUI (https://reui.io/r/base-vega/scrollspy.json): wraps a nav
// whose links carry `data-scrollspy-anchor="<section id>"`; it marks the link
// of the section in view with `data-active="true"`, scrolls to a section when
// its link is clicked, and keeps the URL hash in sync. Props (`targetRef`,
// `onUpdate`, `offset`, `smooth`, `dataAttribute`, `history`, `throttleTime`)
// match ReUI, with these deliberate deviations:
// - The root forwards its ref and accepts every `div` prop.
// - Omitting `targetRef` spies on the document (ReUI tracked nothing).
// - `throttleTime` is honoured (ReUI declared it but ignored it): scroll
//   updates run at most once per `throttleTime` ms, with a trailing update.
// - Click listeners are removed on cleanup (ReUI added a fresh closure per
//   anchor and removed a different one, leaking every listener).
// - The initial hash is matched against the anchors directly instead of
//   through a CSS selector, so no `CSS.escape` is needed.
import { assignRef } from "@workspace/ui/lib/core/merge-refs";
import * as React from "react";

/** A spy target: a scrollable element, or the document itself. */
type ScrollspyTarget = HTMLElement | Document | null | undefined;

interface ScrollspyProps extends React.ComponentProps<"div"> {
	readonly children: React.ReactNode;
	/** The scroll container to spy on; defaults to the document. A `ScrollArea` is followed into its viewport. */
	readonly targetRef?: React.RefObject<ScrollspyTarget> | undefined;
	/** Called with the active section id whenever it is set. */
	readonly onUpdate?: ((id: string) => void) | undefined;
	/** Pixels subtracted from each section's top (e.g. a sticky header). Per-anchor `data-<attr>-offset` wins. */
	readonly offset?: number | undefined;
	/** Smooth-scroll when an anchor is clicked. */
	readonly smooth?: boolean | undefined;
	/** The data attribute stem: anchors carry `data-<attr>-anchor`. */
	readonly dataAttribute?: string | undefined;
	/** Mirror the active section into the URL hash (`history.replaceState`). */
	readonly history?: boolean | undefined;
	/** Minimum milliseconds between scroll-driven updates (0 = every scroll event). */
	readonly throttleTime?: number | undefined;
}

/** Treat the container as scrolled to the bottom within this many pixels. */
const BOTTOM_TOLERANCE_PX = 2;
/** Delay before the first sync, so the page has laid out the sections. */
const INITIAL_SYNC_DELAY_MS = 100;
const DECIMAL_RADIX = 10;
const SCROLL_AREA_VIEWPORT_SELECTOR = '[data-slot="scroll-area-viewport"]';
const HASH_PREFIX = "#";

/** The element whose `scrollTop` moves: the document's root, or the target (through a ScrollArea viewport). */
function resolveScrollElement(target: ScrollspyTarget): HTMLElement {
	if (target === null || target === undefined || target instanceof Document) {
		return document.documentElement;
	}
	const viewport = target.querySelector(SCROLL_AREA_VIEWPORT_SELECTOR);
	return viewport instanceof HTMLElement ? viewport : target;
}

/** The anchor's section id (without a leading `#`), or null. */
function anchorSectionId(anchor: Element, dataAttribute: string): string | null {
	const raw = anchor.getAttribute(`data-${dataAttribute}-anchor`);
	if (raw === null) {
		return null;
	}
	const id = raw.startsWith(HASH_PREFIX) ? raw.slice(HASH_PREFIX.length) : raw;
	return id.length > 0 ? id : null;
}

/** The anchor's own offset (`data-<attr>-offset`), or the spy's default. */
function anchorOffset(anchor: Element, dataAttribute: string, fallback: number): number {
	const raw = anchor.getAttribute(`data-${dataAttribute}-offset`);
	if (raw === null || raw.length === 0) {
		return fallback;
	}
	const parsed = Number.parseInt(raw, DECIMAL_RADIX);
	return Number.isNaN(parsed) ? fallback : parsed;
}

const Scrollspy = React.forwardRef<HTMLDivElement, ScrollspyProps>(function Scrollspy(
	{ children, targetRef, onUpdate, offset = 0, smooth = true, dataAttribute = "scrollspy", history = true, throttleTime = 0, ...props },
	ref,
): React.JSX.Element {
	const selfRef = React.useRef<HTMLDivElement | null>(null);
	const anchorsRef = React.useRef<Element[]>([]);
	const previousIdRef = React.useRef<string | null>(null);

	const setRefs = React.useCallback(
		(node: HTMLDivElement | null): void => {
			selfRef.current = node;
			assignRef(ref, node);
		},
		[ref],
	);

	const setActiveSection = React.useCallback(
		(sectionId: string | null, force: boolean): void => {
			if (sectionId === null) {
				return;
			}
			for (const anchor of anchorsRef.current) {
				if (anchorSectionId(anchor, dataAttribute) === sectionId) {
					anchor.setAttribute("data-active", "true");
				} else {
					anchor.removeAttribute("data-active");
				}
			}
			onUpdate?.(sectionId);
			if (history && (force || previousIdRef.current !== sectionId)) {
				window.history.replaceState({}, "", `${HASH_PREFIX}${sectionId}`);
			}
			previousIdRef.current = sectionId;
		},
		[dataAttribute, history, onUpdate],
	);

	const handleScroll = React.useCallback((): void => {
		const anchors = anchorsRef.current;
		if (anchors.length === 0) {
			return;
		}
		const scrollElement = resolveScrollElement(targetRef?.current);
		const scrollTop = scrollElement === document.documentElement ? window.scrollY || document.documentElement.scrollTop : scrollElement.scrollTop;

		// The anchor whose section is closest to, but not past, the top.
		let activeIndex = 0;
		let minDelta = Number.POSITIVE_INFINITY;
		anchors.forEach((anchor, index): void => {
			const sectionId = anchorSectionId(anchor, dataAttribute);
			const section = sectionId === null ? null : document.getElementById(sectionId);
			if (section === null) {
				return;
			}
			const sectionTop = section.offsetTop - anchorOffset(anchor, dataAttribute, offset);
			const delta = Math.abs(sectionTop - scrollTop);
			if (sectionTop <= scrollTop && delta < minDelta) {
				minDelta = delta;
				activeIndex = index;
			}
		});

		// Scrolled to the bottom: the last section can never reach the top, so force it.
		if (scrollTop + scrollElement.clientHeight >= scrollElement.scrollHeight - BOTTOM_TOLERANCE_PX) {
			activeIndex = anchors.length - 1;
		}

		const activeAnchor = anchors.at(activeIndex);
		setActiveSection(activeAnchor === undefined ? null : anchorSectionId(activeAnchor, dataAttribute), false);
	}, [dataAttribute, offset, setActiveSection, targetRef]);

	const scrollToAnchor = React.useCallback(
		(anchor: Element): void => {
			const sectionId = anchorSectionId(anchor, dataAttribute);
			const section = sectionId === null ? null : document.getElementById(sectionId);
			if (section === null) {
				return;
			}
			const target = targetRef?.current;
			const scrollElement = target === null || target === undefined || target instanceof Document ? window : resolveScrollElement(target);
			scrollElement.scrollTo({
				top: section.offsetTop - anchorOffset(anchor, dataAttribute, offset),
				left: 0,
				behavior: smooth ? "smooth" : "auto",
			});
			setActiveSection(sectionId, true);
		},
		[dataAttribute, offset, setActiveSection, smooth, targetRef],
	);

	React.useEffect(() => {
		const root = selfRef.current;
		const anchors = root === null ? [] : Array.from(root.querySelectorAll(`[data-${dataAttribute}-anchor]`));
		anchorsRef.current = anchors;

		const clickHandlers = new Map<Element, (event: Event) => void>();
		for (const anchor of anchors) {
			const onClick = (event: Event): void => {
				event.preventDefault();
				scrollToAnchor(anchor);
			};
			clickHandlers.set(anchor, onClick);
			anchor.addEventListener("click", onClick);
		}

		let lastRun = 0;
		let trailingTimer: number | null = null;
		const runThrottled = (): void => {
			if (throttleTime <= 0) {
				handleScroll();
				return;
			}
			const now = Date.now();
			const remaining = throttleTime - (now - lastRun);
			if (remaining <= 0) {
				lastRun = now;
				handleScroll();
				return;
			}
			trailingTimer ??= window.setTimeout((): void => {
				trailingTimer = null;
				lastRun = Date.now();
				handleScroll();
			}, remaining);
		};

		const onScroll = (event: Event): void => {
			const target = targetRef?.current;
			const followsDocument = target === null || target === undefined || target instanceof Document;
			if (followsDocument || (event.target instanceof Node && target.contains(event.target))) {
				runThrottled();
			}
		};

		// Capture on window catches scroll events from the target even if it mounts later.
		window.addEventListener("scroll", onScroll, true);

		// Scroll to the section named by the URL hash, then sync the active anchor.
		const initialTimer = window.setTimeout((): void => {
			const hash = window.location.hash.startsWith(HASH_PREFIX) ? window.location.hash.slice(HASH_PREFIX.length) : window.location.hash;
			const hashAnchor = hash.length > 0 ? anchors.find((anchor): boolean => anchorSectionId(anchor, dataAttribute) === hash) : undefined;
			if (hashAnchor !== undefined) {
				scrollToAnchor(hashAnchor);
			}
			handleScroll();
		}, INITIAL_SYNC_DELAY_MS);

		return (): void => {
			window.removeEventListener("scroll", onScroll, true);
			for (const [anchor, onClick] of clickHandlers) {
				anchor.removeEventListener("click", onClick);
			}
			window.clearTimeout(initialTimer);
			if (trailingTimer !== null) {
				window.clearTimeout(trailingTimer);
			}
		};
	}, [dataAttribute, handleScroll, scrollToAnchor, targetRef, throttleTime]);

	return (
		<div ref={setRefs} data-slot="scrollspy" {...props}>
			{children}
		</div>
	);
});

export { Scrollspy };
export type { ScrollspyProps };
