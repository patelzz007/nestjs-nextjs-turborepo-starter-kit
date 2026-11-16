import { isStringPrimitive } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { DownloadEnvironment } from "../../../locked-download.ts";
import { describeDocsSource } from "../../__tests__/source-contract.ts";
import { LIVE_NOTION_ENVIRONMENT, NotionClient } from "../notion-client.ts";
import { documentMetaOf, NotionSource } from "../notion-source.ts";
import { NotionPageSchema } from "../notion-schemas.ts";
import { apiFolder, apiPage, block, FOLDER_ID, PAGE_ID, text } from "./notion-fixtures.ts";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function client(respond: (url: string) => Response): NotionClient {
	return new NotionClient("token", {
		...LIVE_NOTION_ENVIRONMENT,
		fetch: (input) => Promise.resolve(respond(String(input))),
		sleep: () => Promise.resolve(),
	});
}

function healthyResponse(url: string): Response {
	const results = url.includes("/query") ? (url.includes("docs-ds") ? [apiFolder(), apiPage()] : []) : [block("paragraph", { paragraph: { rich_text: [text("Hello")] } })];
	return new Response(JSON.stringify({ results, has_more: false, next_cursor: null }));
}

const DOWNLOADS: DownloadEnvironment = {
	fetch: () => Promise.resolve(new Response(PNG, { headers: { "content-type": "image/png" } })),
	resolveHost: () => Promise.resolve(["52.92.0.1"]),
};

function source(respond: (url: string) => Response): NotionSource {
	return new NotionSource(client(respond), { docs: "docs-ds", blog: "blog-ds" }, DOWNLOADS);
}

describeDocsSource("NotionSource", {
	healthy: () => source(healthyResponse),
	unreachable: () => source(() => new Response(JSON.stringify({ code: "unauthorized", message: "no" }), { status: 401 })),
});

describe("NotionSource.list and the folder tree", () => {
	const ROOT_ID = "aaaaaaaa-0000-0000-0000-000000000001";

	function listing(docsRows: readonly object[]): { readonly source: NotionSource; readonly bodies: string[] } {
		const bodies: string[] = [];
		const listed = new NotionSource(
			new NotionClient("token", {
				...LIVE_NOTION_ENVIRONMENT,
				fetch: (input, init): Promise<Response> => {
					const url = String(input);
					const body = init?.body;
					bodies.push(`${url.includes("docs-ds") ? "docs" : "blog"} ${isStringPrimitive(body) ? body : ""}`);
					return Promise.resolve(new Response(JSON.stringify({ results: url.includes("docs-ds") ? docsRows : [apiPage()], has_more: false, next_cursor: null })));
				},
				sleep: (): Promise<void> => Promise.resolve(),
			}),
			{ docs: "docs-ds", blog: "blog-ds" },
			DOWNLOADS,
		);
		return { source: listed, bodies };
	}

	it("gives a docs page the path of the folders above it, and lists no folder as a document", async () => {
		const { source: listed } = listing([apiFolder(ROOT_ID, "technical"), apiFolder(FOLDER_ID, "guides", ROOT_ID), apiPage()]);

		const docs = (await listed.list()).filter((meta) => meta.collection === "docs");

		expect(docs.map((meta) => [meta.sourceId, meta.slug, meta.issues])).toEqual([[PAGE_ID, "technical/guides/setup", []]]);
	});

	it("asks for published pages and every folder in docs, and published posts only in the blog", async () => {
		const { source: listed, bodies } = listing([apiFolder(), apiPage()]);

		await listed.list();

		expect(bodies.find((body) => body.startsWith("docs"))).toContain(
			'"or":[{"property":"Status","select":{"equals":"Published"}},{"property":"Kind","select":{"equals":"Folder"}}]',
		);
		expect(bodies.find((body) => body.startsWith("blog"))).toContain('"filter":{"property":"Status","select":{"equals":"Published"}}');
	});

	it("keeps a post's slug as written: the blog has no folders", async () => {
		const { source: listed } = listing([]);

		expect((await listed.list()).map((meta) => [meta.collection, meta.slug])).toEqual([["blog", "setup"]]);
	});

	it("holds back a page whose folder is not published, with the reason", async () => {
		const { source: listed } = listing([apiPage()]);

		const [page] = await listed.list();

		expect(page).toMatchObject({ slug: null, issues: [expect.objectContaining({ reason: "The Parent of this page is not a published folder." })] });
	});
});

