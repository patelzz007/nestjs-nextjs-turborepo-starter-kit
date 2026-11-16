import { assetLink, PAGE_TITLE_TOKEN, pageLink } from "@workspace/docs-content/document";
import { MANIFEST_PATH, parseManifest, REDIRECTS_PATH, SYNCED_IMAGES_FOLDER } from "@workspace/docs-content/manifest";
import { BLOG_META_PATH, DOCS_META_PATH, parseNavigation } from "@workspace/docs-content/navigation";
import { beforeEach, describe, expect, it } from "vitest";

import { runSync } from "../run-sync.ts";
import { body, FakeSource, guide, MemoryStore, OPTIONS } from "./fakes.ts";

const FILE_A = "docs/guides/page-a.md";
const FILE_B = "docs/guides/page-b.md";

describe("runSync", () => {
	let source: FakeSource;
	let store: MemoryStore;

	beforeEach(() => {
		source = new FakeSource();
		store = new MemoryStore({ [DOCS_META_PATH]: JSON.stringify({ pages: ["--- Start ---", "README"] }), [BLOG_META_PATH]: JSON.stringify({ title: "Blog", pages: [] }) });
	});

	const pageB = guide({ sourceId: "page-b", title: "Page B", slug: "guides/page-b", order: 2 });

	it("publishes a new page with its front matter, manifest and sidebar", async () => {
		source.add(guide());

		const { report } = await runSync(source, store, OPTIONS);

		expect(report).toMatchObject({ status: "SUCCEEDED", pagesProcessed: 1, pagesUnchanged: 0, pagesHeldBack: 0, runId: "run-1", startedAt: 5000 });
		expect(store.text(FILE_A)).toContain("title: Page A");
		expect(store.text(FILE_A)).toContain("Edit it at the source: https://tool.example/page-a");
		expect(store.text(FILE_A)).toContain("Body of Page A.");
		expect(parseManifest(store.text(MANIFEST_PATH)).entries).toHaveLength(1);
		expect(JSON.parse(store.text(DOCS_META_PATH))).toEqual({ pages: ["--- Start ---", "README", "--- Guides ---", "guides/page-a"] });
	});

	it("invariant 3: an unchanged sync reads nothing and writes nothing", async () => {
		source.add(guide());
		await runSync(source, store, OPTIONS);
		source.reads = [];
		store.writes = 0;

		const { report } = await runSync(source, store, { ...OPTIONS, runId: "run-2" });

		expect(report).toMatchObject({ status: "SUCCEEDED", pagesProcessed: 0, pagesUnchanged: 1 });
		expect(source.reads).toEqual([]);
		expect(store.writes).toBe(0);
	});

	it("is repeatable: a full sync of the same input gives byte-identical pages", async () => {
		source.add(guide());
		await runSync(source, store, OPTIONS);
		const first = store.text(FILE_A);

		await runSync(source, store, { ...OPTIONS, runId: "run-2", full: true });

		expect(store.text(FILE_A)).toBe(first);
	});

	it("invariant 9: a full sync rebuilds the generated state from the source alone", async () => {
		source.add(guide());
		source.add(pageB);
		await runSync(source, store, OPTIONS);
		const rebuilt = new MemoryStore({ [DOCS_META_PATH]: JSON.stringify({ pages: [] }) });

		await runSync(source, rebuilt, { ...OPTIONS, full: true });

		expect(rebuilt.text(FILE_A)).toBe(store.text(FILE_A));
		expect(rebuilt.text(FILE_B)).toBe(store.text(FILE_B));
	});

	it("reads only the page that changed", async () => {
		source.add(guide());
		source.add(pageB);
		await runSync(source, store, OPTIONS);
		source.reads = [];

		source.add(guide({ editedAt: 2000 }), body("New words."));
		const { report } = await runSync(source, store, { ...OPTIONS, runId: "run-2" });

		expect(source.reads).toEqual(["page-a"]);
		expect(report).toMatchObject({ pagesProcessed: 1, pagesUnchanged: 1 });
		expect(store.text(FILE_A)).toContain("New words.");
	});

	it("rebuilds every page when the converter changes", async () => {
		source.add(guide());
		await runSync(source, store, OPTIONS);
		source.reads = [];
		source.converterVersion = 2;

		await runSync(source, store, { ...OPTIONS, runId: "run-2" });

		expect(source.reads).toEqual(["page-a"]);
	});

	it("invariant 1: a failed page keeps its last good version, and the others publish", async () => {
		source.add(guide());
		source.add(pageB);
		await runSync(source, store, OPTIONS);
		const lastGood = store.text(FILE_A);

		source.add(guide({ editedAt: 2000 }), body("Bad.", { issues: [{ blockId: "b1", blockType: "column_list", reason: "Columns.", fix: "Stack them." }] }));
		source.add({ ...pageB, editedAt: 2000 }, body("Good new words."));
		const { report } = await runSync(source, store, { ...OPTIONS, runId: "run-2" });

		expect(report.status).toBe("PARTIAL");
		expect(report.heldBack).toEqual([expect.objectContaining({ sourceId: "page-a", issues: [expect.objectContaining({ blockId: "b1", blockType: "column_list" })] })]);
		expect(store.text(FILE_A)).toBe(lastGood);
		expect(store.text(FILE_B)).toContain("Good new words.");
	});

	it("retries a held-back page on the next sync, because its manifest entry did not advance", async () => {
		source.add(guide());
		source.unreadable.add("page-a");
		const first = await runSync(source, store, OPTIONS);
		expect(first.report.heldBack).toEqual([expect.objectContaining({ issues: [expect.objectContaining({ reason: "The page could not be read: timed out" })] })]);

		source.unreadable.clear();
		const second = await runSync(source, store, { ...OPTIONS, runId: "run-2" });

		expect(second.report).toMatchObject({ status: "SUCCEEDED", pagesProcessed: 1 });
	});

	it("holds back a page that fails the publishing rules, without reading it", async () => {
		source.add(guide({ slug: null }));

		const { report } = await runSync(source, store, OPTIONS);

		expect(report).toMatchObject({ status: "PARTIAL", pagesHeldBack: 1 });
		expect(source.reads).toEqual([]);
	});

	it("invariant 2: a duplicate slug blocks the batch and writes nothing", async () => {
		source.add(guide());
		source.add(guide({ sourceId: "page-b" }));

		const { report } = await runSync(source, store, OPTIONS);

		expect(report.status).toBe("BLOCKED");
		expect(report.errorSummary).toContain("guides/page-a");
		expect(store.writes).toBe(0);
	});

	it("invariant 2: a corrupt manifest blocks the batch", async () => {
		store.files.set(MANIFEST_PATH, "{ not json");
		source.add(guide());

		const { report } = await runSync(source, store, OPTIONS);

		expect(report.status).toBe("BLOCKED");
		expect(store.writes).toBe(0);
	});

	it("reports FAILED, and writes nothing, when the source cannot be listed", async () => {
		source.listError = new Error("Notion answered 503");

		const { report } = await runSync(source, store, OPTIONS);

		expect(report).toMatchObject({ status: "FAILED", errorSummary: "Could not list the published documents: Notion answered 503" });
		expect(store.writes).toBe(0);
	});

	it("invariant 4: a renamed slug moves the file, keeps the identity and adds a redirect", async () => {
		source.add(guide());
		await runSync(source, store, OPTIONS);

		source.add(guide({ slug: "guides/renamed", editedAt: 2000 }));
		await runSync(source, store, { ...OPTIONS, runId: "run-2" });

		expect(store.files.has(FILE_A)).toBe(false);
		expect(store.files.has("docs/guides/renamed.md")).toBe(true);
		expect(JSON.parse(store.text(REDIRECTS_PATH))).toEqual([{ from: "/docs/guides/page-a", to: "/docs/guides/renamed" }]);
		expect(parseNavigation(store.text(DOCS_META_PATH)).pages).toEqual(["--- Start ---", "README", "--- Guides ---", "guides/renamed"]);
		expect(parseManifest(store.text(MANIFEST_PATH)).entries).toEqual([expect.objectContaining({ sourceId: "page-a", previousSlugs: ["guides/page-a"] })]);
	});

	it("moves a page whose folder moved, although the page itself was not edited", async () => {
		source.add(guide());
		await runSync(source, store, OPTIONS);

		// Same edit time: only the folder above it changed.
		source.add(guide({ slug: "reference/page-a" }));
		await runSync(source, store, { ...OPTIONS, runId: "run-2" });

		expect(store.files.has(FILE_A)).toBe(false);
		expect(store.files.has("docs/reference/page-a.md")).toBe(true);
		expect(JSON.parse(store.text(REDIRECTS_PATH))).toEqual([{ from: "/docs/guides/page-a", to: "/docs/reference/page-a" }]);
	});

	it("turns the redirect around when a slug is changed back: the interim address was live, and no loop remains", async () => {
		source.add(guide());
		await runSync(source, store, OPTIONS);
		source.add(guide({ slug: "guides/renamed", editedAt: 2000 }));
		await runSync(source, store, { ...OPTIONS, runId: "run-2" });

		source.add(guide({ editedAt: 3000 }));
		const { report } = await runSync(source, store, { ...OPTIONS, runId: "run-3" });

		expect(report.status).toBe("SUCCEEDED");
		expect(JSON.parse(store.text(REDIRECTS_PATH))).toEqual([{ from: "/docs/guides/renamed", to: "/docs/guides/page-a" }]);
	});

	it("resolves a link between pages by id, and re-renders the linker when the target moves", async () => {
		source.add(guide(), body(`See [the other page](${pageLink("page-b")}) and [${PAGE_TITLE_TOKEN}](${pageLink("page-b")}).`, { links: ["page-b"] }));
		source.add(pageB);
		await runSync(source, store, OPTIONS);
		expect(store.text(FILE_A)).toContain("See [the other page](page-b.md) and [Page B](page-b.md).");

		source.add({ ...pageB, slug: "reference/page-b", editedAt: 2000 });
		await runSync(source, store, { ...OPTIONS, runId: "run-2" });

		expect(store.text(FILE_A)).toContain("[the other page](../reference/page-b.md)");
	});

	it("invariant 5: a broken link names both pages and holds the page back", async () => {
		source.add(guide(), body(`[x](${pageLink("page-z")})`, { links: ["page-z"] }));

		const { report } = await runSync(source, store, OPTIONS);

		expect(report.heldBack).toEqual([expect.objectContaining({ issues: [expect.objectContaining({ reason: '"Page A" links to page-z, which is not published.' })] })]);
		expect(store.files.has(FILE_A)).toBe(false);
	});

	it("removes an unpublished page, leaves a tombstone and takes it off the sidebar", async () => {
		source.add(guide());
		source.add(pageB);
		await runSync(source, store, OPTIONS);

		source.remove("page-b");
		const { report } = await runSync(source, store, { ...OPTIONS, runId: "run-2" });

		expect(report).toMatchObject({ status: "SUCCEEDED", pagesRemoved: 1 });
		expect(store.files.has(FILE_B)).toBe(false);
		expect(parseManifest(store.text(MANIFEST_PATH)).tombstones).toEqual([expect.objectContaining({ sourceId: "page-b", slug: "guides/page-b" })]);
		expect(parseNavigation(store.text(DOCS_META_PATH)).pages).not.toContain("guides/page-b");
	});

	it("keeps an unpublished page while another still links to it", async () => {
		source.add(guide(), body(`[b](${pageLink("page-b")})`, { links: ["page-b"] }));
		source.add(pageB);
		await runSync(source, store, OPTIONS);

		source.remove("page-b");
		const { report } = await runSync(source, store, { ...OPTIONS, runId: "run-2" });

		expect(report).toMatchObject({ status: "PARTIAL", pagesRemoved: 0 });
		expect(report.heldBack.at(0)?.sourceId).toBe("page-b");
		expect(report.heldBack.at(0)?.issues.at(0)?.fix).toContain('Remove the link from "Page A"');
		expect(store.files.has(FILE_B)).toBe(true);
	});

	it("removes two unpublished pages that only link to each other", async () => {
		source.add(guide(), body(`[b](${pageLink("page-b")})`, { links: ["page-b"] }));
		source.add(pageB, body(`[a](${pageLink("page-a")})`, { links: ["page-a"] }));
		await runSync(source, store, OPTIONS);

		source.remove("page-a");
		source.remove("page-b");
		const { report } = await runSync(source, store, { ...OPTIONS, runId: "run-2" });

		expect(report.pagesRemoved).toBe(2);
	});

	it("stores an asset by content hash and points the page at the site path", async () => {
		source.add(guide(), body(`![A shot](${assetLink("img-1")})`, { assets: [{ assetKey: "img-1", url: "https://files.example/a.png" }] }));

		await runSync(source, store, OPTIONS);

		const [file = ""] = await store.list(SYNCED_IMAGES_FOLDER);
		expect(file).toMatch(/^docs\/images\/synced\/[0-9a-f]{32}\.png$/u);
		expect(store.text(FILE_A)).toContain(`![A shot](/${file.replace("docs/", "")})`);
	});

	it("stores a hosted cover and uses it in the front matter", async () => {
		source.add(guide({ cover: { kind: "asset", assetKey: "cover-1", url: "https://files.example/c.png" } }));

		await runSync(source, store, OPTIONS);

		expect(store.text(FILE_A)).toMatch(/coverImage: \/images\/synced\/[0-9a-f]{32}\.png/u);
	});

	it("holds back a page whose asset cannot be downloaded", async () => {
		source.brokenAssets.add("img-1");
		source.add(guide(), body(`![x](${assetLink("img-1")})`, { assets: [{ assetKey: "img-1", url: "https://files.example/a.png" }] }));

		const { report } = await runSync(source, store, OPTIONS);

		expect(report.heldBack).toEqual([expect.objectContaining({ issues: [expect.objectContaining({ blockId: "img-1", reason: "The file's host answered 404" })] })]);
	});

	it("invariant 6: removing a page never deletes an asset another page still uses", async () => {
		const shared = body(`![x](${assetLink("img-1")})`, { assets: [{ assetKey: "img-1", url: "https://files.example/a.png" }] });
		source.add(guide(), shared);
		source.add(pageB, shared);
		await runSync(source, store, OPTIONS);
		const before = await store.list(SYNCED_IMAGES_FOLDER);

		source.remove("page-b");
		await runSync(source, store, { ...OPTIONS, runId: "run-2" });

		expect(await store.list(SYNCED_IMAGES_FOLDER)).toEqual(before);
	});

	it("deletes an asset once nothing uses it", async () => {
		source.add(guide(), body(`![x](${assetLink("img-1")})`, { assets: [{ assetKey: "img-1", url: "https://files.example/a.png" }] }));
		await runSync(source, store, OPTIONS);

		source.add(guide({ editedAt: 2000 }), body("No image now."));
		await runSync(source, store, { ...OPTIONS, runId: "run-2" });

		expect(await store.list(SYNCED_IMAGES_FOLDER)).toEqual([]);
	});

	it("never overwrites a hand-written file unless told to adopt it", async () => {
		store.files.set(FILE_A, "Hand-written.");
		source.add(guide());

		const refused = await runSync(source, store, OPTIONS);
		expect(refused.report.heldBack).toEqual([
			expect.objectContaining({ issues: [expect.objectContaining({ reason: `${FILE_A} already exists and no synced page owns it.` })] }),
		]);
		expect(store.text(FILE_A)).toBe("Hand-written.");

		const adopted = await runSync(source, store, { ...OPTIONS, adopt: true });
		expect(adopted.report.status).toBe("SUCCEEDED");
		expect(store.text(FILE_A)).toContain("Body of Page A.");
	});

	it("publishes a post into the blog and its list", async () => {
		source.add(guide({ sourceId: "post-1", collection: "blog", slug: "hello", section: null, order: null, category: "News", publishedAt: 900 }));

		await runSync(source, store, OPTIONS);

		expect(store.text("docs/blog/hello.md")).toContain("category: News");
		expect(JSON.parse(store.text(BLOG_META_PATH))).toEqual({ title: "Blog", pages: ["hello"] });
	});

	it("warns, but publishes, when a guide has no cover", async () => {
		source.add(guide({ cover: null }));

		const { report, warnings } = await runSync(source, store, OPTIONS);

		expect(report).toMatchObject({ status: "SUCCEEDED", warnings: 1 });
		expect(warnings).toEqual([expect.stringContaining("no cover")]);
	});
});
