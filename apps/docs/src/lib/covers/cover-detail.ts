/**
 * What the foreground card of a guide's cover shows, read from the guide itself, so every cover says what
 * its guide is about and no two guides share one:
 *
 * | Guide | Card |
 * |---|---|
 * | An ADR (`adr/NNN-*.md`) | The decision: its number, status, title, summary and tags |
 * | It has code that fills a card | Its fullest code card (below) |
 * | It has at least three sections | "On this page": its section headings |
 * | It has shorter code | That code card |
 * | Anything else | Its title, description and tags |
 *
 * The code cards: a Mermaid diagram (drawn by Pele), a terminal with every shell command the guide gives, an
 * HTTP request (coloured like the docs' code), or code highlighted like the docs' code blocks. The first that
 * fills {@link FULL_CARD_LINES} lines wins; failing that, the one with the most lines.
 *
 * Pure: `scripts/covers.ts` reads the files and renders the card (`cover-html.ts`).
 */
import { markdownFences, resolveCodeBlockLanguage } from "@workspace/ui/components/code-block-highlight";
import { render as renderDiagram } from "pele";

/** The most lines a code, HTTP or terminal card shows; a longer fence is cut, with "…" as its last line. */
export const CARD_MAX_LINES = 8;
/** The most characters a card's code line shows (the card is about 56 monospace columns wide). */
export const CARD_MAX_COLUMNS = 54;
/** A code card with this many lines fills the card; a shorter one is used only when nothing fuller exists. */
export const FULL_CARD_LINES = 4;
/** The most section headings an outline card lists. */
export const OUTLINE_MAX_HEADINGS = 6;
/** Fewer sections than this make a thin outline: the guide gets its summary card instead. */
export const OUTLINE_MIN_HEADINGS = 3;
/** The most tags a decision card shows. */
export const DECISION_MAX_TAGS = 3;
/**
 * The room a diagram has on its card (px): the card's 520 × 252 diagram area less the 24px padding
 * `renderStaticDiagram` puts around it on each side.
 */
export const DIAGRAM_BOX_WIDTH = 444;
export const DIAGRAM_BOX_HEIGHT = 204;
/** Below this scale a diagram's labels are too small to read on the cover (judged on the drawn covers, 2026-11-14). */
export const MIN_DIAGRAM_SCALE = 0.42;
/** A fence shorter than this says too little to stand for the guide. */
const MIN_FENCE_LINES = 2;
const ELLIPSIS = "…";

/** A line of a terminal card: a command (drawn after a `$` prompt) or a comment. */
export interface TerminalLine {
	readonly text: string;
	readonly tone: "command" | "comment";
}

export type CoverDetail =
	| { readonly kind: "code"; readonly language: string; readonly code: string }
	| { readonly kind: "http"; readonly code: string }
	| { readonly kind: "terminal"; readonly lines: readonly TerminalLine[] }
	| { readonly kind: "diagram"; readonly source: string }
	| {
			readonly kind: "decision";
			readonly number: string;
			readonly title: string;
			readonly status: string | null;
			readonly summary: string;
			readonly tags: readonly string[];
	  }
	| { readonly kind: "outline"; readonly headings: readonly string[] }
	| { readonly kind: "summary"; readonly title: string; readonly summary: string; readonly tags: readonly string[] };

/** The facts about a guide its cover is built from. */
export interface CoverSource {
	/** The guide's path under `docs/` without `.md`, e.g. `adr/085-customer-tiers`. */
	readonly slug: string;
	readonly title: string;
	readonly description: string | undefined;
	readonly tags: readonly string[];
	/** The Markdown after the front matter. */
	readonly body: string;
}

