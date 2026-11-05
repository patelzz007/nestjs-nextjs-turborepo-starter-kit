import { useEffect, useState, type RefObject } from "react";

import type { TimelineItem } from "@/lib/content";
import { readingState, type ReadingState, type SectionMark } from "@/lib/reading-progress";

/** Px below the viewport top where reading "happens": the sticky header plus some air. */
export const READING_LINE_OFFSET_PX = 96;

export const EMPTY_READING_STATE: ReadingState = { activeSlug: null, activeIndex: -1, withinActive: 0, percent: 0, wordsLeft: 0 };

/** Each item's heading position in the document (items whose heading is missing are left out). */
function marks(items: readonly TimelineItem[]): readonly SectionMark[] {
	return items.flatMap((item): SectionMark[] => {
		const heading = document.getElementById(item.slug);
		return heading === null ? [] : [{ slug: item.slug, top: heading.getBoundingClientRect().top + window.scrollY, words: item.words }];
	});
}

/**
 * Where the reader is in `articleRef`, measured on scroll (once per frame) and resize: the state for the
 * h2 groups (the timeline's nodes) and for every entry (which h3 is current).
 */
export function useReadingProgress(
	articleRef: RefObject<HTMLElement | null>,
	groups: readonly TimelineItem[],
	items: readonly TimelineItem[],
): { readonly group: ReadingState; readonly item: ReadingState } {
	const [state, setState] = useState({ group: EMPTY_READING_STATE, item: EMPTY_READING_STATE });

	useEffect((): (() => void) => {
		let frame = 0;
		const measure = (): void => {
			frame = 0;
			const article = articleRef.current;
			if (article === null) {
				return;
			}
			const rect = article.getBoundingClientRect();
			const bounds = { top: rect.top + window.scrollY, bottom: rect.bottom + window.scrollY };
			const line = window.scrollY + READING_LINE_OFFSET_PX;
			setState({ group: readingState(marks(groups), bounds, line, window.innerHeight), item: readingState(marks(items), bounds, line, window.innerHeight) });
		};
		const schedule = (): void => {
			if (frame === 0) {
				frame = window.requestAnimationFrame(measure);
			}
		};
		measure();
		window.addEventListener("scroll", schedule, { passive: true });
		window.addEventListener("resize", schedule);
		return (): void => {
			window.cancelAnimationFrame(frame);
			window.removeEventListener("scroll", schedule);
			window.removeEventListener("resize", schedule);
		};
	}, [articleRef, groups, items]);

	return state;
}
