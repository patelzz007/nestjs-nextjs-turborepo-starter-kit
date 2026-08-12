import { z } from "zod";

/**
 * Pure markdown helpers shared between the server-side docs reader (which
 * builds the table of contents and metadata) and the client-side markdown
 * renderer (which renders the headings). Keeping the slugifier here guarantees
 * the ToC anchor ids always match the ids the renderer stamps on the headings.
 *
 * This module is intentionally free of `fs`/`server-only` — everything here is
 * pure string logic so it is unit-testable and safe for client bundles.
 */

// ─── Slugify + ToC ──────────────────────────────────────────────────────────

/** Slugifies heading text exactly like the renderer does: lowercase, runs of non-alphanumerics become `-`. */
export function slugifyHeadingText(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

/** A heading entry for the right-hand table of contents. */
export const TocHeadingSchema = z.object({
	id: z.string(),
	text: z.string(),
	/** Markdown heading level (2 or 3 — h1 is the page title, h4+ is skipped). */
	level: z.number(),
});

export type TocHeading = z.output<typeof TocHeadingSchema>;

const HEADING_RE = /^(#{2,3})\s+(.+)$/;

/** Strips inline markdown (links, code, emphasis) from a raw heading line to plain text. */
export function headingText(raw: string): string {
	return raw
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/`([^`]*)`/g, "$1")
		.replace(/[*_~]/g, "")
		.trim();
}

/**
 * Extracts h2/h3 headings from raw markdown for the table of contents.
 * Lines inside fenced code blocks (``` or ~~~) are skipped — react-markdown
 * renders them as code, so a ToC entry for them would have no matching DOM id
 * and could never be highlighted or navigated to.
 */
