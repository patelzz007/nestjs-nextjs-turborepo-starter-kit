"use client";

import { hasGlobalConstructor } from "@workspace/shared";
import * as React from "react";

/** What `useElementWidth` hands back: a ref to put on the element, and its width once measured. */
export interface ElementWidth<TElement extends Element> {
	/** A callback ref: put it on the element to measure. */
	readonly ref: React.RefCallback<TElement>;
	/** The element's content-box width in pixels, or `null` until the first measurement (and on the server). */
	readonly width: number | null;
}

/**
 * Measures an element's width and follows it as it changes, with a `ResizeObserver`. Use it when a layout depends on
 * the space a component is GIVEN (a table in a narrow side panel) rather than on the window: a media query cannot
 * see that.
 */
export function useElementWidth<TElement extends Element>(): ElementWidth<TElement> {
	const [width, setWidth] = React.useState<number | null>(null);
	const observerRef = React.useRef<ResizeObserver | null>(null);

	const ref = React.useCallback((element: TElement | null): void => {
		observerRef.current?.disconnect();
		observerRef.current = null;
		// Without a ResizeObserver (an old browser, a test environment) the width stays unknown, and the caller falls
		// back to whatever it uses before the first measurement.
		if (element === null || !hasGlobalConstructor("ResizeObserver")) {
			return;
		}
		const observer = new ResizeObserver((entries: ResizeObserverEntry[]): void => {
			const entry = entries.at(-1);
			if (entry !== undefined) {
				setWidth(entry.contentRect.width);
			}
		});
		observer.observe(element);
		observerRef.current = observer;
	}, []);

	return { ref, width };
}
