import type { MarkdownRenderer, RenderedHeading } from "@workspace/docs-renderer/pipeline";
import { describe, expect, it, vi } from "vitest";

import { buildTimeline, createContentStore, sectionWords, type ContentSources } from "../content";

function guide(title: string, body: string, extra = ""): string {
	return `---\ntitle: "${title}"\nauthor: "Platform Team"\nlastUpdated: 1793145600000\ncoverImage: "/images/cover.png"\n${extra}---\n${body}`;
}

function post(title: string, date: number): string {
	return `---\ntitle: "${title}"\ndescription: "About ${title}"\nauthor: "Backend Team"\ndate: ${String(date)}\ncategory: "Engineering"\n---\nPost body words here.`;
}

const OVERVIEW_BODY = "# Overview\n\nIntro text.\n\n## First part\n\none two three\n\n### Detail\n\nfour five\n\n## Second part\n\n```ts\nnot counted\n```\nsix\n";

/** Headings like the real renderer returns: every h1–h6 with a GitHub slug. */
function headingsOf(markdown: string): RenderedHeading[] {
	return [...markdown.matchAll(/^(?<hashes>#{1,6}) (?<text>.+)$/gm)].map((match) => {
		const text = match.groups?.text ?? "";
		return { depth: (match.groups?.hashes ?? "").length, slug: text.toLowerCase().replace(/\s+/g, "-"), text };
	});
}

function sources(render: MarkdownRenderer): ContentSources {
	return {
		docs: {
			"technical/overview.md": guide("Overview", OVERVIEW_BODY, 'description: "The whole story"\n'),
			"technical/database.md": guide("Database", "## Seed data\n\nRows."),
			"old.md": guide("Old", "Gone.", 'tags: ["superseded", "history"]\n'),
		},
		blog: { "fastify.md": post("Fastify", 2), "epoch.md": post("Epoch", 1), "fresh.md": post("Fresh", 3) },
		docsMeta: { pages: ["--- Engineering ---", "technical/overview", "technical/database"] },
		blogMeta: { pages: ["epoch"] },
		render,
		repoRoot: "/repo",
	};
}

const fakeRender: MarkdownRenderer = (markdown: string) => Promise.resolve({ html: `<p>${String(markdown.length)}</p>`, headings: headingsOf(markdown) });

describe("sectionWords", () => {
	it("should count each h2/h3 section's words (its heading included), skipping code fences and the text before the first section", () => {
		expect(sectionWords(OVERVIEW_BODY, 3)).toEqual([5, 3, 3]);
	});

	it("should give up when the headings do not line up with the rendered ones", () => {
		expect(sectionWords(OVERVIEW_BODY, 2)).toBeNull();
	});
});

describe("buildTimeline", () => {
	it("should attach each entry's section words and drop in-page contents headings", () => {
		const body = "## Contents\n\nx\n\n## Real\n\nwords in here\n";
		expect(buildTimeline(headingsOf(body), body)).toEqual([{ slug: "real", text: "Real", depth: 2, words: 4 }]);
	});

	it("should show 0 words when sections cannot be counted", () => {
		expect(buildTimeline(headingsOf("## Only"), "no headings in this body")).toEqual([{ slug: "only", text: "Only", depth: 2, words: 0 }]);
	});
});

describe("createContentStore", () => {
	const store = createContentStore(sources(fakeRender));

	it("should build the sidebar from meta.json and hide superseded guides from More Guides", () => {
		expect(store.navSections().map((section) => [section.title, section.items.map((item) => item.id)])).toEqual([
			["Engineering", ["technical/overview", "technical/database"]],
		]);
	});

	it("should render a guide page with its timeline, neighbours, source path and edit link", async () => {
		const page = await store.guide("technical/overview");
		expect(page).toMatchObject({
			kind: "guide",
			title: "Overview",
			description: "The whole story",
			section: "Engineering",
			sourcePath: "docs/technical/overview.md",
			previous: null,
			next: { title: "Database", href: "/docs/technical/database" },
			superseded: false,
			readingMinutes: 1,
		});
		expect(page?.editUrl).toMatch(/\/blob\/main\/docs\/technical\/overview\.md$/);
		expect(page?.toc.map((item) => [item.slug, item.words])).toEqual([
			["first-part", 5],
			["detail", 3],
			["second-part", 3],
		]);
	});

	it("should mark a superseded guide and drop the tag from the visible ones", async () => {
		const page = await store.guide("old");
		expect(page?.superseded).toBe(true);
		expect(page?.tags).toEqual(["history"]);
		expect(page?.description).toBeNull();
	});

	it("should return null for a guide or post that does not exist", async () => {
		await expect(store.guide("missing")).resolves.toBeNull();
		await expect(store.post("missing")).resolves.toBeNull();
	});

	it("should order posts by blog/meta.json, then newest first, and link each to its neighbours", async () => {
		expect(store.posts().map((summary) => summary.id)).toEqual(["epoch", "fresh", "fastify"]);
		const page = await store.post("fresh");
		expect(page?.previous).toEqual({ title: "Epoch", href: "/blog/epoch" });
		expect(page?.next).toEqual({ title: "Fastify", href: "/blog/fastify" });
		expect(page?.coverImage).toBeNull();
	});

	it("should give the learning center each guide's first h2s as quick links", async () => {
		const center = await store.learningCenter();
		expect(center.quickLinks["technical/overview"]?.map((item) => item.slug)).toEqual(["first-part", "second-part"]);
		expect(center.covers["technical/database"]).toBe("/images/cover.png");
	});

	it("should index a page entry per guide and post plus one entry per heading", async () => {
		const entries = await store.searchEntries();
		expect(entries.filter((entry) => entry.kind === "page").map((entry) => entry.href)).toEqual([
			"/docs/old",
			"/docs/technical/database",
			"/docs/technical/overview",
			"/blog/epoch",
			"/blog/fresh",
			"/blog/fastify",
		]);
		expect(entries).toContainEqual({ kind: "heading", title: "Seed data", href: "/docs/technical/database#seed-data", context: "Database", text: "" });
	});

	it("should list every page path for pre-rendering", () => {
		expect(store.pagePaths()).toEqual(["/docs/old", "/docs/technical/database", "/docs/technical/overview", "/blog/epoch", "/blog/fresh", "/blog/fastify"]);
	});

	it("should render one file at a time, letting the event loop run between them", async () => {
		const events: string[] = [];
		let running = 0;
		const render = vi.fn(async (markdown: string, filePath: string): ReturnType<MarkdownRenderer> => {
			running += 1;
			events.push(`start ${String(running)}`);
			const result = await fakeRender(markdown, filePath);
			running -= 1;
			return result;
		});
		const serial = createContentStore(sources(render));
		setTimeout(() => events.push("timer"), 0);
		await serial.learningCenter();
		// Never two renders at once, and a timer queued before the batch ran before it finished.
		expect(events.filter((event) => event.startsWith("start"))).toEqual(Array.from({ length: render.mock.calls.length }, () => "start 1"));
		expect(events.indexOf("timer")).toBeLessThan(events.length - 1);
	});

	it("should keep rendering after a file fails", async () => {
		const render = vi.fn((markdown: string, filePath: string): ReturnType<MarkdownRenderer> =>
			filePath.endsWith("overview.md") ? Promise.reject(new Error("bad markdown")) : fakeRender(markdown, filePath),
		);
		const failing = createContentStore(sources(render));
		await expect(failing.guide("technical/overview")).rejects.toThrow("bad markdown");
		expect(await failing.guide("technical/database")).not.toBeNull();
	});

	it("should render each file once, however many views read it", async () => {
		const render = vi.fn(fakeRender);
		const counted = createContentStore(sources(render));
		await counted.guide("technical/database");
		await counted.searchEntries();
		await counted.learningCenter();
		expect(render.mock.calls.filter(([, filePath]) => filePath === "/repo/docs/technical/database.md")).toHaveLength(1);
	});
});
