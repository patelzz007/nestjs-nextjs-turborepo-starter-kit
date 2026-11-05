import type { MarkdownRenderer, RenderedHeading } from "@workspace/docs-renderer/pipeline";

import { orderPosts, postHref, type BlogMeta } from "./blog";
import { countWords, readingMinutes } from "./dates";
import { GuideFrontmatterSchema, parseMarkdownFile, PostFrontmatterSchema, type GuideFrontmatter, type PostFrontmatter } from "./frontmatter";
import { docIcon, type IconName } from "./icons";
import { buildNavSections, contentId, docHref, findNeighbours, findSection, flattenNav, type DocsMeta, type NavItem, type NavSection } from "./navigation";
import { toPlainText, type SearchEntry } from "./search";
import { githubEditUrl } from "./site";
import { buildToc, topSections, type TocItem } from "./toc";

/**
 * The docs' content model: every guide under the repo-root `docs/` and every post under `blog/`, parsed,
 * validated, rendered and arranged for the site. It takes the raw files and the Markdown renderer as
 * inputs (the server module wires Vite's file glob and `@workspace/docs-renderer`), so it is tested
 * without either. Every result is plain data, so it crosses the server-function boundary as is.
 */

/** Raw Markdown keyed by its path below its content folder (`technical/database.md`). */
export type ContentFiles = Readonly<Record<string, string>>;

export interface ContentSources {
	readonly docs: ContentFiles;
	readonly blog: ContentFiles;
	readonly docsMeta: DocsMeta;
	readonly blogMeta: BlogMeta;
	/** Renders one body; `filePath` is what relative links resolve against. */
	readonly render: MarkdownRenderer;
	/** The virtual repository root `filePath`s are built under (link resolution is path arithmetic only). */
	readonly repoRoot: string;
}

interface Entry<TData> {
	readonly id: string;
	readonly path: string;
	readonly data: TData;
	readonly body: string;
}

/** A neighbouring page in reading order. */
export interface PageLink {
	readonly title: string;
	readonly href: string;
}

/** One "On this page" entry with the words in its section (up to the next h2 / h3), for reading progress. */
export interface TimelineItem extends TocItem {
	readonly words: number;
}

/** Everything one article page renders. */
interface ArticleFields {
	readonly id: string;
	readonly title: string;
	readonly description: string | null;
	readonly author: string;
	readonly coverImage: string | null;
	readonly html: string;
	readonly toc: readonly TimelineItem[];
	readonly words: number;
	readonly readingMinutes: number;
	/** The source file in the repository (`docs/technical/database.md`), shown as the page's path. */
	readonly sourcePath: string;
	readonly editUrl: string;
	readonly previous: PageLink | null;
	readonly next: PageLink | null;
}

export interface GuidePage extends ArticleFields {
	readonly kind: "guide";
	readonly lastUpdated: number;
	readonly tags: readonly string[];
	readonly superseded: boolean;
	readonly section: string | null;
	readonly icon: IconName;
}

export interface PostPage extends ArticleFields {
	readonly kind: "post";
	readonly date: number;
	readonly category: string;
}

/** A page as its route receives it: everything but the body, which travels in the page's HTML once (src/lib/article-body.ts). */
export type GuideMeta = Omit<GuidePage, "html">;
export type PostMeta = Omit<PostPage, "html">;

/** Splits a rendered page into its body and the rest. */
export function splitBody<TPage extends GuidePage | PostPage>(page: TPage): { readonly html: string; readonly meta: Omit<TPage, "html"> } {
	const { html, ...meta } = page;
	return { html, meta };
}

/** A blog post on the index. */
export interface PostSummary {
	readonly id: string;
	readonly href: string;
	readonly title: string;
	readonly description: string;
	readonly author: string;
	readonly date: number;
	readonly category: string;
	readonly readingMinutes: number;
}

/** The learning center: every section, each guide's first h2s as quick links, and each guide's cover. */
export interface LearningCenter {
	readonly sections: readonly NavSection[];
	readonly quickLinks: Readonly<Record<string, readonly TocItem[]>>;
	readonly covers: Readonly<Record<string, string>>;
}

/** Section quick links shown on each learning-center card. */
const QUICK_LINKS_PER_CARD = 3;
const SUPERSEDED_TAG = "superseded";
const FENCE_PATTERN = /```[\s\S]*?```/g;
const SECTION_HEADING_PATTERN = /^#{2,3}\s/m;

