// ============================================
// lib/command/command-filter.ts — how a command list matches a search
// ============================================
// Pure, framework-free scoring for the kit's command primitive
// (components/ui/command-primitive.tsx). A score above 0 keeps an item in the
// list; the list keeps its own order (scores never re-sort it), so a group's
// rows stay where the author put them while the person types.

/** Scores one item against the search: 0 hides it, anything above 0 keeps it. */
export type CommandFilter = (value: string, search: string, keywords: readonly string[]) => number;

/** The whole search appears in the value or a keyword. */
export const COMMAND_SCORE_CONTAINS = 1;
/** Every word of the search appears somewhere (in any order). */
export const COMMAND_SCORE_ALL_WORDS = 0.8;
/** The search's letters appear in order ("dms" → "Direct messages"). */
export const COMMAND_SCORE_SUBSEQUENCE = 0.3;
export const COMMAND_SCORE_NONE = 0;

function normalize(text: string): string {
	return text.trim().toLocaleLowerCase();
}

/** Whether every character of `needle` occurs in `haystack`, in order (spaces in the needle are ignored). */
export function isSubsequence(needle: string, haystack: string): boolean {
	let position = 0;
	for (const character of needle.replaceAll(" ", "")) {
		const found = haystack.indexOf(character, position);
		if (found === -1) {
			return false;
		}
		position = found + 1;
	}
	return true;
}

/**
 * The default filter: case-insensitive, over the item's value and keywords.
 * An empty search keeps everything.
 */
export function defaultCommandFilter(value: string, search: string, keywords: readonly string[]): number {
	const needle = normalize(search);
	if (needle === "") {
		return COMMAND_SCORE_CONTAINS;
	}
	const haystack = normalize([value, ...keywords].join(" "));
	if (haystack.includes(needle)) {
		return COMMAND_SCORE_CONTAINS;
	}
	const words = needle.split(/\s+/);
	if (words.every((word: string): boolean => haystack.includes(word))) {
		return COMMAND_SCORE_ALL_WORDS;
	}
	return isSubsequence(needle, haystack) ? COMMAND_SCORE_SUBSEQUENCE : COMMAND_SCORE_NONE;
}
