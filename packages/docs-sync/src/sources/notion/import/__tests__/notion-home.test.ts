import { isStringPrimitive } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { NotionClient } from "../../notion-client.ts";
import { applyHomeLayout, HOME_COVER_FILE, HomePageNotEmptyError, homePage, type HomeDatabases } from "../notion-home.ts";
import { NotionWriter } from "../notion-writer.ts";

const DATABASES: HomeDatabases = {
	docsPublished: { databaseId: "docs-db", dataSourceId: "docs-ds" },
	blogPublished: { databaseId: "blog-db", dataSourceId: "blog-ds" },
	docsDrafts: "docs-drafts-db",
	blogDrafts: "blog-drafts-db",
};

/** The text of a block in the shape the API takes. */
function textOf(block: object | undefined): string {
	return JSON.stringify(block ?? {});
}

describe("homePage", () => {
	const page = homePage(DATABASES, "parent-id");

	it("puts each view right after the block that introduces it", () => {
		expect(page.views.map(({ afterIndex, view }) => [view.name, textOf(page.blocks.at(afterIndex))])).toEqual([
			["Docs by folder", expect.stringContaining("Open a folder")],
			["Recently edited", expect.stringContaining("🕘 Recently edited")],
			["Posts", expect.stringContaining("📰 Blog")],
		]);
	});

	it("shows Docs Published as a tree, nested by Parent", () => {
		expect(page.views.at(0)?.view).toMatchObject({ dataSourceId: "docs-ds", type: "table", configuration: { subtasks: { property_id: "parent-id", display_mode: "show" } } });
		expect(page.views.at(2)?.view).toMatchObject({ dataSourceId: "blog-ds", type: "gallery", configuration: { cover: { type: "page_cover" } } });
	});

	it("links all four databases under Write and Live, and leaves out a Drafts database the page does not have", () => {
		const links = (databases: typeof DATABASES): number => (textOf(homePage(databases, "p").blocks.at(1)).match(/"link_to_page"/gu) ?? []).length;

		expect(links(DATABASES)).toBe(8);
		expect(links({ ...DATABASES, docsDrafts: null, blogDrafts: null })).toBe(4);
	});

	it("keeps the rules for writers in a toggle, and ends with the databases' heading", () => {
		expect(textOf(page.blocks.find((block) => textOf(block).includes('"type":"toggle"')))).toContain("Rules for writers");
		expect(textOf(page.blocks.at(-1))).toContain("🗄️ Databases");
	});
});

interface Call {
	readonly method: string;
	readonly path: string;
	readonly body: string;
}

/** A page holding the four databases, any `extra` blocks and, from an earlier layout, a linked view of Docs Published. */
function workspace(extra: readonly string[] = [], laidOutBefore = false): { readonly writer: NotionWriter; readonly calls: Call[] } {
	const calls: Call[] = [];
	const originals: Readonly<Record<string, string>> = {
		"docs-db": "Docs Published",
		"drafts-db": "Docs Drafts",
		"blog-db": "Blog Published",
		"blog-drafts-db": "Blog Drafts",
	};
	const sourceOf: Readonly<Record<string, string>> = {
		"docs-db": "docs-ds",
		"drafts-db": "drafts-ds",
		"blog-db": "blog-ds",
		"blog-drafts-db": "blog-drafts-ds",
		"linked-db": "docs-ds",
	};
	const databaseOfSource: Readonly<Record<string, string>> = { "docs-ds": "docs-db", "drafts-ds": "drafts-db", "blog-ds": "blog-db", "blog-drafts-ds": "blog-drafts-db" };
	const answer = (value: object): Promise<Response> => Promise.resolve(new Response(JSON.stringify(value)));
	const client = new NotionClient("token", {
		fetch: (url, init): Promise<Response> => {
			const path = String(url).replace("https://api.notion.com/v1", "");
			const method = init?.method ?? "GET";
			const body = init?.body;
			calls.push({ method, path, body: isStringPrimitive(body) ? body : "" });
			const id = path.split("/").at(2)?.split("?").at(0) ?? "";
			if (path.startsWith("/data_sources/")) {
				return answer({
					parent: { database_id: databaseOfSource[id] ?? "" },
					properties: { Kind: { id: "kind-id", type: "select" }, Parent: { id: "parent-id", type: "relation" } },
				});
			}
			if (path.startsWith("/databases/")) {
				return answer({ parent: { page_id: "home" }, data_sources: [{ id: sourceOf[id] ?? "" }] });
			}
			if (method === "GET" && path.startsWith("/blocks/home/children")) {
				const databases = [...Object.entries(originals), ...(laidOutBefore ? [["linked-db", "Docs Published"]] : [])].map(([blockId = "", title = ""]) => ({
					id: blockId,
					type: "child_database",
					child_database: { title },
				}));
				// An `extra` id starting "blank" is an empty line; any other is a note someone wrote.
				const paragraphs = extra.map((blockId) => ({
					id: blockId,
					type: "paragraph",
					paragraph: { rich_text: blockId.startsWith("blank") ? [] : [{ plain_text: "A note" }] },
				}));
				return answer({ results: [...paragraphs, ...databases], has_more: false, next_cursor: null });
			}
			if (method === "PATCH" && path === "/blocks/home/children") {
				return answer({ results: Array.from({ length: 20 }, (_unused, index) => ({ id: `new-${String(index)}` })) });
			}
			return answer({ id: "ok" });
		},
		sleep: (): Promise<void> => Promise.resolve(),
		now: (): number => 0,
		random: (): number => 0,
	});
	return { writer: new NotionWriter(client), calls };
}

