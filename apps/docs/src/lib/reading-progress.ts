/**
 * Reading progress for the "On this page" timeline: where the reader is, as pure arithmetic over the
 * sections' positions, so the browser hook stays a thin measuring layer and this is tested on its own.
 * All positions are document offsets in px; `scrollTop` is the reading line (the viewport top plus the
 * sticky header and some air).
 */
export interface SectionMark {
	readonly slug: string;
	/** Document offset of the section's heading. */
	readonly top: number;
	/** Words in the section (0 when unknown). */
	readonly words: number;
}

export interface ArticleBounds {
	readonly top: number;
	readonly bottom: number;
}

export interface ReadingState {
	/** The section the reading line is in; `null` above the first heading. */
	readonly activeSlug: string | null;
	readonly activeIndex: number;
	/** How far through the active section the reading line is, 0–1. */
	readonly withinActive: number;
	/** Share of the article scrolled past, 0–100 (whole numbers). */
	readonly percent: number;
	/** Words still ahead of the reading line, from the sections' word counts. */
	readonly wordsLeft: number;
}

const PERCENT = 100;

function clamp(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/** Where the reader is, given every section's heading position and the article's extent. */
export function readingState(sections: readonly SectionMark[], article: ArticleBounds, readingLine: number, viewportHeight: number): ReadingState {
	// Sections are in document order, so the last one whose heading is above the line is the one being read.
	const activeIndex = sections.reduce((found, section, index) => (section.top <= readingLine ? index : found), -1);
	const active = sections[activeIndex];
	const next = sections[activeIndex + 1];
	const sectionEnd = next?.top ?? article.bottom;
	const withinActive = active === undefined ? 0 : clamp((readingLine - active.top) / Math.max(1, sectionEnd - active.top));
	const scrollable = Math.max(1, article.bottom - article.top - viewportHeight);
	const scrolled = clamp((readingLine - article.top) / scrollable);
	const ahead = sections.slice(activeIndex + 1).reduce((total, section) => total + section.words, 0);
	const wordsLeft = Math.round(ahead + (active === undefined ? 0 : active.words * (1 - withinActive)));
	return { activeSlug: active?.slug ?? null, activeIndex, withinActive, percent: Math.round(scrolled * PERCENT), wordsLeft };
}
