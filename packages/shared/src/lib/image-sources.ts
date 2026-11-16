// One image in several sizes, as the API serves an upload (its URL and its renditions, smallest first), shared by the
// web kit (which writes them as `srcset`) and the native kit (which picks one for the size it draws).

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

/**
 * The URL of the smallest rendition at least `pixels` wide (device pixels: the drawn size times the screen's pixel
 * ratio), else the largest there is, else the image's own URL.
 */
export function pickImageRendition(image: ResponsiveImage, pixels: number): string {
	const sorted = [...(image.sources ?? [])].sort((first, second): number => first.width - second.width);
	return (sorted.find((source): boolean => source.width >= pixels) ?? sorted.at(-1))?.url ?? image.url;
}
