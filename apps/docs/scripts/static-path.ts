import path from "node:path";

/** Which files in `dist/client` can answer a URL path. Pure, so the path checks are tested without a server. */

const CONTENT_TYPES: Readonly<Record<string, string>> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".xml": "application/xml; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".avif": "image/avif",
	".ico": "image/x-icon",
	".woff2": "font/woff2",
	".pdf": "application/pdf",
};

const DEFAULT_CONTENT_TYPE = "application/octet-stream";

export function contentTypeOf(file: string): string {
	return CONTENT_TYPES[path.extname(file).toLowerCase()] ?? DEFAULT_CONTENT_TYPE;
}

/**
 * The files to try for a URL path, in order, all inside `root`: the pre-render writes `/docs/x` as `docs/x.html` and
 * `/` as `index.html`. Empty for a path that would leave `root`.
 */
export function staticCandidates(root: string, pathname: string): readonly string[] {
	let decoded: string;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return [];
	}
	if (decoded.includes("\0")) {
		return [];
	}
	const target = path.resolve(root, `.${decoded}`);
	const isInside = target === root || target.startsWith(`${root}${path.sep}`);
	if (!isInside) {
		return [];
	}
	return target === root ? [path.join(root, "index.html")] : [target, `${target}.html`];
}
