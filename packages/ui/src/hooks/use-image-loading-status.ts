"use client";

import * as React from "react";

/** Where an image is in loading: nothing to load, on its way, ready to show, or failed. */
export type ImageLoadingStatus = "idle" | "loading" | "loaded" | "error";

interface SettledImage {
	readonly src: string;
	readonly status: "loaded" | "error";
}

/**
 * Tracks whether `src` has loaded, off-element: a detached `Image` fetches it
 * (the browser then serves the rendered `<img>` from its cache), so the
 * visible element carries no load handlers and an image that finished before
 * hydration is still reported — the `load` event of the detached copy fires
 * after this effect attaches it. A new `src` reads as `loading` at once,
 * derived during render rather than reset in an effect. Nothing is fetched
 * while `enabled` is false (e.g. until the image nears the viewport).
 */
export function useImageLoadingStatus(src: string | null | undefined, enabled = true): ImageLoadingStatus {
	const [settled, setSettled] = React.useState<SettledImage | null>(null);
	const hasSource = src !== null && src !== undefined && src.length > 0;

	React.useEffect((): (() => void) | undefined => {
		if (!enabled || src === null || src === undefined || src.length === 0) {
			return undefined;
		}
		const image = new window.Image();
		const handleLoad = (): void => {
			setSettled({ src, status: "loaded" });
		};
		const handleError = (): void => {
			setSettled({ src, status: "error" });
		};
		image.addEventListener("load", handleLoad);
		image.addEventListener("error", handleError);
		image.src = src;
		return (): void => {
			image.removeEventListener("load", handleLoad);
			image.removeEventListener("error", handleError);
		};
	}, [enabled, src]);

	if (!hasSource) {
		return "idle";
	}
	return settled !== null && settled.src === src ? settled.status : "loading";
}
