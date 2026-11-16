import { isStringPrimitive } from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { apiPage } from "../../__tests__/notion-fixtures.ts";
import { NotionClient } from "../../notion-client.ts";
import { clearImportTargets, EMPTY_IMPORT_STATE, importRepoDocs, linkedFile, type ImportRepository, type ImportState } from "../import-repo-docs.ts";
import { markdownToNotion } from "../markdown-to-notion.ts";
import { NotionWriter } from "../notion-writer.ts";

interface Call {
	readonly method: string;
	readonly url: string;
	readonly body: string;
}

const TREE_PROPERTIES = { Kind: { id: "kind-id", type: "select" }, Parent: { id: "parent-id", type: "relation" } };

function fakeNotion(): { readonly writer: NotionWriter; readonly calls: Call[] } {
	const calls: Call[] = [];
	let nextId = 0;
	const client = new NotionClient("token", {
		fetch: (url, init): Promise<Response> => {
			const body = init?.body;
			calls.push({ method: init?.method ?? "GET", url: String(url), body: isStringPrimitive(body) ? body : "form" });
			if (String(url).includes("/data_sources/")) {
				// A docs database that already has its folder tree.
				return Promise.resolve(new Response(JSON.stringify({ parent: { database_id: "db-1" }, properties: TREE_PROPERTIES })));
			}
			nextId += 1;
			const id = `00000000-0000-0000-0000-${String(nextId).padStart(12, "0")}`;
			return Promise.resolve(new Response(JSON.stringify({ id, results: [{ id: `${id}-a` }, { id: `${id}-b` }], data_sources: [{ id: `ds-${id}` }] })));
		},
		sleep: (): Promise<void> => Promise.resolve(),
		now: (): number => 0,
		random: (): number => 0,
	});
	return { writer: new NotionWriter(client), calls };
}

const PAGE_A = `---\ntitle: "Page A"\ndescription: "About A"\nauthor: "Ada"\ntags: ["x, y"]\ncoverImage: "https://a.example/c.png"\n---\n\n# Page A\n\nSee [B](b.md).\n`;
const PAGE_B = `---\ntitle: "Page B"\n---\n\n![Shot](images/shot.png)\n`;
const POST = `---\ntitle: "Post"\ndate: 1790000000000\ncategory: "News"\ncoverImage: "/images/local.png"\n---\n\nHello.\n`;

function repository(files: Readonly<Record<string, string>>): ImportRepository {
	return {
		listMarkdown: () => Promise.resolve(Object.keys(files).filter((file) => file.endsWith(".md"))),
		read: (file) => Promise.resolve(files[file] ?? ""),
		readBytes: () => Promise.resolve(new Uint8Array([1, 2, 3])),
	};
}

const FILES = {
	"docs/meta.json": JSON.stringify({ pages: ["--- Guides ---", "a", "b"] }),
	"docs/a.md": PAGE_A,
	"docs/b.md": PAGE_B,
	"docs/blog/post.md": POST,
	"docs/broken.md": "no front matter",
};
const TARGETS = { docs: "docs-ds", blog: "blog-ds" };

