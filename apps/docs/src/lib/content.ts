import { getCollection, render, type CollectionEntry } from "astro:content";

import rawBlogMeta from "../../../../blog/meta.json";
import rawDocsMeta from "../../../../docs/meta.json";
import { BlogMetaSchema, orderPosts } from "./blog";
import { buildNavSections, DocsMetaSchema, flattenNav, type NavSection } from "./navigation";
import { topSections, type TocItem } from "./toc";

/**
 * Build-time access to the `docs` and `blog` collections (see
 * `content.config.ts`). The repo-root `meta.json` files are validated with the
 * same schemas the unit tests cover, so a typo there fails the build.
 */
export type GuideEntry = CollectionEntry<"docs">;
export type PostEntry = CollectionEntry<"blog">;

const DOCS_META = DocsMetaSchema.parse(rawDocsMeta);
const BLOG_META = BlogMetaSchema.parse(rawBlogMeta);

export function getGuides(): Promise<readonly GuideEntry[]> {
	return getCollection("docs");
}

/** Sidebar sections in `docs/meta.json` order. */
export function navSectionsFor(guides: readonly GuideEntry[]): readonly NavSection[] {
	return buildNavSections(
		DOCS_META,
		guides.map((guide) => ({ id: guide.id, title: guide.data.title, description: guide.data.description ?? "", tags: guide.data.tags })),
	);
}

/** Posts in `blog/meta.json` order, unlisted posts newest first. */
export async function getPosts(): Promise<readonly PostEntry[]> {
	const posts = await getCollection("blog");
	const ordered = orderPosts(
		BLOG_META,
		posts.map((post) => ({ id: post.id, date: post.data.date, post })),
	);
	return ordered.map((item) => item.post);
}

/** Section quick links shown on each learning-center card. */
const QUICK_LINKS_PER_CARD = 3;

export interface LearningCenter {
	readonly sections: readonly NavSection[];
	/** Up to three h2 links per guide id. */
	readonly quickLinks: ReadonlyMap<string, readonly TocItem[]>;
}

/** Everything the learning-center card grid needs (sections + each guide's first h2s). */
export async function getLearningCenter(): Promise<LearningCenter> {
	const guides = await getGuides();
	const sections = navSectionsFor(guides);
	const byId = new Map(guides.map((guide) => [guide.id, guide]));
	const entries = await Promise.all(
		flattenNav(sections).map(async (item): Promise<readonly [string, readonly TocItem[]]> => {
			const guide = byId.get(item.id);
			if (guide === undefined) {
				return [item.id, []];
			}
			const { headings } = await render(guide);
			return [item.id, topSections(headings, QUICK_LINKS_PER_CARD)];
		}),
	);
	return { sections, quickLinks: new Map(entries) };
}
