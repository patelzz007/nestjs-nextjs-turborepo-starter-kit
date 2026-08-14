import "server-only";

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { EpochMsSchema } from "@workspace/shared";
import { z } from "zod";

import { TocHeadingSchema, estimateReadingTime, extractTocHeadings, parseMarkdownFile, stripFirstHeading } from "@/lib/docs/markdown";

/**
 * Server-only module that reads the repo's `docs/*.md` files straight off the
 * filesystem. It is imported only by the `/docs` pages (server components) —
 * the `server-only` guard makes the build fail loudly if a client bundle ever
 * tries to import it.
 */

export const DocSummarySchema = z.object({
	slug: z.string(),
	title: z.string(),
	description: z.string(),
	/** Optional `author` from the guide's frontmatter. */
	author: z.string().optional(),
	/** Optional epoch-ms `lastUpdated` from the guide's frontmatter. */
	lastUpdated: EpochMsSchema.optional(),
	/** Optional absolute https cover-image URL for the banner (`coverImage` frontmatter). */
	coverImage: z.string().optional(),
});

export type DocSummary = z.output<typeof DocSummarySchema>;

export const DocContentSchema = DocSummarySchema.extend({
	/** The markdown body with frontmatter **and the leading H1** removed (the banner shows the title). */
	content: z.string(),
	headings: z.array(TocHeadingSchema).readonly(),
	readingTimeMinutes: z.number(),
});

export type DocContent = z.output<typeof DocContentSchema>;

/** Absolute path to the repo-root `docs/` folder (apps/admin is one level down). */
const DOCS_DIR = path.resolve(process.cwd(), "../../docs");

/** Guides without an explicit `order` frontmatter field sort after every guide that has one. */
const DEFAULT_ORDER = Number.MAX_SAFE_INTEGER;

/** A fully-read guide with everything the index and detail page need. */
const RawDocSchema = DocSummarySchema.extend({
	order: z.number(),
	body: z.string(),
});

type RawDoc = z.output<typeof RawDocSchema>;

/** `getting-started.md` → `getting-started`; `README.md` → `readme` (slugs are lowercase). */
function slugFromFileName(fileName: string): string {
	return fileName.replace(/\.md$/, "").toLowerCase();
}

/** Returns the first `# ` heading, used as a title fallback when frontmatter omits `title`. */
function extractTitle(content: string): string {
	for (const line of content.split("\n")) {
		if (line.startsWith("# ")) {
			return line.slice(2).trim();
		}
	}
	return "";
}

/** Returns the first non-empty paragraph after the H1, truncated to ~200 chars. */
function extractDescription(content: string): string {
	const lines = content.split("\n");
	let afterTitle = false;
	for (const line of lines) {
		if (line.startsWith("# ")) {
			afterTitle = true;
			continue;
		}
		if (!afterTitle) {
			continue;
		}
		if (line.startsWith("#")) {
			break;
		}
		const clean = line.replace(/[*_`#>]/g, "").trim();
		if (clean.length > 0) {
			return clean.length > 200 ? `${clean.slice(0, 200).trimEnd()}…` : clean;
		}
	}
	return "";
}

/**
 * Reads one `.md` file, validates its frontmatter, and fills any missing
 * metadata from the markdown body. Returns `null` when the file cannot be read.
 */
async function readRawDoc(fileName: string): Promise<RawDoc | null> {
	const slug = slugFromFileName(fileName);
	let content: string;
	try {
		content = await readFile(path.join(DOCS_DIR, fileName), "utf8");
	} catch {
		return null;
	}

	const parsed = parseMarkdownFile(content);
	const title = parsed.frontmatter.title ?? extractTitle(parsed.body);
	const description = parsed.frontmatter.description ?? extractDescription(parsed.body);

	// Validate the assembled metadata through the schema (rule 13) — a malformed
	// frontmatter fallback would otherwise silently corrupt the docs index.
	return RawDocSchema.parse({
		slug,
		title: title.length > 0 ? title : slug,
		description,
		author: parsed.frontmatter.author,
		lastUpdated: parsed.frontmatter.lastUpdated,
		coverImage: parsed.frontmatter.coverImage,
		order: parsed.frontmatter.order ?? DEFAULT_ORDER,
		body: parsed.body,
	});
}

/** Reads every `docs/*.md` file (skipping any that fail to read). */
async function readAllDocs(): Promise<readonly RawDoc[]> {
	const files = (await readdir(DOCS_DIR)).filter((file) => file.endsWith(".md"));
	const docs = await Promise.all(files.map((file) => readRawDoc(file)));
	return docs.filter((doc): doc is RawDoc => doc !== null);
}

/** Sorts guides by frontmatter `order`, then alphabetically by title. */
function compareByOrder(a: RawDoc, b: RawDoc): number {
	if (a.order !== b.order) {
		return a.order - b.order;
	}
	return a.title.localeCompare(b.title);
}

function toSummary(doc: RawDoc): DocSummary {
	return {
		slug: doc.slug,
		title: doc.title,
		description: doc.description,
		author: doc.author,
		lastUpdated: doc.lastUpdated,
		coverImage: doc.coverImage,
	};
}

/** Lists every guide in `docs/`, in frontmatter `order` (then alphabetical). */
export async function getAllDocs(): Promise<readonly DocSummary[]> {
	const docs = await readAllDocs();
	return [...docs].sort(compareByOrder).map(toSummary);
}

/** Reads a single guide by slug (filename without `.md`), or `null` when missing. */
export async function getDoc(slug: string): Promise<DocContent | null> {
	// Guard against path traversal — slugs must be plain kebab-case names.
	if (!/^[a-z0-9-]+$/.test(slug)) {
		return null;
	}
	// Resolve case-insensitively so `readme` finds `README.md` on any filesystem.
	const files = await readdir(DOCS_DIR);
	const fileName = files.find((file) => file.toLowerCase() === `${slug}.md`);
	if (fileName === undefined) {
		return null;
	}

	let content: string;
	try {
		content = await readFile(path.join(DOCS_DIR, fileName), "utf8");
	} catch {
		return null;
	}

	const parsed = parseMarkdownFile(content);
	const title = parsed.frontmatter.title ?? extractTitle(parsed.body);
	const description = parsed.frontmatter.description ?? extractDescription(parsed.body);
	const body = stripFirstHeading(parsed.body);

	return {
		slug,
		title: title.length > 0 ? title : slug,
		description,
		author: parsed.frontmatter.author,
		lastUpdated: parsed.frontmatter.lastUpdated,
		coverImage: parsed.frontmatter.coverImage,
		content: body,
		headings: extractTocHeadings(body),
		readingTimeMinutes: estimateReadingTime(body),
	};
}
