import type { DocsCollection } from "./document.ts";

/**
 * Slugs and file paths (plan §7). A file path is never built from a raw title: it comes only from a slug that
 * passed `isSafeSlug`, and every slug is checked again for collisions before anything is written.
 */

/** Segments of letters, digits, dots, dashes and underscores, joined by `/`. Existing pages such as `technical/api/README` must fit. */
const SLUG_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?(?:\/[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)*$/u;
const PARENT_SEGMENT = "..";
const MAX_SLUG_LENGTH = 200;

/** Folders below `docs/` a document must never land in: they hold posts, private notes, generated files or sync state. */
const RESERVED_GUIDE_FOLDERS: readonly string[] = ["blog", "history", "generated", "images", "assets", "sync"];

export const DOCS_ROOT = "docs";
const BLOG_FOLDER = "blog";
const MARKDOWN_EXTENSION = ".md";

function firstSegment(slug: string): string {
	const [segment = ""] = slug.split("/");
	return segment;
}

/** Whether a slug can safely name a page in this collection. */
export function isSafeSlug(slug: string, collection: DocsCollection): boolean {
	if (slug.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(slug) || slug.includes(PARENT_SEGMENT)) {
		return false;
	}
	return collection === "blog" || !RESERVED_GUIDE_FOLDERS.includes(firstSegment(slug));
}

/** The repository path of a page: `docs/<slug>.md`, or `docs/blog/<slug>.md`. */
export function filePathFor(slug: string, collection: DocsCollection): string {
	return collection === "blog" ? `${DOCS_ROOT}/${BLOG_FOLDER}/${slug}${MARKDOWN_EXTENSION}` : `${DOCS_ROOT}/${slug}${MARKDOWN_EXTENSION}`;
}

/** The site address of a page. */
export function siteUrlFor(slug: string, collection: DocsCollection): string {
	return collection === "blog" ? `/blog/${slug}` : `/docs/${slug}`;
}
