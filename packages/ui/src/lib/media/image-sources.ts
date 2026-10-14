// ============================================
// lib/media/image-sources.ts — one image in several sizes, for srcset
// ============================================
// The API serves an uploaded image with its renditions (`ImageSource[]`,
// smallest first). Rendered as `srcset` + `sizes`, each screen downloads only
// the smallest rendition that is sharp at the size the image is drawn.

/** One served size of an image: its width in pixels and URL. */
export interface ImageSourceEntry {
	readonly width: number;
	readonly url: string;
}

/** An image as the API serves it: its own URL (plain `src`) and, when it has them, its renditions. */
export interface ResponsiveImage {
	readonly url: string;
	readonly sources?: readonly ImageSourceEntry[] | undefined;
}

/** `srcset` from renditions, smallest first (`url 128w, url 256w, …`), or `undefined` when there are none. */
export function imageSrcSet(sources: readonly ImageSourceEntry[] | undefined): string | undefined {
	if (sources === undefined || sources.length === 0) {
		return undefined;
	}
	return [...sources]
		.sort((first, second) => first.width - second.width)
		.map((source) => `${source.url} ${String(source.width)}w`)
		.join(", ");
}

/** `sizes` for an image always drawn `pixels` wide (an avatar, a logo tile). */
export function fixedImageSizes(pixels: number): string {
	return `${String(pixels)}px`;
}
