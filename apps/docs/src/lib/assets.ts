/**
 * Helpers for serving the repo-root `docs/images/` folder at `/images/…`
 * (see `src/pages/images/[...path].ts`). Images are pulled in with Vite's
 * `?inline` glob, which yields data URLs; these turn them back into bytes.
 */

/** Glob key (`../../../../../docs/images/email/a.png`) → route param (`email/a.png`). */
export function imageRouteParam(globKey: string): string | null {
	const marker = "/docs/images/";
	const index = globKey.indexOf(marker);
	return index < 0 ? null : globKey.slice(index + marker.length);
}

/** Decodes a `data:` URL (base64 or percent-encoded, as Vite emits for SVG) into bytes. */
export function dataUrlToBytes(dataUrl: string): Uint8Array<ArrayBuffer> {
	const comma = dataUrl.indexOf(",");
	if (!dataUrl.startsWith("data:") || comma < 0) {
		throw new Error("Expected a data: URL");
	}
	const header = dataUrl.slice(0, comma);
	const payload = dataUrl.slice(comma + 1);
	if (header.endsWith(";base64")) {
		return Uint8Array.from(atob(payload), (character) => character.charCodeAt(0));
	}
	return new TextEncoder().encode(decodeURIComponent(payload));
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	avif: "image/avif",
	svg: "image/svg+xml",
};

/** Content type from a file extension (`application/octet-stream` when unknown). */
export function imageContentType(filePath: string): string {
	const extension = filePath.slice(filePath.lastIndexOf(".") + 1).toLowerCase();
	return CONTENT_TYPES[extension] ?? "application/octet-stream";
}
