/** Hosts whose image URLs resize on request (`w`, `h`, `q`, `fit` query parameters). */
const RESIZING_HOSTS: ReadonlySet<string> = new Set(["images.unsplash.com"]);
/** JPEG/WebP quality for a thumbnail: small and sharp at card size. */
const THUMBNAIL_QUALITY = 70;

/**
 * A cover at thumbnail size: guide covers are 1600px wide for the article band; a card needs a fraction of
 * that. For a host that resizes on request the width (and a crop that keeps the card's shape) is asked for;
 * any other URL is returned unchanged.
 */
export function coverThumbnail(url: string, width: number, height: number): string {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return url;
	}
	if (!RESIZING_HOSTS.has(parsed.hostname)) {
		return url;
	}
	parsed.searchParams.set("w", String(width));
	parsed.searchParams.set("h", String(height));
	parsed.searchParams.set("fit", "crop");
	parsed.searchParams.set("auto", "format");
	parsed.searchParams.set("q", String(THUMBNAIL_QUALITY));
	return parsed.href;
}
