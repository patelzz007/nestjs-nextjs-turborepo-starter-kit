import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { MAX_ATTEMPTS, MIN_REQUEST_INTERVAL_MS, NotionClient, NotionRequestError, type NotionClientEnvironment } from "../notion-client.ts";
import { apiPage, block } from "./notion-fixtures.ts";

type Responder = (url: string, init: RequestInit | undefined) => Response;

function json(body: object, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), { status, headers });
}

function setup(respond: Responder): { readonly client: NotionClient; readonly sleeps: number[]; readonly calls: string[]; readonly environment: NotionClientEnvironment } {
	const sleeps: number[] = [];
	const calls: string[] = [];
	let clock = 0;
	const environment: NotionClientEnvironment = {
		fetch: (input, init) => {
			calls.push(String(input));
			return Promise.resolve(respond(String(input), init));
		},
		sleep: (ms) => {
			sleeps.push(ms);
			clock += ms;
			return Promise.resolve();
		},
		now: () => clock,
		random: () => 0,
	};
	return { client: new NotionClient("token-value", environment), sleeps, calls, environment };
}

const PING = { method: "GET", path: "/ping" } satisfies Parameters<NotionClient["request"]>[0];
const OkSchema = z.object({ ok: z.boolean() });

describe("NotionClient.request", () => {
	it("sends the token and the API version, and validates the answer", async () => {
		const fetch = vi.fn<Responder>(() => json({ ok: true }));
		const { client } = setup(fetch);

		await expect(client.request(PING, OkSchema)).resolves.toEqual({ ok: true });

		expect(fetch.mock.calls.at(0)?.at(1)).toMatchObject({ headers: { Authorization: "Bearer token-value", "Notion-Version": "2026-03-11" } });
	});

	it("refuses an answer of the wrong shape", async () => {
		const { client } = setup(() => json({ ok: "yes" }));

		await expect(client.request(PING, OkSchema)).rejects.toBeInstanceOf(z.ZodError);
	});

	it("waits as long as Notion's Retry-After says", async () => {
		const answers = [json({ code: "rate_limited", message: "slow" }, 429, { "retry-after": "7" }), json({ ok: true })];
		const { client, sleeps } = setup(() => answers.shift() ?? json({}));

		await client.request(PING, OkSchema);

		expect(sleeps).toContain(7000);
	});

	it("backs off exponentially without a Retry-After, and retries an overload (529)", async () => {
		const answers = [json({}, 529), json({}, 503), json({ ok: true })];
		const { client, sleeps } = setup(() => answers.shift() ?? json({}));

		await client.request(PING, OkSchema);

		expect(sleeps.filter((ms) => ms !== MIN_REQUEST_INTERVAL_MS)).toEqual([500, 1000]);
	});

	it("gives up after the last attempt", async () => {
		const { client, calls } = setup(() => json({ code: "service_overload", message: "busy" }, 529));

		await expect(client.request(PING, OkSchema)).rejects.toBeInstanceOf(NotionRequestError);
		expect(calls).toHaveLength(MAX_ATTEMPTS);
	});

	it("does not retry a request Notion refused, and never prints the token", async () => {
		const { client, calls } = setup(() => json({ code: "unauthorized", message: "API token is invalid." }, 401));

		const failure = client.request(PING, OkSchema);

		await expect(failure).rejects.toThrow("Notion answered 401: unauthorized: API token is invalid.");
		await expect(failure).rejects.not.toThrow("token-value");
		expect(calls).toHaveLength(1);
	});

	it("copes with an error that has no JSON body", async () => {
		const { client } = setup(() => new Response("<html>", { status: 400 }));

		await expect(client.request(PING, OkSchema)).rejects.toThrow("no error details");
	});

	it("keeps requests apart, to stay inside the rate limit", async () => {
		const { client, sleeps } = setup(() => json({ ok: true }));

		await client.request(PING, OkSchema);
		await client.request(PING, OkSchema);

		expect(sleeps.at(-1)).toBeGreaterThan(0);
		expect(sleeps.at(-1)).toBeLessThanOrEqual(MIN_REQUEST_INTERVAL_MS);
	});
});

describe("NotionClient.queryAll", () => {
	it("follows pagination", async () => {
		const answers = [json({ results: [apiPage()], has_more: true, next_cursor: "next" }), json({ results: [apiPage({ id: "second" })], has_more: false, next_cursor: null })];
		const bodies: (RequestInit["body"] | undefined)[] = [];
		const { client } = setup((_url, init) => {
			bodies.push(init?.body);
			return answers.shift() ?? json({});
		});

		const pages = await client.queryAll("ds-1", { property: "Status" });

		expect(pages.map((page) => page.id)).toHaveLength(2);
		expect(bodies.at(1)).toContain('"start_cursor":"next"');
	});

	it("sends no filter when asked for every page", async () => {
		const bodies: (RequestInit["body"] | undefined)[] = [];
		const { client } = setup((_url, init) => {
			bodies.push(init?.body);
			return json({ results: [apiPage()], has_more: false, next_cursor: null });
		});

		await client.queryAll("ds-1", null);

		expect(bodies.at(0)).not.toContain('"filter"');
	});

	it("ignores a data source returned among the pages", async () => {
		const { client } = setup(() => json({ results: [{ object: "data_source" }, apiPage()], has_more: false, next_cursor: null }));

		await expect(client.queryAll("ds-1", {})).resolves.toHaveLength(1);
	});

	it("refuses a list Notion cut short, which would unpublish pages", async () => {
		const { client } = setup(() => json({ results: [apiPage()], has_more: false, next_cursor: null, request_status: { type: "incomplete" } }));

		await expect(client.queryAll("ds-1", {})).rejects.toThrow("cut short");
	});
});

describe("NotionClient.blockTree", () => {
	it("fetches children recursively, paginating at every level", async () => {
		const { client, calls } = setup((url) => {
			if (url.includes("/blocks/page/children") && !url.includes("start_cursor")) {
				return json({ results: [block("toggle", { has_children: true }, "t1")], has_more: true, next_cursor: "c2" });
			}
			if (url.includes("/blocks/page/children")) {
				return json({ results: [block("paragraph", {}, "p2")], has_more: false, next_cursor: null });
			}
			return json({ results: [block("paragraph", {}, "nested")], has_more: false, next_cursor: null });
		});

		const trees = await client.blockTree("page");

		expect(trees.map((item) => item.block.id)).toEqual(["t1", "p2"]);
		expect(trees.at(0)?.children.at(0)?.block.id).toBe("nested");
		expect(calls).toHaveLength(3);
	});

	it("does not read inside a child page", async () => {
		const { client, calls } = setup(() => json({ results: [block("child_page", { has_children: true })], has_more: false, next_cursor: null }));

		await client.blockTree("page");

		expect(calls).toHaveLength(1);
	});

	it("stops at a tree too deep to be a document", async () => {
		const { client } = setup(() => json({ results: [block("toggle", { has_children: true })], has_more: false, next_cursor: null }));

		await expect(client.blockTree("page")).rejects.toThrow("nest deeper");
	});
});
