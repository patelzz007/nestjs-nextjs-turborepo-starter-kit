// The native MessageScroller's scroll maths, pure: where the reader is (near either edge), what can still scroll,
// which messages are on screen and which anchored turn is current, where to scroll to lift a turn to the top under a
// peek of the one before, how much room an anchored turn needs below it, and how far to shift when older messages
// arrive above so the reader keeps their place. The component measures; these decide.

/** Where a transcript opens: at its start, its end (the newest), or with its last anchored turn at the top. */
export type MessageScrollerDefaultScrollPosition = "start" | "end" | "last-anchor";

/** One message's place in the content: its top and height, in points. */
export interface MessageLayout {
	readonly id: string;
	readonly y: number;
	readonly height: number;
	/** A turn the reader lands on (a question just sent), lifted to the top when it arrives. */
	readonly anchor: boolean;
}

/** The scroll view's state: how far it has scrolled, how tall it is, how tall its content is. */
export interface ScrollMetrics {
	readonly offset: number;
	readonly viewport: number;
	readonly content: number;
}

/** Whether the transcript can still scroll towards its start and its end. */
export interface MessageScrollerScrollable {
	readonly start: boolean;
	readonly end: boolean;
}

/** The messages on screen, and the anchored turn the reader is in. */
export interface MessageScrollerVisibility {
	readonly currentAnchorId: string | null;
	readonly visibleMessageIds: readonly string[];
}

/** How close to an edge counts as at it, in points. */
export const DEFAULT_SCROLL_EDGE_THRESHOLD = 24;
/** How much of the turn before an anchored turn stays in view above it, in points. */
export const DEFAULT_PREVIOUS_ITEM_PEEK = 64;

/** The furthest the view can scroll. */
export function maxScrollOffset({ viewport, content }: ScrollMetrics): number {
	return Math.max(0, content - viewport);
}

/** Whether the reader is within `threshold` of the end (following new messages there). */
export function isNearEnd(metrics: ScrollMetrics, threshold: number): boolean {
	return maxScrollOffset(metrics) - metrics.offset <= threshold;
}

/** What is left to scroll each way, beyond `threshold`. */
export function scrollableFrom(metrics: ScrollMetrics, threshold: number): MessageScrollerScrollable {
	return { start: metrics.offset > threshold, end: !isNearEnd(metrics, threshold) };
}

/** The offset that puts a message at the top of the view, `peek` points of the one before still showing, within range. */
export function anchorOffset(message: MessageLayout, metrics: ScrollMetrics, peek: number): number {
	return Math.min(maxScrollOffset(metrics), Math.max(0, message.y - peek));
}

/**
 * The empty room the content needs after an anchored turn so it can be lifted to the top: the view's height, less the
 * peek and the content from the turn down. None when there is no anchored turn or the content below already fills it.
 */
export function anchorSpacer(layouts: readonly MessageLayout[], viewport: number, peek: number): number {
	const anchor = layouts.filter((layout: MessageLayout): boolean => layout.anchor).at(-1);
	const last = layouts.at(-1);
	if (anchor === undefined || last === undefined) {
		return 0;
	}
	const below = last.y + last.height - anchor.y;
	return Math.max(0, viewport - peek - below);
}

/** The messages that overlap the view, in order. */
export function visibleMessages(layouts: readonly MessageLayout[], metrics: ScrollMetrics): readonly string[] {
	const bottom = metrics.offset + metrics.viewport;
	return layouts.filter((layout: MessageLayout): boolean => layout.y < bottom && layout.y + layout.height > metrics.offset).map((layout: MessageLayout): string => layout.id);
}

/** The anchored turn the reader is in: the last one whose top has reached the top of the view (less the peek). */
export function currentAnchor(layouts: readonly MessageLayout[], metrics: ScrollMetrics, peek: number): string | null {
	const reached = layouts.filter((layout: MessageLayout): boolean => layout.anchor && layout.y - peek <= metrics.offset + 1);
	return reached.at(-1)?.id ?? layouts.find((layout: MessageLayout): boolean => layout.anchor)?.id ?? null;
}

export function visibilityOf(layouts: readonly MessageLayout[], metrics: ScrollMetrics, peek: number): MessageScrollerVisibility {
	return { currentAnchorId: currentAnchor(layouts, metrics, peek), visibleMessageIds: visibleMessages(layouts, metrics) };
}

/** The message the reader is on: the first one on screen, with where it was when they were last seen there. */
export interface ReadingPosition {
	readonly id: string;
	readonly y: number;
}

/** Where the reader is: the first message on screen and its top, or `null` with nothing on screen. */
export function readingPosition(layouts: readonly MessageLayout[], metrics: ScrollMetrics): ReadingPosition | null {
	const [first] = visibleMessages(layouts, metrics);
	const layout = layouts.find((candidate: MessageLayout): boolean => candidate.id === first);
	return layout === undefined ? null : { id: layout.id, y: layout.y };
}

/**
 * How far the message the reader is on has moved (older messages arriving above push it down): the distance to scroll
 * so it stays where it was. Zero when it has not moved, or is gone.
 */
export function readingShift(reading: ReadingPosition | null, layouts: readonly MessageLayout[]): number {
	const now = reading === null ? undefined : layouts.find((layout: MessageLayout): boolean => layout.id === reading.id);
	return reading === null || now === undefined ? 0 : now.y - reading.y;
}

/** Where the transcript opens. */
export function openingOffset(position: MessageScrollerDefaultScrollPosition, layouts: readonly MessageLayout[], metrics: ScrollMetrics, peek: number): number {
	if (position === "start") {
		return 0;
	}
	const anchor = layouts.filter((layout: MessageLayout): boolean => layout.anchor).at(-1);
	return position === "last-anchor" && anchor !== undefined ? anchorOffset(anchor, metrics, peek) : maxScrollOffset(metrics);
}
