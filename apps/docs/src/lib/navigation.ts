import { z } from "zod";

import { docIcon, sectionIcon, type IconName } from "./icons";

/**
 * Sidebar / landing navigation, built from the repo-root `docs/meta.json`:
 *
 * ```json
 * { "pages": ["--- Getting Started ---", "getting-started", "README", "--- Tooling ---", "prisma"] }
 * ```
 *
 * A `--- Label ---` entry starts a section; every other entry is a guide id
 * (the file path under `docs/` without `.md`). Guides not listed in
 * `meta.json` still get a page and appear under "More Guides", except pages
 * tagged `superseded` (kept only for history).
 */

export const DocsMetaSchema = z
	.object({
		title: z.string().optional(),
		pages: z.array(z.string().min(1)),
	})
	.strict();

export type DocsMeta = z.output<typeof DocsMetaSchema>;

/** The fields navigation needs from a guide's frontmatter. */
export interface GuideSummary {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly tags: readonly string[];
}

export interface NavItem {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly href: string;
	readonly icon: IconName;
}

export interface NavSection {
	readonly title: string;
	readonly icon: IconName;
	readonly items: readonly NavItem[];
}

export const MORE_GUIDES_SECTION = "More Guides";
const HIDDEN_TAG = "superseded";
const SEPARATOR_PATTERN = /^---\s*(.+?)\s*---$/;

/** Public URL of a guide. Ids keep their case (`README`, `ADDING-A-FEATURE`). */
export function docHref(id: string): string {
	return `/docs/${id}`;
}

function toNavItem(guide: GuideSummary): NavItem {
	return { id: guide.id, title: guide.title, description: guide.description, href: docHref(guide.id), icon: docIcon(guide.id) };
}

/** Builds the ordered sidebar sections from `meta.json` + every guide. */
export function buildNavSections(meta: DocsMeta, guides: readonly GuideSummary[]): readonly NavSection[] {
	const byId = new Map(guides.map((guide) => [guide.id, guide]));
	const sections: { title: string; items: NavItem[] }[] = [];
	const listed = new Set<string>();
	let current: { title: string; items: NavItem[] } | undefined;

	for (const entry of meta.pages) {
		const separator = SEPARATOR_PATTERN.exec(entry);
		if (separator !== null) {
			current = { title: separator[1] ?? "", items: [] };
			sections.push(current);
			continue;
		}
		const guide = byId.get(entry);
		if (guide === undefined || listed.has(entry)) {
			continue;
		}
		if (current === undefined) {
			current = { title: "Guides", items: [] };
			sections.push(current);
		}
		listed.add(entry);
		current.items.push(toNavItem(guide));
	}

	const unlisted = guides
		.filter((guide) => !listed.has(guide.id) && !guide.tags.includes(HIDDEN_TAG))
		.sort((a, b) => a.title.localeCompare(b.title))
		.map(toNavItem);
	if (unlisted.length > 0) {
		sections.push({ title: MORE_GUIDES_SECTION, items: unlisted });
	}

	return sections.filter((section) => section.items.length > 0).map((section) => ({ ...section, icon: sectionIcon(section.title) }));
}

/** Sidebar order as one list (drives previous / next links). */
export function flattenNav(sections: readonly NavSection[]): readonly NavItem[] {
	return sections.flatMap((section) => section.items);
}

export interface Neighbours {
	readonly previous: NavItem | null;
	readonly next: NavItem | null;
}

/** Previous / next guide in sidebar order (`null` at either end or when not in the sidebar). */
export function findNeighbours(sections: readonly NavSection[], id: string): Neighbours {
	const flat = flattenNav(sections);
	const index = flat.findIndex((item) => item.id === id);
	if (index < 0) {
		return { previous: null, next: null };
	}
	return { previous: flat[index - 1] ?? null, next: flat[index + 1] ?? null };
}

/** The section a guide sits in (for breadcrumbs), if any. */
export function findSection(sections: readonly NavSection[], id: string): NavSection | null {
	return sections.find((section) => section.items.some((item) => item.id === id)) ?? null;
}

/** Stable id for a content file path: `technical/authorization/overview.md` → `technical/authorization/overview`. */
export function contentId(entryPath: string): string {
	return entryPath.replace(/\\/g, "/").replace(/\.mdx?$/, "");
}

/** Anchor id for a section heading on the learning-center page: `Architecture & Auth` → `architecture-auth`. */
export function sectionSlug(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** Number of colour tones the learning-center icon tiles cycle through (`--tile-1` … `--tile-6`). */
export const TILE_TONES = 6;

/** 1-based tile tone for the card at `index` within its section. */
export function tileTone(index: number): number {
	return (index % TILE_TONES) + 1;
}
