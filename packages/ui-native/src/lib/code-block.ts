// The native CodeBlock's line maths, pure: the rows it draws (each line, a note under a line, a folded region's
// summary — one line tall each, so the fixed gutter and the scrolling code stay level), which stretches of a line a
// highlight marks (a word, a search match), splitting coloured tokens at those stretches, and terminal output's ANSI
// colour codes read as token roles.

/** A colour role a token can carry: code's (keyword, string…) or a terminal's (red, green…). */
export type CodeTokenRole =
	| "plain"
	| "keyword"
	| "function"
	| "constant"
	| "string"
	| "comment"
	| "tag"
	| "parameter"
	| "red"
	| "green"
	| "yellow"
	| "blue"
	| "violet"
	| "teal"
	| "dim";

/** One piece of a coloured line. */
export interface CodeToken {
	readonly text: string;
	/** Default `plain`. */
	readonly role?: CodeTokenRole | undefined;
}

export type CodeLine = readonly CodeToken[];

/** What a highlight marks: a word to point at, or a search match. */
export type CodeHighlightKind = "word" | "match";

export interface CodeHighlight {
	readonly text: string;
	readonly kind?: CodeHighlightKind | undefined;
	/** Default `false`: matches ignore case. */
	readonly caseSensitive?: boolean | undefined;
}

/** A stretch of a line's text, from `start` up to (not including) `end`, and what marks it. */
export interface HighlightRange {
	readonly start: number;
	readonly end: number;
	readonly kind: CodeHighlightKind;
}

/** Every stretch of `text` the highlights mark, in order, overlaps dropped (the earlier one wins). */
export function highlightRanges(text: string, highlights: readonly CodeHighlight[]): readonly HighlightRange[] {
	const found: HighlightRange[] = [];
	for (const highlight of highlights) {
		if (highlight.text === "") {
			continue;
		}
		const haystack = highlight.caseSensitive === true ? text : text.toLowerCase();
		const needle = highlight.caseSensitive === true ? highlight.text : highlight.text.toLowerCase();
		let at = haystack.indexOf(needle);
		while (at >= 0) {
			found.push({ start: at, end: at + needle.length, kind: highlight.kind ?? "word" });
			at = haystack.indexOf(needle, at + needle.length);
		}
	}
	const sorted = [...found].sort((first, second): number => first.start - second.start);
	const kept: HighlightRange[] = [];
	for (const range of sorted) {
		const last = kept.at(-1);
		if (last === undefined || range.start >= last.end) {
			kept.push(range);
		}
	}
	return kept;
}

/** A token piece and the highlight on it, if any. */
export interface MarkedToken extends CodeToken {
	readonly highlight?: CodeHighlightKind | undefined;
}

/** A line's tokens cut where highlights start and end, each piece knowing its highlight. */
export function markTokens(line: CodeLine, ranges: readonly HighlightRange[]): readonly MarkedToken[] {
	if (ranges.length === 0) {
		return line;
	}
	const out: MarkedToken[] = [];
	let position = 0;
	for (const token of line) {
		const end = position + token.text.length;
		const cuts = new Set<number>([position, end]);
		for (const range of ranges) {
			if (range.start > position && range.start < end) {
				cuts.add(range.start);
			}
			if (range.end > position && range.end < end) {
				cuts.add(range.end);
			}
		}
		const points = [...cuts].sort((first, second): number => first - second);
		points.slice(0, -1).forEach((from: number, index: number): void => {
			const to = points.at(index + 1) ?? end;
			const range = ranges.find((candidate): boolean => candidate.start <= from && candidate.end >= to);
			out.push({ ...token, text: token.text.slice(from - position, to - position), highlight: range?.kind });
		});
		position = end;
	}
	return out;
}

/** A folded region: its first line (which stays) through its last, by number. */
export interface CodeFold {
	readonly start: number;
	readonly end: number;
}

/** A line about a line, drawn under it: a diagnostic, a suggestion. */
export interface CodeNote {
	readonly line: number;
	readonly text: string;
	readonly kind?: "error" | "warning" | "info" | undefined;
}

