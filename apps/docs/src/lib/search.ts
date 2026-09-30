import { z } from "zod";

import { escapeHtml } from "./markdown/html";

/**
 * Client-side search over a small JSON index built at `astro build` time
 * (`/search-index.json`). The site has ~130 pages, so one lazily-fetched
 * index keeps search instant and dependency-free; revisit (e.g. Pagefind) if
 * the corpus grows past a few MB.
 *
 * Each guide contributes one `page` entry (title, section, plain text) and one
 * `heading` entry per h2/h3, so a query can land directly on a section.
 */
export const SearchEntryKindSchema = z.enum(["page", "heading"]);

export const SearchEntrySchema = z
	.object({
		kind: SearchEntryKindSchema,
		title: z.string(),
		href: z.string(),
		/** Sidebar section (pages) or parent page title (headings). */
		context: z.string(),
		text: z.string(),
	})
	.strict();

export type SearchEntry = z.output<typeof SearchEntrySchema>;

export const SearchIndexSchema = z.array(SearchEntrySchema);

export interface SearchHit {
	readonly entry: SearchEntry;
	readonly score: number;
	/** Short plain-text excerpt around the first body match ("" when the title matched). */
	readonly excerpt: string;
}

/** Characters of body text kept per page — enough for relevant matches without a huge index. */
export const MAX_INDEXED_CHARACTERS = 8000;
/** Characters shown on each side of a match in an excerpt. */
const EXCERPT_RADIUS = 60;

const SCORE = {
	titlePrefix: 60,
	titleTerm: 30,
	contextTerm: 8,
	textTerm: 4,
	pageBonus: 3,
} satisfies Readonly<Record<string, number>>;

/** Markdown → searchable plain text (code blocks, markup, links and HTML removed). */
export function toPlainText(markdown: string): string {
	return markdown
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/!\[([^\]]*)]\([^)]*\)/g, "$1")
		.replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
		.replace(/^\s{0,3}(?:#{1,6}|>+|[-*+]|\d+\.)\s+/gm, "")
		.replace(/^\s*\|?\s*:?-{3,}.*$/gm, " ")
		.replace(/[`*_~|]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, MAX_INDEXED_CHARACTERS);
}

/** Lower-cased, de-duplicated query terms. */
export function queryTerms(query: string): readonly string[] {
	return [
		...new Set(
			query
				.toLowerCase()
				.split(/\s+/)
				.filter((term) => term.length > 0),
		),
	];
}

function excerptAround(text: string, term: string): string {
	const index = text.toLowerCase().indexOf(term);
	if (index < 0) {
		return "";
	}
	const start = Math.max(0, index - EXCERPT_RADIUS);
	const end = Math.min(text.length, index + term.length + EXCERPT_RADIUS);
	return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

function scoreEntry(entry: SearchEntry, terms: readonly string[], phrase: string): SearchHit | null {
	const title = entry.title.toLowerCase();
	const context = entry.context.toLowerCase();
	const text = entry.text.toLowerCase();
	let score = entry.kind === "page" ? SCORE.pageBonus : 0;
	let firstTextOnlyTerm: string | null = null;

	for (const term of terms) {
		if (title.includes(term)) {
			score += SCORE.titleTerm;
		} else if (context.includes(term)) {
			score += SCORE.contextTerm;
		} else if (text.includes(term)) {
			score += SCORE.textTerm;
			firstTextOnlyTerm ??= term;
		} else {
			return null;
		}
	}
	if (title.startsWith(phrase)) {
		score += SCORE.titlePrefix;
	}
	return { entry, score, excerpt: firstTextOnlyTerm === null ? "" : excerptAround(entry.text, firstTextOnlyTerm) };
}

/** Entries matching every query term, best first. */
export function searchIndex(index: readonly SearchEntry[], query: string, limit: number): readonly SearchHit[] {
	const terms = queryTerms(query);
	if (terms.length === 0) {
		return [];
	}
	const phrase = terms.join(" ");
	return index
		.map((entry) => scoreEntry(entry, terms, phrase))
		.filter((hit): hit is SearchHit => hit !== null)
		.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
		.slice(0, limit);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** HTML-escapes `text` and wraps every query term in `<mark>`. */
export function highlightTerms(text: string, terms: readonly string[]): string {
	if (terms.length === 0) {
		return escapeHtml(text);
	}
	const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
	return text
		.split(pattern)
		.map((part, index) => (index % 2 === 1 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
		.join("");
}