describe("importRepoDocs", () => {
	let saved: ImportState;
	const options = {
		only: [],
		saveState: (state: ImportState): Promise<void> => {
			saved = state;
			return Promise.resolve();
		},
		say: (): void => undefined,
	};

	beforeEach(() => {
		saved = { pages: {}, filled: [] };
	});

	it("creates every page, then fills each in, with links between them resolved", async () => {
		const { writer, calls } = fakeNotion();

		const outcome = await importRepoDocs(writer, repository(FILES), TARGETS, saved, options);

		expect(outcome).toMatchObject({ created: 3, filled: 3, skipped: ["docs/broken.md"] });
		const created = calls.filter((call) => call.url.endsWith("/pages"));
		expect(created.at(0)?.body).toContain('"data_source_id":"docs-ds"');
		expect(created.at(0)?.body).toContain('"name":"Published"');
		expect(created.at(0)?.body).toContain('"name":"Guides"');
		expect(created.at(0)?.body).toContain('"number":1');
		expect(created.at(0)?.body).toContain('"name":"x  y"');
		expect(created.at(2)?.body).toContain('"data_source_id":"blog-ds"');
		expect(calls.some((call) => call.body.includes("https://www.notion.so/000000000000000000000000000000"))).toBe(true);
	});

	it("uploads a repository image", async () => {
		const { writer, calls } = fakeNotion();

		await importRepoDocs(writer, repository(FILES), TARGETS, saved, options);

		expect(calls.some((call) => call.url.endsWith("/file_uploads") && call.body.includes("shot.png"))).toBe(true);
		expect(calls.some((call) => call.body === "form")).toBe(true);
		expect(calls.some((call) => call.body.includes('"file_upload"'))).toBe(true);
	});

	it("gives a page a web cover as it is, and uploads a repository cover", async () => {
		const { writer, calls } = fakeNotion();

		const outcome = await importRepoDocs(writer, repository(FILES), TARGETS, saved, options);

		const created = calls.filter((call) => call.url.endsWith("/pages"));
		expect(created.at(0)?.body).toContain('"cover":{"type":"external","external":{"url":"https://a.example/c.png"}}');
		expect(calls.some((call) => call.url.endsWith("/file_uploads") && call.body.includes('"filename":"local.png"'))).toBe(true);
		expect(created.at(2)?.body).toMatch(/"cover":\{"type":"file_upload","file_upload":\{"id":"[^"]+"\}\}/u);
		expect(outcome.reviews).toEqual([]);
	});

	it("reports a repository cover Notion does not take, and creates the page without it", async () => {
		const { writer, calls } = fakeNotion();
		const files = { ...FILES, "docs/blog/post.md": POST.replace("/images/local.png", "/images/local.svg") };

		const outcome = await importRepoDocs(writer, repository(files), TARGETS, saved, options);

		expect(outcome.reviews).toEqual([expect.stringContaining("the cover /images/local.svg is not an image Notion takes")]);
		expect(calls.filter((call) => call.url.endsWith("/pages")).at(2)?.body).not.toContain('"cover"');
	});

	it("resumes without creating or filling a page twice", async () => {
		const first = fakeNotion();
		await importRepoDocs(first.writer, repository(FILES), TARGETS, saved, options);
		const second = fakeNotion();

		const outcome = await importRepoDocs(second.writer, repository(FILES), TARGETS, saved, options);

		expect(outcome).toMatchObject({ created: 0, filled: 0 });
		expect(second.calls).toEqual([]);
	});

	it("builds the repository's folders as a tree, and gives each docs row only its own part of the address", async () => {
		const { writer, calls } = fakeNotion();
		const nested = { ...FILES, "docs/technical/api/rest.md": `---\ntitle: "REST"\n---\n\nHi.\n`, "docs/technical/intro.md": `---\ntitle: "Intro"\n---\n\nHi.\n` };

		const outcome = await importRepoDocs(writer, repository(nested), TARGETS, saved, options);

		const created = calls.filter((call) => call.url.endsWith("/pages")).map((call) => call.body);
		const [technical, api] = created;
		expect(technical).toContain('"Title":{"title":[{"type":"text","text":{"content":"technical"}}]}');
		expect(technical).toContain('"Kind":{"select":{"name":"Folder"}},"Parent":{"relation":[]}');
		expect(technical).not.toContain('"Status"');
		expect(api).toContain('"Slug":{"rich_text":[{"type":"text","text":{"content":"api"}}]}');
		expect(saved.pages["docs/technical/"]).toBeDefined();
		const technicalId = saved.pages["docs/technical/"] ?? "";
		const apiId = saved.pages["docs/technical/api/"] ?? "";
		expect(api).toContain(`"Parent":{"relation":[{"id":"${technicalId}"}]}`);
		const rest = created.find((body) => body.includes('"content":"REST"')) ?? "";
		expect(rest).toContain('"Slug":{"rich_text":[{"type":"text","text":{"content":"rest"}}]}');
		expect(rest).toContain(`"Kind":{"select":{"name":"Page"}},"Parent":{"relation":[{"id":"${apiId}"}]}`);
		const post = created.find((body) => body.includes('"blog-ds"')) ?? "";
		expect(post).toContain('"Slug":{"rich_text":[{"type":"text","text":{"content":"post"}}]}');
		expect(post).not.toContain('"Kind"');
		expect(outcome.created).toBe(7);
	});

	it("carries a page's category, publish date and last-updated date into Notion, and adds Last updated to both databases first", async () => {
		const { writer, calls } = fakeNotion();
		const dated = `---\ntitle: "Dated"\ncategory: "API"\ndate: 1790035200000\nlastUpdated: 1793145600000\neditedAt: 1793232000000\n---\n\nHi.\n`;

		await importRepoDocs(writer, repository({ "docs/meta.json": JSON.stringify({ pages: ["dated"] }), "docs/dated.md": dated }), TARGETS, saved, options);

		const created = calls.find((call) => call.url.endsWith("/pages"))?.body ?? "";
		expect(created).toContain('"Category":{"select":{"name":"API"}}');
		expect(created).toContain('"Date":{"date":{"start":"2026-09-22"}}');
		expect(created).toContain('"Last updated":{"date":{"start":"2026-10-28"}}');
		expect(created).not.toContain("editedAt");
		const patchedSources = calls.filter((call) => call.method === "PATCH" && call.url.includes("/data_sources/")).map((call) => call.url.split("/").at(-1));
		expect(patchedSources).toEqual(["docs-ds", "blog-ds"]);
	});

	it("imports only the pilot pages when asked", async () => {
		const { writer } = fakeNotion();

		const outcome = await importRepoDocs(writer, repository(FILES), TARGETS, saved, { ...options, only: ["a"] });

		expect(outcome.created).toBe(1);
	});
});

describe("clearImportTargets", () => {
	/** A workspace whose two Published databases hold `counts` pages each; records what is trashed. */
	function workspace(counts: Readonly<Record<string, number>>): { readonly writer: NotionWriter; readonly trashed: string[]; readonly queried: string[] } {
		const trashed: string[] = [];
		const queried: string[] = [];
		const client = new NotionClient("token", {
			fetch: (url, init): Promise<Response> => {
				const address = String(url);
				const query = /\/data_sources\/(?<id>[^/]+)\/query$/u.exec(address)?.groups?.id;
				if (query !== undefined) {
					queried.push(query);
					const results = Array.from({ length: counts[query] ?? 0 }, (_unused, index) => apiPage({ id: `${query}-page-${String(index)}` }));
					return Promise.resolve(new Response(JSON.stringify({ results, has_more: false, next_cursor: null })));
				}
				const body = init?.body;
				trashed.push(`${address.slice(address.lastIndexOf("/") + 1)} ${isStringPrimitive(body) ? body : ""}`);
				return Promise.resolve(new Response(JSON.stringify({ id: "trashed" })));
			},
			sleep: (): Promise<void> => Promise.resolve(),
			now: (): number => 0,
			random: (): number => 0,
		});
		return { writer: new NotionWriter(client), trashed, queried };
	}

	it("moves every page of both Published databases to the trash, and clears the saved progress", async () => {
		const { writer, trashed, queried } = workspace({ "docs-ds": 2, "blog-ds": 1 });
		const said: string[] = [];
		let saved: ImportState | null = null;

		const state = await clearImportTargets(writer, TARGETS, {
			saveState: (next) => {
				saved = next;
				return Promise.resolve();
			},
			say: (line) => said.push(line),
		});

		expect(queried).toEqual(["docs-ds", "blog-ds"]);
		expect(trashed).toEqual(['docs-ds-page-0 {"in_trash":true}', 'docs-ds-page-1 {"in_trash":true}', 'blog-ds-page-0 {"in_trash":true}']);
		expect(state).toEqual(EMPTY_IMPORT_STATE);
		expect(saved).toEqual(EMPTY_IMPORT_STATE);
		expect(said).toEqual(["Moved 2 docs pages to Notion's trash (restorable for 30 days)", "Moved 1 blog pages to Notion's trash (restorable for 30 days)"]);
	});
});

describe("NotionWriter.createDatabases", () => {
	it("creates the four databases of the plan and answers their data sources", async () => {
		const { writer, calls } = fakeNotion();

		const databases = await writer.createDatabases("parent-page");

		expect(calls.filter((call) => call.url.endsWith("/databases"))).toHaveLength(4);
		expect(calls.at(-1)?.url).toBe(`https://api.notion.com/v1/data_sources/${databases.docsPublished}`);
		expect(calls.at(0)?.body).toContain('"initial_data_source"');
		expect(calls.at(0)?.body).toContain('"Title":{"type":"title"');
		expect(databases.docsPublished).toContain("ds-");
	});
});

describe("NotionWriter.ensureDocsTree", () => {
	function database(properties: object): { readonly writer: NotionWriter; readonly patches: string[] } {
		const patches: string[] = [];
		const client = new NotionClient("token", {
			fetch: (_url, init): Promise<Response> => {
				const body = init?.body;
				if (init?.method === "PATCH" && isStringPrimitive(body)) {
					patches.push(body);
					return Promise.resolve(new Response(JSON.stringify({ parent: { database_id: "db-1" }, properties: TREE_PROPERTIES })));
				}
				return Promise.resolve(new Response(JSON.stringify({ parent: { database_id: "db-1" }, properties })));
			},
			sleep: (): Promise<void> => Promise.resolve(),
			now: (): number => 0,
			random: (): number => 0,
		});
		return { writer: new NotionWriter(client), patches };
	}

	it("adds Kind and a Parent relation to the same database, with Sub-items as its partner, and answers Parent's id", async () => {
		const { writer, patches } = database({ Title: { id: "title", type: "title" } });

		await expect(writer.ensureDocsTree("ds-1")).resolves.toBe("parent-id");

		expect(patches).toEqual([
			JSON.stringify({
				properties: {
					Kind: { type: "select", select: { options: [{ name: "Page" }, { name: "Folder" }] } },
					Parent: { type: "relation", relation: { data_source_id: "ds-1", type: "dual_property", dual_property: { synced_property_name: "Sub-items" } } },
				},
			}),
		]);
	});

	it("changes nothing when the tree is already there", async () => {
		const { writer, patches } = database(TREE_PROPERTIES);

		await expect(writer.ensureDocsTree("ds-1")).resolves.toBe("parent-id");
		expect(patches).toEqual([]);
	});

	it("refuses a Parent property that is not a relation, rather than guess", async () => {
		const { writer } = database({ Kind: { id: "kind-id", type: "select" }, Parent: { id: "p", type: "rich_text" } });

		await expect(writer.ensureDocsTree("ds-1")).rejects.toThrow("is not a relation");
	});
});

describe("NotionWriter.append", () => {
	it("sends a long table with its first 100 rows, then adds the rest to it in batches (Notion takes 100 per request)", async () => {
		const { writer, calls } = fakeNotion();
		const rows = Array.from({ length: 249 }, (_unused, index) => `| ${String(index)} |`).join("\n");
		const { blocks } = markdownToNotion(`| Header |\n| --- |\n${rows}`, { linkTarget: () => null });

		await writer.append("page-1", blocks);

		const [created, ...added] = calls.map((call): { readonly url: string; readonly rows: number } => ({
			url: call.url,
			rows: (call.body.match(/"type":"table_row"/gu) ?? []).length,
		}));
		expect(created).toEqual({ url: "https://api.notion.com/v1/blocks/page-1/children", rows: 100 });
		expect(added.map((call) => call.rows)).toEqual([100, 50]);
		expect(added.every((call) => call.url.endsWith("-a/children"))).toBe(true);
	});
});

describe("linkedFile", () => {
	it.each([
		["docs/a/b.md", "c.md", "docs/a/c.md"],
		["docs/a/b.md", "../c.md#section", "docs/c.md"],
		["docs/a/b.md", "/docs/x/y", "docs/x/y.md"],
		["docs/a/b.md", "/blog/post", "docs/blog/post.md"],
	])("from %s, %s is %s", (from, url, file) => {
		expect(linkedFile(from, url)).toBe(file);
	});

	it("answers null for what is not a page", () => {
		expect(linkedFile("docs/a.md", "#anchor")).toBeNull();
		expect(linkedFile("docs/a.md", "/images/x.png")).toBeNull();
	});
});
