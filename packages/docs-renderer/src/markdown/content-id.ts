/**
 * Stable id for a content file path: `technical/authorization/overview.md` → `technical/authorization/overview`.
 * The id keeps the file's case (`README.md` → `README`) and is the page's URL below `/docs/` or `/blog/`.
 */
export function contentId(entryPath: string): string {
	return entryPath.replace(/\\/g, "/").replace(/\.mdx?$/, "");
}
