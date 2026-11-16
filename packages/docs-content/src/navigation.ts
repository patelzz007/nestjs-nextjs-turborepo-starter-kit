import { z } from "zod";

import { parseJson } from "./json.ts";
import type { ManifestEntry } from "./manifest.ts";

/**
 * Places synced pages into the sidebars. `docs/meta.json` lists `--- Section ---` markers and page ids. Pages
 * no source owns stay exactly where they are, so a pilot of a few pages leaves the rest of the sidebar alone
 * and a complete import ends with every entry generated (plan §15, phases 2 and 5).
 */

export const DOCS_META_PATH = "docs/meta.json";
export const BLOG_META_PATH = "docs/blog/meta.json";

export const NavigationMetaSchema = z.object({ title: z.string().optional(), pages: z.array(z.string().min(1)) }).strict();
export type NavigationMeta = z.output<typeof NavigationMetaSchema>;

export const EMPTY_NAVIGATION: NavigationMeta = { pages: [] };

export function parseNavigation(text: string): NavigationMeta {
	return NavigationMetaSchema.parse(parseJson(text));
}

const JSON_INDENT = "\t";
const SECTION_PATTERN = /^--- (?<label>.+) ---$/u;

function sectionMarker(label: string): string {
	return `--- ${label} ---`;
}

function sectionLabel(page: string): string | null {
	return SECTION_PATTERN.exec(page)?.groups?.label ?? null;
}

function byOrderThenSlug(left: ManifestEntry, right: ManifestEntry): number {
	const difference = (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER);
	if (difference !== 0) {
		return difference;
	}
	return left.slug < right.slug ? -1 : Number(left.slug > right.slug);
}

interface Section {
	readonly label: string | null;
	readonly pages: readonly string[];
}

/** The list as sections; pages before the first marker form a section with no label. */
function sectionsOf(pages: readonly string[]): readonly Section[] {
	const sections: { label: string | null; pages: string[] }[] = [{ label: null, pages: [] }];
	for (const page of pages) {
		const label = sectionLabel(page);
		if (label === null) {
			sections.at(-1)?.pages.push(page);
		} else {
			sections.push({ label, pages: [] });
		}
	}
	return sections;
}

/**
 * The docs sidebar with `entries` in their sections, each section's synced pages in `order` and after any page
 * no source owns. `previousIds` are ids to drop first: pages that moved or left. A section no page uses any
 * more disappears; a new one is added at the end.
 */
export function mergeDocsNavigation(meta: NavigationMeta, entries: readonly ManifestEntry[], previousIds: readonly string[]): NavigationMeta {
	const managed = new Set([...previousIds, ...entries.map((entry) => entry.slug)]);
	const kept = sectionsOf(meta.pages).map((section): Section => ({ label: section.label, pages: section.pages.filter((page) => !managed.has(page)) }));
	const incoming = new Map<string | null, ManifestEntry[]>();
	for (const entry of [...entries].sort(byOrderThenSlug)) {
		incoming.set(entry.section, [...(incoming.get(entry.section) ?? []), entry]);
	}
	const known = new Set(kept.map((section) => section.label));
	const added = [...incoming.keys()].filter((label) => !known.has(label)).map((label): Section => ({ label, pages: [] }));
	const pages = [...kept, ...added].flatMap((section): string[] => {
		const sectionPages = [...section.pages, ...(incoming.get(section.label) ?? []).map((entry) => entry.slug)];
		if (section.label === null) {
			return sectionPages;
		}
		return sectionPages.length === 0 ? [] : [sectionMarker(section.label), ...sectionPages];
	});
	return { ...meta, pages };
}

/** The blog list: posts no source owns keep their place; synced posts follow, in `order`. */
export function mergeBlogNavigation(meta: NavigationMeta, entries: readonly ManifestEntry[], previousIds: readonly string[]): NavigationMeta {
	const managed = new Set([...previousIds, ...entries.map((entry) => entry.slug)]);
	return { ...meta, pages: [...meta.pages.filter((page) => !managed.has(page)), ...[...entries].sort(byOrderThenSlug).map((entry) => entry.slug)] };
}

export function serialiseNavigation(meta: NavigationMeta): string {
	return `${JSON.stringify(meta, null, JSON_INDENT)}\n`;
}