export function extractTocHeadings(markdown: string): readonly TocHeading[] {
	const headings: TocHeading[] = [];
	let inFence = false;
	for (const line of markdown.split("\n")) {
		// Track fenced code blocks (``` or ~~~). Only enter when outside a
		// block and only exit when inside one — a stray/unbalanced delimiter
		// can never suppress the headings below it.
		if (/^\s*(```|~~~)/.test(line)) {
			if (inFence) {
				inFence = false;
			} else {
				inFence = true;
			}
			continue;
		}
		if (inFence) {
			continue;
		}
		const match = HEADING_RE.exec(line);
		if (match === null) {
			continue;
		}
		const level = match[1]?.length ?? 0;
		const text = headingText(match[2] ?? "");
		if (text.length === 0) {
			continue;
		}
		headings.push({ id: slugifyHeadingText(text), text, level });
	}
	return headings;
}

/** Removes a leading `# Title` line (plus the blank line after it). */
export function stripFirstHeading(markdown: string): string {
	return markdown.replace(/^#\s+[^\n]*(?:\n|$)/, "").replace(/^\n+/, "");
}

// ─── Frontmatter ────────────────────────────────────────────────────────────

/**
 * The frontmatter fields a guide may declare at the top of its `.md` file:
 *
 * ```md
 * ---
 * title: "Getting Started"
 * description: "From an empty laptop to a running monorepo."
 * order: 1
 * author: "Acme Inc."
 * lastUpdated: "2026-08-02"
 * ---
 * ```
 *
 * All fields are optional — when missing, the docs reader falls back to
 * deriving the title/description from the markdown body and places the guide
 * after every guide that declares an explicit `order`.
 */
export const DocFrontmatterSchema = z
	.object({
		title: z.string().min(1),
		description: z.string().min(1),
		order: z.number().int().min(1),
		author: z.string().min(1),
		// ISO date string (e.g. `2026-08-02`) so a typo'd date fails loudly at
		// parse time instead of silently rendering garbage (rule 13).
		lastUpdated: z.iso.date(),
		// Absolute https image URL used as the banner cover art on `/docs/<slug>`.
		coverImage: z.url().refine((url) => url.startsWith("https://"), "coverImage must be an https URL"),
	})
	.partial();

export type DocFrontmatter = z.infer<typeof DocFrontmatterSchema>;

/** The result of splitting a raw `.md` file into its validated frontmatter and markdown body. */
export const ParsedMarkdownFileSchema = z.object({
	frontmatter: DocFrontmatterSchema,
	/** The markdown content with the frontmatter block removed. */
	body: z.string(),
});

export type ParsedMarkdownFile = z.output<typeof ParsedMarkdownFileSchema>;

/** Parses a YAML-ish scalar into a primitive: quoted string, number, boolean, or plain string. */
function parseScalarValue(raw: string): string | number | boolean {
	if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
		return raw.slice(1, -1).replace(/\\"/g, '"');
	}
	if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) {
		return raw.slice(1, -1);
	}
	if (/^-?\d+$/.test(raw)) {
		return Number(raw);
	}
	if (raw === "true") {
		return true;
	}
	if (raw === "false") {
		return false;
	}
	return raw;
}

/**
 * Splits a `.md` file into frontmatter + body. Only a block that opens with a
 * `---` line and closes with another `---` line is treated as frontmatter;
 * anything else (no block, unclosed block, invalid values) falls back to an
 * empty frontmatter object with the original content as the body, so a broken
 * guide can never take down the docs pages.
 */
export function parseMarkdownFile(content: string): ParsedMarkdownFile {
	const lines = content.split("\n");
	if ((lines[0]?.trim() ?? "") !== "---") {
		return { frontmatter: {}, body: content };
	}

	const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
	if (closingIndex === -1) {
		return { frontmatter: {}, body: content };
	}

	const rawFrontmatter: Record<string, string | number | boolean> = {};
	for (const line of lines.slice(1, closingIndex)) {
		const separatorIndex = line.indexOf(":");
		if (separatorIndex === -1) {
			continue;
		}
		const key = line.slice(0, separatorIndex).trim();
		const rawValue = line.slice(separatorIndex + 1).trim();
		if (key.length === 0) {
			continue;
		}
		rawFrontmatter[key] = parseScalarValue(rawValue);
	}

	const parsed = DocFrontmatterSchema.safeParse(rawFrontmatter);
	const body = lines
		.slice(closingIndex + 1)
		.join("\n")
		.replace(/^\n+/, "");

	return { frontmatter: parsed.success ? parsed.data : {}, body };
}

// ─── Search (client-side, over summaries) ───────────────────────────────────

/** Lowercases, trims, and collapses whitespace so search is forgiving. */
export function normalizeSearchQuery(query: string): string {
	return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Filters a list of doc summaries by query. Title matches rank above
 * description matches; an empty query returns every doc unchanged (in the
 * original order). Generic over anything with `title` + `description` so it
 * stays decoupled from the server-side `DocSummary` type (rules 5–6).
 */
export function filterDocSummaries<T extends { readonly title: string; readonly description: string }>(docs: readonly T[], query: string): readonly T[] {
	const normalized = normalizeSearchQuery(query);
	if (normalized.length === 0) {
		return [...docs];
	}
	return docs
		.map((doc) => ({ doc, rank: summaryMatchRank(doc.title, doc.description, normalized) }))
		.filter((entry) => entry.rank > 0)
		.sort((a, b) => b.rank - a.rank || a.doc.title.localeCompare(b.doc.title))
		.map((entry) => entry.doc);
}

/** 2 for a title hit, 1 for a description hit, 0 for no match. */
function summaryMatchRank(title: string, description: string, normalizedQuery: string): number {
	let rank = 0;
	if (title.toLowerCase().includes(normalizedQuery)) {
		rank += 2;
	}
	if (description.toLowerCase().includes(normalizedQuery)) {
		rank += 1;
	}
	return rank;
}

// ─── Reading time + dates ───────────────────────────────────────────────────

const WORDS_PER_MINUTE = 200;

/** Rough "x min read" estimate: word count / 200, minimum 1 minute. */
export function estimateReadingTime(markdown: string): number {
	const words = markdown
		.trim()
		.split(/\s+/)
		.filter((word) => word.length > 0).length;
	return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

const MONTH_NAMES: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

/** Formats an ISO date string (e.g. `2026-08-02`) as `Aug 2, 2026`. Falls back to the raw string when unparseable. */
export function formatIsoDate(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return iso;
	}
	return `${MONTH_NAMES[date.getUTCMonth()] ?? ""} ${String(date.getUTCDate())}, ${String(date.getUTCFullYear())}`;
}

/** Blockquote kinds for the docs renderer's color-coded callouts. Zod enum (rule 13) so the renderer can `safeParse` runtime values instead of sniffing strings. */
export const QuoteKindSchema = z.enum(["info", "tip", "warning", "error", "success"]);

export type QuoteKind = z.infer<typeof QuoteKindSchema>;

/** Maps GitHub-style `[!KIND]` markers to the app's quote kinds. */
export const QUOTE_MARKER_KINDS: Readonly<Record<string, QuoteKind>> = {
	note: "info",
	info: "info",
	tip: "tip",
	success: "success",
	warning: "warning",
	caution: "warning",
	important: "warning",
	error: "error",
	danger: "error",
};

/**
 * Detects a quote kind from the quote's plain text (used when no marker
 * exists). Word-boundary anchored so neutral prose ("don'ts", "antipattern")
 * can't accidentally tint a callout — only whole keywords count.
 */
export function detectQuoteKind(text: string): QuoteKind {
	const lower = text.toLowerCase();
	if (/(?:\b(?:errors?|failed?|failure|broken|danger)\b|❌)/.test(lower)) {
		return "error";
	}
	if (/(?:\b(?:warnings?|caution|careful|important|gotcha|never|don'?t|wipes|pending)\b|⚠)/.test(lower)) {
		return "warning";
	}
	if (/(?:\b(?:success|succeeded)\b|✅)/.test(lower)) {
		return "success";
	}
	// Tips get their own kind (violet) — distinct from success, so a bare
	// "Tip: …" quote reads as a tip rather than a success.
	if (/(?:\b(?:tip|tips)\b|💡)/.test(lower)) {
		return "tip";
	}
	return "info";
}

// ─── Glossary (hover tooltips in prose) ─────────────────────────────────────

/**
 * Terms the docs renderer wraps in `<abbr title>` tooltips. Longest-first
 * matching in the remark plugin, so a multi-word term wins over its prefix.
 * Add any jargon the guides use that a junior might not know — keep
 * definitions to one short sentence.
 *
 * Note: the plugin only matches DIRECT `text` children of paragraphs, so a
 * term inside `**bold**`, `*em*`, or an inline link does NOT get a tooltip.
 * That's a deliberate limitation (keeps the AST surgery trivial) — don't
 * "fix" it by recursing, or tooltips will start appearing inside code spans.
 */
export const GLOSSARY_TERMS: readonly { readonly term: string; readonly definition: string }[] = [
	{ term: "RBAC", definition: "Role-based access control — permissions granted via roles" },
	{ term: "JWT", definition: "JSON Web Token — a signed, self-contained auth token" },
	{ term: "jti", definition: "JWT ID — a unique per-token identifier used to revoke sessions" },
	{ term: "HS256", definition: "HMAC-SHA256 — the symmetric signing algorithm for these JWTs" },
	{ term: "CORS", definition: "Cross-Origin Resource Sharing — which origins may call the API" },
	{ term: "CSRF", definition: "Cross-Site Request Forgery — an attack mitigated by SameSite cookies" },
	{ term: "SSR", definition: "Server-side rendering — HTML produced on the server per request" },
	{ term: "SPA", definition: "Single-page application — client-side navigation without full reloads" },
	{ term: "DTO", definition: "Data Transfer Object — the typed shape of a request/response body" },
	{ term: "ORM", definition: "Object-relational mapper — Prisma maps tables to TypeScript objects" },
	{ term: "idempotent", definition: "Safe to run repeatedly — the second run leaves the same state" },
	{ term: "granular", definition: "Fine-grained — broken into small, specific pieces" },
];
