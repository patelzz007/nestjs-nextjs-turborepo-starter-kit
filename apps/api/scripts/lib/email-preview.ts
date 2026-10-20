// Pure helpers of `dev.ts email-previews` (the docs gallery screenshots of every email template).

const DARK_MEDIA_QUERY = "@media (prefers-color-scheme: dark)";
const COLOR_SCHEME_METAS: readonly string[] = ['<meta name="color-scheme" content="light dark">', '<meta name="supported-color-schemes" content="light dark">'];

/** The index just past the `}` that closes the block whose `{` is the first one at or after `from`, or -1. */
function blockEnd(css: string, from: number): number {
	const open = css.indexOf("{", from);
	if (open === -1) {
		return -1;
	}
	let depth = 0;
	for (let index = open; index < css.length; index += 1) {
		const character = css.charAt(index);
		if (character === "{") {
			depth += 1;
		} else if (character === "}") {
			depth -= 1;
			if (depth === 0) {
				return index + 1;
			}
		}
	}
	return -1;
}

/** `html` without any `@media (prefers-color-scheme: dark) { … }` block (nested braces included). */
export function stripDarkMediaBlocks(html: string): string {
	let result = html;
	for (let start = result.indexOf(DARK_MEDIA_QUERY); start !== -1; start = result.indexOf(DARK_MEDIA_QUERY)) {
		const end = blockEnd(result, start);
		if (end === -1) {
			return result;
		}
		result = result.slice(0, start) + result.slice(end);
	}
	return result;
}

/**
 * The template pinned to its light rendering: headless Chrome follows the OS colour scheme, so a machine in
 * dark mode would otherwise screenshot the dark variant. The shipped templates keep their dark mode.
 */
export function lightPinnedHtml(html: string): string {
	return COLOR_SCHEME_METAS.reduce((pinned: string, meta: string): string => pinned.replace(meta, ""), stripDarkMediaBlocks(html));
}