/** One row the block draws, one line tall. */
export type CodeRow =
	| { readonly kind: "line"; readonly number: number; readonly line: CodeLine }
	| { readonly kind: "note"; readonly number: number; readonly note: CodeNote }
	| { readonly kind: "fold"; readonly number: number; readonly hidden: number };

/**
 * The rows for `lines` numbered from `startLine`: each line, its notes under it, and for a folded region its first
 * line followed by a row saying how many lines are hidden (the rest left out).
 */
export function codeRows(
	lines: readonly CodeLine[],
	startLine: number,
	notes: readonly CodeNote[],
	folds: readonly CodeFold[],
	folded: ReadonlySet<number>,
): readonly CodeRow[] {
	const rows: CodeRow[] = [];
	let skipUntil = -1;
	lines.forEach((line: CodeLine, index: number): void => {
		const number = startLine + index;
		if (number <= skipUntil) {
			return;
		}
		rows.push({ kind: "line", number, line });
		for (const note of notes) {
			if (note.line === number) {
				rows.push({ kind: "note", number, note });
			}
		}
		const fold = folds.find((candidate): boolean => candidate.start === number);
		if (fold !== undefined && folded.has(fold.start) && fold.end > fold.start) {
			rows.push({ kind: "fold", number, hidden: fold.end - fold.start });
			skipUntil = fold.end;
		}
	});
	return rows;
}

// ── ANSI ───────────────────────────────────────────────────────────────────

const ESCAPE = "\u001b[";
/** SGR codes this reads: reset, dim, normal intensity, default colour, and the foregrounds. */
const SGR_RESET = 0;
const SGR_DIM = 2;
const SGR_NORMAL = 22;
const SGR_DEFAULT_FOREGROUND = 39;
const FOREGROUND_FIRST = 30;
const FOREGROUND_LAST = 37;
const BRIGHT_FIRST = 90;
const BRIGHT_LAST = 97;
/** The eight terminal colours, by their offset from 30 (and from 90): black and white read as plain. */
const ANSI_ROLES: readonly CodeTokenRole[] = ["plain", "red", "green", "yellow", "blue", "violet", "teal", "plain"];

/**
 * Terminal output with SGR colour codes (`ESC[31m`…) as coloured lines: the eight colours and their bright twins as
 * roles, and dim; bold, backgrounds and extended colours are read and dropped (the code face has no bold weight).
 * Styling restarts on every line.
 */
export function ansiToCodeLines(text: string): readonly CodeLine[] {
	return text.split("\n").map((raw: string): CodeLine => {
		const tokens: CodeToken[] = [];
		let role: CodeTokenRole = "plain";
		let dim = false;
		const flush = (content: string): void => {
			if (content !== "") {
				tokens.push({ text: content, role: dim ? "dim" : role });
			}
		};
		let index = 0;
		while (index < raw.length) {
			const at = raw.indexOf(ESCAPE, index);
			if (at < 0) {
				flush(raw.slice(index));
				break;
			}
			flush(raw.slice(index, at));
			const end = raw.indexOf("m", at);
			if (end < 0) {
				break;
			}
			const codes = (raw.slice(at + ESCAPE.length, end) || String(SGR_RESET)).split(";").map(Number);
			for (const code of codes) {
				if (code === SGR_RESET) {
					role = "plain";
					dim = false;
				} else if (code === SGR_DIM) {
					dim = true;
				} else if (code === SGR_NORMAL) {
					dim = false;
				} else if (code === SGR_DEFAULT_FOREGROUND) {
					role = "plain";
				} else if (code >= FOREGROUND_FIRST && code <= FOREGROUND_LAST) {
					role = ANSI_ROLES.at(code - FOREGROUND_FIRST) ?? "plain";
				} else if (code >= BRIGHT_FIRST && code <= BRIGHT_LAST) {
					role = ANSI_ROLES.at(code - BRIGHT_FIRST) ?? "plain";
				}
			}
			index = end + 1;
		}
		return tokens;
	});
}