describe("documentMetaOf", () => {
	const parse = (overrides: Parameters<typeof apiPage>[0] = {}): ReturnType<typeof NotionPageSchema.parse> => NotionPageSchema.parse(apiPage(overrides));

	it("reads every property; on its own, the slug is the Slug property", () => {
		expect(documentMetaOf(parse(), "docs")).toMatchObject({
			sourceId: PAGE_ID,
			title: "Setup",
			slug: "setup",
			issues: [],
			description: "How to set up.",
			section: "Guides",
			order: 3,
			author: null,
			tags: ["setup"],
			editedAt: Date.parse("2026-11-07T10:00:00.000Z"),
			cover: null,
		});
	});

	it("treats an uploaded cover as an asset and a pasted one as a link", () => {
		const uploaded = parse({ cover: { type: "file", file: { url: "https://file.notion.so/c.png" } } });
		const pasted = parse({ cover: { type: "external", external: { url: "https://a.example/c.png" } } });

		expect(documentMetaOf(uploaded, "blog").cover).toEqual({ kind: "asset", assetKey: `${PAGE_ID}-cover`, url: "https://file.notion.so/c.png" });
		expect(documentMetaOf(pasted, "blog").cover).toEqual({ kind: "external", url: "https://a.example/c.png" });
	});

	it("leaves an order that is not a whole number above zero empty", () => {
		const page = parse();
		const withOrder = (value: number): typeof page => ({ ...page, properties: { ...page.properties, Order: { type: "number", number: value } } });

		expect(documentMetaOf(withOrder(1.5), "docs").order).toBeNull();
		expect(documentMetaOf(withOrder(0), "docs").order).toBeNull();
	});

	it("reads the three dates apart: Date when first published, Last updated as the writer set it, and Notion's own edit time", () => {
		const page = parse();
		const dated = {
			...page,
			properties: { ...page.properties, Date: { type: "date", date: { start: "2026-10-01" } }, "Last updated": { type: "date", date: { start: "2026-11-02" } } },
		};

		expect(documentMetaOf(dated, "docs")).toMatchObject({
			publishedAt: Date.parse("2026-10-01"),
			lastUpdated: Date.parse("2026-11-02"),
			editedAt: Date.parse("2026-11-07T10:00:00.000Z"),
		});
		expect(documentMetaOf(page, "docs").lastUpdated).toBeNull();
	});

	it("reads a post's date", () => {
		const page = parse();
		const dated = { ...page, properties: { ...page.properties, Date: { type: "date", date: { start: "2026-11-01" } } } };

		expect(documentMetaOf(dated, "blog").publishedAt).toBe(Date.parse("2026-11-01"));
	});
});

describe("NotionSource", () => {
	it("asks only for Published pages, from both databases", async () => {
		const queried: string[] = [];
		const notion = source((url) => {
			queried.push(url);
			return healthyResponse(url);
		});

		await notion.list();

		expect(queried.map((url) => url.replace("https://api.notion.com/v1", ""))).toEqual(["/data_sources/docs-ds/query", "/data_sources/blog-ds/query"]);
	});

	it("downloads an uploaded file through the locked downloader", async () => {
		await expect(source(healthyResponse).fetchAsset({ assetKey: "a", url: "https://file.notion.so/a.png" })).resolves.toMatchObject({ extension: "png" });
	});

	it("refuses a file from anywhere else", async () => {
		await expect(source(healthyResponse).fetchAsset({ assetKey: "a", url: "https://evil.example/a.png" })).rejects.toThrow("own hosts");
	});
});