describe("applyHomeLayout", () => {
	const published = { docs: "docs-ds", blog: "blog-ds" };
	const read: string[] = [];
	const repository = {
		readBytes: (file: string): Promise<Uint8Array<ArrayBuffer>> => {
			read.push(file);
			return Promise.resolve(new Uint8Array([1, 2, 3]));
		},
	};
	const options = { replace: false, say: (): void => undefined, repository };

	it("lays out an empty page: the tree as Docs Published's own view, the icon and cover, the blocks, then each linked view after its block", async () => {
		const { writer, calls } = workspace();

		await expect(applyHomeLayout(writer, published, options)).resolves.toBe("home");

		const writes = calls.filter((call) => call.method !== "GET");
		expect(writes.map((call) => `${call.method} ${call.path}`)).toEqual([
			"POST /views",
			"POST /file_uploads",
			"POST /file_uploads/ok/send",
			"PATCH /pages/home",
			"PATCH /blocks/home/children",
			"POST /views",
			"POST /views",
			"POST /views",
		]);
		expect(writes.at(0)?.body).toContain('"database_id":"docs-db"');
		expect(writes.at(0)?.body).toContain('"subtasks":{"property_id":"parent-id","display_mode":"show"}');
		expect(read).toContain(HOME_COVER_FILE);
		expect(writes.at(1)?.body).toContain('"filename":"notion-home.webp","content_type":"image/webp"');
		expect(writes.at(3)?.body).toContain('"cover":{"type":"file_upload","file_upload":{"id":"ok"}}');
		expect(writes.at(4)?.body).toContain('"position":{"type":"start"}');
		expect(writes.at(4)?.body).toContain('"database_id":"drafts-db"');
		expect(writes.at(5)?.body).toContain('"position":{"type":"after_block","block_id":"new-4"}');
		expect(writes.at(7)?.body).toContain('"type":"gallery"');
	});

	it("clears the blank line a new page starts with, without asking for --replace", async () => {
		const { writer, calls } = workspace(["blank-1"]);

		await applyHomeLayout(writer, published, options);

		expect(calls.filter((call) => call.body === '{"in_trash":true}').map((call) => call.path)).toEqual(["/blocks/blank-1"]);
	});

	it("refuses to touch a page with blocks of its own, and writes nothing", async () => {
		const { writer, calls } = workspace(["note-1"]);

		await expect(applyHomeLayout(writer, published, options)).rejects.toThrow(HomePageNotEmptyError);
		expect(calls.filter((call) => call.method !== "GET")).toEqual([]);
	});

	it("counts an earlier layout's linked view as the page's own, so a second run needs --replace too", async () => {
		const { writer } = workspace([], true);

		await expect(applyHomeLayout(writer, published, options)).rejects.toThrow("1 block(s) besides its databases");
	});

	it("with --replace, trashes the old blocks and linked views but never the databases, and adds no second tree view", async () => {
		const { writer, calls } = workspace(["note-1"], true);

		await applyHomeLayout(writer, published, { ...options, replace: true });

		const trashed = calls.filter((call) => call.method === "PATCH" && call.body === '{"in_trash":true}').map((call) => call.path);
		expect(trashed).toEqual(["/blocks/note-1", "/blocks/linked-db"]);
		expect(calls.filter((call) => call.method === "POST" && call.body.includes('"database_id":"docs-db"'))).toEqual([]);
	});
});
