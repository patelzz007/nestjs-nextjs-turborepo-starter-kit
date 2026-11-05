import { rememberArticleBody } from "@/lib/article-body";
import { splitBody, type GuideMeta, type GuidePage, type PostMeta, type PostPage, type PostSummary, type TimelineItem } from "@/lib/content";
import type { NavSection } from "@/lib/navigation";
import type { SearchEntry } from "@/lib/search";

/** Realistic page data for the component tests (the real content model's shapes). */
export const SECTIONS: readonly NavSection[] = [
	{
		title: "Authorization",
		icon: "shieldCheck",
		items: [
			{
				id: "technical/authorization/overview",
				title: "Authorization: start here",
				description: "The whole access system as one story.",
				href: "/docs/technical/authorization/overview",
				icon: "shieldCheck",
			},
			{ id: "technical/authorization/backend", title: "Backend", description: "", href: "/docs/technical/authorization/backend", icon: "server" },
		],
	},
];

export const TIMELINE: readonly TimelineItem[] = [
	{ slug: "the-one-picture", text: "The one picture", depth: 2, words: 300 },
	{ slug: "where-the-code-lives", text: "Where the code lives", depth: 2, words: 220 },
	{ slug: "backend", text: "Backend", depth: 3, words: 220 },
	{ slug: "glossary", text: "Glossary", depth: 2, words: 0 },
];

/** A guide as its route receives it; its body is remembered the way the server function does it. */
export function guidePage(overrides: Partial<GuidePage> = {}): GuideMeta {
	return served({
		kind: "guide",
		id: "technical/authorization/overview",
		title: "Authorization: start here",
		description: "Who you are, which merchant you act for, and the database's own safety net.",
		author: "Platform Team",
		coverImage: "https://images.example/cover.jpg",
		lastUpdated: 1793145600000,
		tags: ["rbac", "rls"],
		superseded: false,
		section: "Authorization",
		icon: "shieldCheck",
		html: '<h2 id="the-one-picture">The one picture</h2><p>Every request walks one path.</p>',
		toc: TIMELINE,
		words: 760,
		readingMinutes: 4,
		sourcePath: "docs/technical/authorization/overview.md",
		editUrl: "https://github.com/acme/kit/blob/main/docs/technical/authorization/overview.md",
		previous: null,
		next: { title: "Backend", href: "/docs/technical/authorization/backend" },
		...overrides,
	});
}

export function postPage(overrides: Partial<PostPage> = {}): PostMeta {
	return served({
		kind: "post",
		id: "fastify-migration",
		title: "Why we moved the API from Express to Fastify",
		description: "The benchmark-driven rationale.",
		author: "Platform Team",
		coverImage: null,
		date: 1789689600000,
		category: "Architecture",
		html: "<p>Fastify was built for this workload.</p>",
		toc: [],
		words: 120,
		readingMinutes: 1,
		sourcePath: "blog/fastify-migration.md",
		editUrl: "https://github.com/acme/kit/blob/main/blog/fastify-migration.md",
		previous: { title: "Changelog", href: "/blog/changelog" },
		next: null,
		...overrides,
	});
}

function served<TPage extends GuidePage | PostPage>(page: TPage): Omit<TPage, "html"> {
	const { html, meta } = splitBody(page);
	rememberArticleBody(meta.sourcePath, html);
	return meta;
}

export const POSTS: readonly PostSummary[] = [
	{
		id: "fastify-migration",
		href: "/blog/fastify-migration",
		title: "Why we moved the API from Express to Fastify",
		description: "The rationale.",
		author: "Platform Team",
		date: 1789689600000,
		category: "Architecture",
		readingMinutes: 1,
	},
];

export const SEARCH_ENTRIES: readonly SearchEntry[] = [
	{ kind: "page", title: "Row-level security", href: "/docs/technical/database/rls", context: "Authorization", text: "Postgres rules that hide other tenants' rows." },
	{ kind: "heading", title: "Tenant boundary", href: "/docs/adr/014#tenant-boundary", context: "ADR 014", text: "" },
];

/** A `fetch` that answers every request with `body` as JSON (or with `status` when it is not 200). */
export function jsonFetch(body: object, status = 200): typeof fetch {
	return (): Promise<Response> => Promise.resolve(new Response(JSON.stringify(body), { status }));
}
