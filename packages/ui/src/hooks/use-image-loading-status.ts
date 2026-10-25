"use client";

import * as React from "react";

/** Where an image is in loading: nothing to load, on its way, ready to show, or failed. */
export type ImageLoadingStatus = "idle" | "loading" | "loaded" | "error";

interface SettledImage {
	/** The `src` + `srcset` + `sizes` the status belongs to. */
	readonly key: string;
	readonly status: "loaded" | "error";
}

/** Renditions of the image, as the rendered `<img>` declares them. */
export interface ResponsiveImageSources {
	readonly srcSet?: string | undefined;
	readonly sizes?: string | undefined;
}

/**
 * Tracks whether `src` has loaded, off-element: a detached `Image` fetches it
 * (the browser then serves the rendered `<img>` from its cache), so the
 * visible element carries no load handlers and an image that finished before
 * hydration is still reported — the `load` event of the detached copy fires
 * after this effect attaches it. A new `src` reads as `loading` at once,
 * derived during render rather than reset in an effect. Nothing is fetched
 * while `enabled` is false (e.g. until the image nears the viewport).
 *
 * Pass the `<img>`'s `srcSet`/`sizes` in `responsive`: the detached copy then
 * picks the same rendition the element will (one download, served from cache)
 * — without them it would fetch the full-size `src` as well.
 */
export function useImageLoadingStatus(src: string | null | undefined, enabled = true, responsive: ResponsiveImageSources = {}): ImageLoadingStatus {
	const [settled, setSettled] = React.useState<SettledImage | null>(null);
	const hasSource = src !== null && src !== undefined && src.length > 0;
	const { srcSet, sizes } = responsive;
	const key = `${src ?? ""}\n${srcSet ?? ""}\n${sizes ?? ""}`;

	React.useEffect((): (() => void) | undefined => {
		if (!enabled || src === null || src === undefined || src.length === 0) {
			return undefined;
		}
		const image = new window.Image();
		const handleLoad = (): void => {
			setSettled({ key, status: "loaded" });
		};
		const handleError = (): void => {
			setSettled({ key, status: "error" });
		};
		image.addEventListener("load", handleLoad);
		image.addEventListener("error", handleError);
		// `sizes` and `srcset` before `src`: the candidate is chosen when the source is set.
		if (sizes !== undefined) {
			image.sizes = sizes;
		}
		if (srcSet !== undefined) {
			image.srcset = srcSet;
		}
		image.src = src;
		return (): void => {
			image.removeEventListener("load", handleLoad);
			image.removeEventListener("error", handleError);
		};
	}, [enabled, key, sizes, src, srcSet]);

	if (!hasSource) {
		return "idle";
	}
	return settled?.key === key ? settled.status : "loading";
}
