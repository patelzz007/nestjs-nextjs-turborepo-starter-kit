// The page header's motion, driven by the page's scroll position. The header has two parts: a
// pinned row (menu, title, notifications) that never moves, and a subtitle line below it that
// collapses as the page scrolls. `progress` runs from 0 (expanded, at the top of the page) to 1
// (collapsed) over the subtitle line's height — scroll-linked, so the header moves exactly with the
// content, on the UI thread.
//
// The app shell owns the values and the header reads them. Every screen inside the shell feeds them
// from its own scroll view while it is the focused screen; when a screen gains focus it hands the
// header its own position, so switching pages never leaves a stale header behind.

import { useFocusEffect } from "expo-router";
import * as React from "react";
import {
	clamp,
	Easing,
	ReduceMotion,
	useAnimatedScrollHandler,
	useDerivedValue,
	useSharedValue,
	withTiming,
	type ScrollEvent,
	type SharedValue,
	type WithTimingConfig,
} from "react-native-reanimated";

export interface PageHeaderScroll {
	/** The focused screen's scroll position, in points from the top. */
	readonly scrollY: SharedValue<number>;
	/** How far the page scrolls while the header collapses: the subtitle line's height. */
	readonly collapseDistance: SharedValue<number>;
}

const PageHeaderScrollContext = React.createContext<PageHeaderScroll | null>(null);

export const PageHeaderScrollProvider = PageHeaderScrollContext.Provider;

/** The header's scroll link while one is laid over the screen, otherwise `null`. */
export function usePageHeaderScroll(): PageHeaderScroll | null {
	return React.use(PageHeaderScrollContext);
}

const AT_TOP = 0;
const EXPANDED = 0;
const COLLAPSED = 1;
/** Guards the division before the subtitle line has been measured. */
const MIN_COLLAPSE_DISTANCE = 1;
const SYNC_DURATION_MS = 220;

/** How the header catches up with a newly focused page's scroll position: quick, instant with Reduce Motion. */
export const PAGE_HEADER_SYNC_TIMING: WithTimingConfig = {
	duration: SYNC_DURATION_MS,
	easing: Easing.out(Easing.cubic),
	reduceMotion: ReduceMotion.System,
};

/** 0 expanded … 1 collapsed: the scroll position over the collapse distance. A worklet, so the UI thread computes it. */
export function headerProgressOf(scrollY: number, collapseDistance: number): number {
	"worklet";
	return clamp(scrollY / Math.max(collapseDistance, MIN_COLLAPSE_DISTANCE), EXPANDED, COLLAPSED);
}

/** 0 expanded … 1 collapsed, following the focused page's scrolling. */
export function usePageHeaderProgress(scroll: PageHeaderScroll): SharedValue<number> {
	// No dependency array: on native Reanimated tracks the worklet's captured values itself (an array
	// is web-only, and warns on a phone).
	return useDerivedValue((): number => headerProgressOf(scroll.scrollY.get(), scroll.collapseDistance.get()));
}

/** A pull to refresh pulls past the top: the header stays expanded. */
export function headerScrollPositionOf(contentOffsetY: number): number {
	"worklet";
	return Math.max(contentOffsetY, AT_TOP);
}

/**
 * Connects a screen to the header: the returned handler goes on the screen's scroll view (`onScroll`).
 * A screen that does not scroll still calls this, so the header expands when it gains focus.
 * Does nothing outside the shell.
 */
export function usePageHeaderScrollHandler(): ReturnType<typeof useAnimatedScrollHandler> {
	const scroll = usePageHeaderScroll();
	const position = useSharedValue(AT_TOP);
	const focused = useSharedValue(false);

	useFocusEffect(
		React.useCallback((): (() => void) | undefined => {
			if (scroll === null) {
				return undefined;
			}
			focused.set(true);
			scroll.scrollY.set(withTiming(position.get(), PAGE_HEADER_SYNC_TIMING));
			return (): void => {
				focused.set(false);
			};
		}, [focused, position, scroll]),
	);

	return useAnimatedScrollHandler({
		onScroll: (event: ScrollEvent): void => {
			const y = headerScrollPositionOf(event.contentOffset.y);
			position.set(y);
			if (scroll !== null && focused.get()) {
				scroll.scrollY.set(y);
			}
		},
	});
}