export interface ContentStore {
	readonly navSections: () => readonly NavSection[];
	readonly guide: (id: string) => Promise<GuidePage | null>;
	readonly posts: () => readonly PostSummary[];
	readonly post: (id: string) => Promise<PostPage | null>;
	readonly learningCenter: () => Promise<LearningCenter>;
	readonly searchEntries: () => Promise<readonly SearchEntry[]>;
	/** Every page path the site serves, for pre-rendering. */
	readonly pagePaths: () => readonly string[];
}

/**
 * Words per h2/h3 section of a Markdown body, in order (code fences excluded, as in the reading time). The
 * text before the first section heading belongs to no section. Returns `null` when the body's headings do
 * not line up with the rendered ones (for example a heading written as HTML), so no section shows a wrong
 * figure.
 */
export function sectionWords(body: string, sectionCount: number): readonly number[] | null {
	const [, ...sections] = body.replace(FENCE_PATTERN, " ").split(SECTION_HEADING_PATTERN);
	return sections.length === sectionCount ? sections.map(countWords) : null;
}

/** The "On this page" timeline: h2/h3 entries with the words in each section (0 when they cannot be counted). */
export function buildTimeline(headings: readonly RenderedHeading[], body: string): readonly TimelineItem[] {
	const toc = buildToc(headings);
	const sectionHeadings = headings.filter((heading) => heading.depth === 2 || heading.depth === 3);
	const words = sectionWords(body, sectionHeadings.length);
	return toc.map((item): TimelineItem => {
		const position = sectionHeadings.findIndex((heading) => heading.slug === item.slug);
		return { ...item, words: words?.[position] ?? 0 };
	});
}

function parseFiles<TData>(
	folder: string,
	files: ContentFiles,
	parse: (file: string, source: string) => { readonly data: TData; readonly body: string },
): readonly Entry<TData>[] {
	return Object.entries(files)
		.map(([path, source]): Entry<TData> => ({ id: contentId(path), path, ...parse(`${folder}/${path}`, source) }))
		.sort((left, right) => left.id.localeCompare(right.id));
}

function navLink(item: NavItem | null): PageLink | null {
	return item === null ? null : { title: item.title, href: item.href };
}

/**
 * Resolves after the event loop has had a turn (timers, I/O, new connections). Rendering markdown only ever
 * waits on microtasks, which never let the loop move on, so without this a batch of renders holds the
 * server until the last one finishes.
 */