const SHELL_LANGUAGES: ReadonlySet<string> = new Set(["bash", "sh", "shell", "shellscript", "zsh", "console"]);
const DIAGRAM_LANGUAGE = "mermaid";
const HTTP_LANGUAGE = "http";
const ADR_SLUG_PATTERN = /^adr\/(?<number>\d{3})-/u;
const ADR_TITLE_PREFIX_PATTERN = /^ADR\s+\d+:\s*/u;
const STATUS_WORD_PATTERN = /\b(?<word>Accepted|Proposed|Superseded|Deprecated|Rejected)\b/u;
const STATUS_LINE_PATTERN = /^\*\*Status:?\*\*:?\s*(?<text>.+)$/mu;
const STATUS_SECTION_PATTERN = /^## Status\s*\n+(?<text>[^\n]+)/mu;
const SECTION_HEADING_PATTERN = /^## (?<heading>.+?)\s*#*\s*$/gmu;
const SUBSECTION_HEADING_PATTERN = /^#{2,3} (?<heading>.+?)\s*#*\s*$/gmu;
const DECISION_TAG = "adr";

/** Inline Markdown reduced to its text: emphasis, code spans and links lose their marks. */
export function plainText(markdown: string): string {
	return markdown
		.replace(/!?\[(?<label>[^\]]*)\]\([^)]*\)/gu, "$<label>")
		.replace(/(?<mark>\*\*|__|\*|_|`)(?<inner>.+?)\k<mark>/gu, "$<inner>")
		.replace(/\s+/gu, " ")
		.trim();
}

/** `text` cut to `columns`, ending in "…" when it was longer. */
export function clip(text: string, columns: number): string {
	return text.length <= columns ? text : `${text.slice(0, columns - ELLIPSIS.length).trimEnd()}${ELLIPSIS}`;
}

/** A fence's lines, without the blank lines around them, cut to the card's lines and columns (the card's edge ends a longer fence). */
export function cardLines(code: string): readonly string[] {
	return code
		.replace(/\t/gu, "  ")
		.trim()
		.split("\n")
		.slice(0, CARD_MAX_LINES)
		.map((line) => clip(line.trimEnd(), CARD_MAX_COLUMNS));
}

/** A shell fence as terminal lines: `# notes` stay comments; a command's trailing `# note` is dropped. */
export function terminalLines(code: string): readonly TerminalLine[] {
	return cardLines(code)
		.filter((line) => line.trim().length > 0)
		.map((line) => {
			const text = line.trim();
			if (text.startsWith("#")) {
				return { text, tone: "comment" };
			}
			return { text: clip(text.replace(/\s+#\s.*$/u, ""), CARD_MAX_COLUMNS), tone: "command" };
		});
}

/**
 * Whether `source` makes a readable card: Pele draws it, and it fits {@link DIAGRAM_BOX_WIDTH} ×
 * {@link DIAGRAM_BOX_HEIGHT} at {@link MIN_DIAGRAM_SCALE} or more. A diagram Pele cannot parse, or one so big
 * its labels would shrink past reading, is passed over.
 */
export function isReadableDiagram(source: string): boolean {
	try {
		const { width, height } = renderDiagram(source, { responsive: false });
		return Math.min(DIAGRAM_BOX_WIDTH / width, DIAGRAM_BOX_HEIGHT / height) >= MIN_DIAGRAM_SCALE;
	} catch {
		return false;
	}
}

/** A card candidate and how many lines it fills. */
interface Candidate {
	readonly detail: CoverDetail;
	readonly lines: number;
}

function lineCount(content: string): number {
	return content.trim().split("\n").length;
}

/** The card for one fence (shell fences are gathered apart), or `null` when it cannot stand for the guide. */
function fenceCandidate(language: string | undefined, content: string): Candidate | null {
	if (language === undefined || lineCount(content) < MIN_FENCE_LINES) {
		return null;
	}
	if (language === DIAGRAM_LANGUAGE) {
		// A diagram fills the card whatever its length.
		return isReadableDiagram(content) ? { detail: { kind: "diagram", source: content }, lines: CARD_MAX_LINES } : null;
	}
	const code = cardLines(content).join("\n");
	if (language === HTTP_LANGUAGE) {
		return { detail: { kind: "http", code }, lines: lineCount(code) };
	}
	const resolved = resolveCodeBlockLanguage(language);
	return resolved === undefined ? null : { detail: { kind: "code", language: resolved, code }, lines: lineCount(code) };
}

/** Every shell command the guide gives, in order, as one terminal (a single command says too little alone). */
function terminalCandidate(fences: readonly string[]): Candidate | null {
	if (fences.length === 0) {
		return null;
	}
	const lines = terminalLines(fences.join("\n"));
	return { detail: { kind: "terminal", lines }, lines: lines.length };
}

/**
 * The fullest card the guide's code can make: the first candidate that fills {@link FULL_CARD_LINES}, else
 * the one with the most lines (the first of equals), else `null` when none reaches {@link MIN_FENCE_LINES}.
 */
function bestCodeCandidate(body: string): Candidate | null {
	const parts = markdownFences(body).filter((part) => part.type === "code");
	const fenced = parts.map((part) => (part.language !== undefined && SHELL_LANGUAGES.has(part.language) ? null : fenceCandidate(part.language, part.content)));
	const shell = terminalCandidate(parts.filter((part) => part.language !== undefined && SHELL_LANGUAGES.has(part.language)).map((part) => part.content));
	const candidates = [...fenced, shell].filter((candidate) => candidate !== null && candidate.lines >= MIN_FENCE_LINES);
	return (
		candidates.find((candidate) => candidate !== null && candidate.lines >= FULL_CARD_LINES) ??
		candidates.reduce<Candidate | null>((best, candidate) => (candidate !== null && (best === null || candidate.lines > best.lines) ? candidate : best), null)
	);
}

function headingsAt(body: string, pattern: RegExp): readonly string[] {
	return markdownFences(body)
		.filter((part) => part.type === "text")
		.flatMap((part) => [...part.content.matchAll(pattern)].map((match) => plainText(match.groups?.heading ?? "")))
		.filter((heading) => heading.length > 0);
}

/** The guide's section headings outside its code: its `##` ones, or with its `###` ones when it has under three. */
export function sectionHeadings(body: string): readonly string[] {
	const sections = headingsAt(body, SECTION_HEADING_PATTERN);
	return sections.length >= OUTLINE_MIN_HEADINGS ? sections : headingsAt(body, SUBSECTION_HEADING_PATTERN);
}

/** An ADR's status word, from its `## Status` section or its `**Status:**` line; `null` when it names none. */
export function decisionStatus(body: string): string | null {
	const text = STATUS_SECTION_PATTERN.exec(body)?.groups?.text ?? STATUS_LINE_PATTERN.exec(body)?.groups?.text ?? "";
	return STATUS_WORD_PATTERN.exec(text)?.groups?.word ?? null;
}

function decisionDetail(source: CoverSource, number: string): CoverDetail {
	return {
		kind: "decision",
		number,
		title: source.title.replace(ADR_TITLE_PREFIX_PATTERN, ""),
		status: decisionStatus(source.body),
		summary: plainText(source.description ?? ""),
		tags: source.tags.filter((tag) => tag !== DECISION_TAG).slice(0, DECISION_MAX_TAGS),
	};
}

/** The card a guide's cover shows (see the table above). */
export function coverDetail(source: CoverSource): CoverDetail {
	const number = ADR_SLUG_PATTERN.exec(source.slug)?.groups?.number;
	if (number !== undefined) {
		return decisionDetail(source, number);
	}
	const code = bestCodeCandidate(source.body);
	if (code !== null && code.lines >= FULL_CARD_LINES) {
		return code.detail;
	}
	const headings = sectionHeadings(source.body);
	if (headings.length >= OUTLINE_MIN_HEADINGS) {
		return { kind: "outline", headings: headings.slice(0, OUTLINE_MAX_HEADINGS) };
	}
	if (code !== null) {
		return code.detail;
	}
	return { kind: "summary", title: source.title, summary: plainText(source.description ?? ""), tags: source.tags.slice(0, DECISION_MAX_TAGS) };
}