export function yieldToEventLoop(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

export function createContentStore(sources: ContentSources): ContentStore {
	const guides = parseFiles<GuideFrontmatter>("docs", sources.docs, (file, source) => parseMarkdownFile(file, source, GuideFrontmatterSchema));
	const posts = orderPosts(
		sources.blogMeta,
		parseFiles<PostFrontmatter>("blog", sources.blog, (file, source) => parseMarkdownFile(file, source, PostFrontmatterSchema)).map((entry) => ({
			...entry,
			date: entry.data.date,
		})),
	);
	const guidesById = new Map(guides.map((guide) => [guide.id, guide]));
	const postsById = new Map(posts.map((post) => [post.id, post]));
	const sections = buildNavSections(
		sources.docsMeta,
		guides.map((guide) => ({ id: guide.id, title: guide.data.title, description: guide.data.description ?? "", tags: guide.data.tags })),
	);
	const rendered = new Map<string, ReturnType<MarkdownRenderer>>();
	/** The last render queued; the next one starts after it settles. */
	let queue: Promise<void> = Promise.resolve();

	/**
	 * Each file renders once per process; the pages, search index and learning center share it. Renders run
	 * one at a time with a turn of the event loop between them: the learning center and the search index ask
	 * for all 205 guides at once, and rendered together they kept the pre-render server from accepting a
	 * connection for longer than `fetch` waits (10 s), which failed the build on a busy machine.
	 */
	function renderOnce(folder: "docs" | "blog", entry: Entry<GuideFrontmatter> | Entry<PostFrontmatter>): ReturnType<MarkdownRenderer> {
		const key = `${folder}/${entry.path}`;
		const cached = rendered.get(key);
		if (cached !== undefined) {
			return cached;
		}
		const pending = queue.then(yieldToEventLoop).then(() => sources.render(entry.body, `${sources.repoRoot}/${key}`));
		queue = pending.then(
			(): void => undefined,
			(): void => undefined,
		);
		rendered.set(key, pending);
		return pending;
	}

	async function guide(id: string): Promise<GuidePage | null> {
		const entry = guidesById.get(id);
		if (entry === undefined) {
			return null;
		}
		const { html, headings } = await renderOnce("docs", entry);
		const { previous, next } = findNeighbours(sections, id);
		const words = countWords(entry.body.replace(FENCE_PATTERN, " "));
		return {
			kind: "guide",
			id,
			title: entry.data.title,
			description: entry.data.description ?? null,
			author: entry.data.author,
			coverImage: entry.data.coverImage,
			lastUpdated: entry.data.lastUpdated,
			tags: entry.data.tags.filter((tag) => tag !== SUPERSEDED_TAG),
			superseded: entry.data.tags.includes(SUPERSEDED_TAG),
			section: findSection(sections, id)?.title ?? null,
			icon: docIcon(id),
			html,
			toc: buildTimeline(headings, entry.body),
			words,
			readingMinutes: readingMinutes(entry.body),
			sourcePath: `docs/${entry.path}`,
			editUrl: githubEditUrl("docs", entry.path),
			previous: navLink(previous),
			next: navLink(next),
		};
	}

	function summary(entry: Entry<PostFrontmatter>): PostSummary {
		return {
			id: entry.id,
			href: postHref(entry.id),
			title: entry.data.title,
			description: entry.data.description,
			author: entry.data.author,
			date: entry.data.date,
			category: entry.data.category,
			readingMinutes: readingMinutes(entry.body),
		};
	}

	async function post(id: string): Promise<PostPage | null> {
		const entry = postsById.get(id);
		if (entry === undefined) {
			return null;
		}
		const index = posts.indexOf(entry);
		const newer = posts[index - 1];
		const older = posts[index + 1];
		const { html, headings } = await renderOnce("blog", entry);
		return {
			kind: "post",
			id,
			title: entry.data.title,
			description: entry.data.description,
			author: entry.data.author,
			coverImage: entry.data.coverImage ?? null,
			date: entry.data.date,
			category: entry.data.category,
			html,
			toc: buildTimeline(headings, entry.body),
			words: countWords(entry.body.replace(FENCE_PATTERN, " ")),
			readingMinutes: readingMinutes(entry.body),
			sourcePath: `blog/${entry.path}`,
			editUrl: githubEditUrl("blog", entry.path),
			previous: newer === undefined ? null : { title: newer.data.title, href: postHref(newer.id) },
			next: older === undefined ? null : { title: older.data.title, href: postHref(older.id) },
		};
	}

	async function learningCenter(): Promise<LearningCenter> {
		const entries = await Promise.all(
			flattenNav(sections).map(async (item): Promise<readonly [string, readonly TocItem[]]> => {
				const entry = guidesById.get(item.id);
				if (entry === undefined) {
					return [item.id, []];
				}
				const { headings } = await renderOnce("docs", entry);
				return [item.id, topSections(headings, QUICK_LINKS_PER_CARD)];
			}),
		);
		const covers = Object.fromEntries(
			flattenNav(sections).flatMap((item): [string, string][] => {
				const entry = guidesById.get(item.id);
				return entry === undefined ? [] : [[item.id, entry.data.coverImage]];
			}),
		);
		return { sections, quickLinks: Object.fromEntries(entries), covers };
	}

	async function searchEntries(): Promise<readonly SearchEntry[]> {
		const guideEntries = await Promise.all(
			guides.map(async (entry): Promise<readonly SearchEntry[]> => {
				const href = docHref(entry.id);
				const { headings } = await renderOnce("docs", entry);
				const page: SearchEntry = {
					kind: "page",
					title: entry.data.title,
					href,
					context: findSection(sections, entry.id)?.title ?? "Guides",
					text: toPlainText(`${entry.data.description ?? ""}\n\n${entry.body}`),
				};
				const headingEntries = buildToc(headings).map((item): SearchEntry => ({
					kind: "heading",
					title: item.text,
					href: `${href}#${item.slug}`,
					context: entry.data.title,
					text: "",
				}));
				return [page, ...headingEntries];
			}),
		);
		const postEntries = posts.map((entry): SearchEntry => ({
			kind: "page",
			title: entry.data.title,
			href: postHref(entry.id),
			context: `Blog · ${entry.data.category}`,
			text: toPlainText(`${entry.data.description}\n\n${entry.body}`),
		}));
		return [...guideEntries.flat(), ...postEntries];
	}

	return {
		navSections: (): readonly NavSection[] => sections,
		guide,
		posts: (): readonly PostSummary[] => posts.map(summary),
		post,
		learningCenter,
		searchEntries,
		pagePaths: (): readonly string[] => [...guides.map((entry) => docHref(entry.id)), ...posts.map((entry) => postHref(entry.id))],
	};
}
