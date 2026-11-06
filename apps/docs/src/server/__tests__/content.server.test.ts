import { existsSync, readFileSync } from "node:fs";

import { isNotFound } from "@tanstack/react-router";
import { OpenApiDocumentSchema, listEndpoints } from "@workspace/docs-renderer/api-reference/openapi";
import { describe, expect, it } from "vitest";

import { contentStore, endpointIndex, imageDataUrl, relativeTo } from "../content.server";
import { assertFound } from "../functions";

/**
 * The server content module against the real repository: the same globs the site builds from. (The pages
 * themselves are rendered by the pre-render build and checked against the Astro baseline.)
 */
describe("relativeTo", () => {
	it("should re-key glob paths below their folder and drop paths outside it", () => {
		expect(relativeTo("/docs/", { "../../../../docs/technical/db.md": "a", "../../../../apps/x.md": "b" })).toEqual({ "technical/db.md": "a" });
	});
});

describe("contentStore", () => {
	it("should build every guide and post from the repository, once per process", async () => {
		const store = await contentStore();
		expect(await contentStore()).toBe(store);
		const guide = await store.guide("technical/authorization/overview");
		expect(guide?.title).toBe("Authorization: start here");
		expect(guide?.toc.some((item) => item.slug === "the-words-in-one-line-each")).toBe(true);
		// list-queries opens with a `> [!NOTE]` callout: it renders as the shared Alert.
		expect((await store.guide("technical/api/list-queries"))?.html).toContain('data-slot="alert"');
		expect(store.posts().length).toBeGreaterThan(0);
		expect(store.pagePaths()).toContain("/docs/README");
	});
});

describe("unpublished folders", () => {
	it("should never build a page from docs/history, the security audit included", async () => {
		const store = await contentStore();
		expect(existsSync(new URL("../../../../../docs/history/SECURITY-AUDIT-2026-10-25.md", import.meta.url))).toBe(true);
		expect(store.pagePaths().filter((page) => page.startsWith("/docs/history"))).toEqual([]);
		expect(await store.guide("history/SECURITY-AUDIT-2026-10-25")).toBeNull();
	});

	it("should serve posts from docs/blog at /blog only", async () => {
		const store = await contentStore();
		expect(store.pagePaths().filter((page) => page.startsWith("/docs/blog"))).toEqual([]);
		expect(store.pagePaths()).toContain("/blog/changelog");
	});
});

describe("images and endpoints", () => {
	it("should serve a docs image as a data URL and know when there is none", () => {
		expect(imageDataUrl("readme/web-login.webp")).toMatch(/^data:image\/webp/);
		expect(imageDataUrl("no/such.png")).toBeNull();
	});

	it("should index every operation of the OpenAPI export, once per process", () => {
		const document = OpenApiDocumentSchema.parse(JSON.parse(readFileSync(new URL("../../../../../docs/generated/openapi.json", import.meta.url), "utf8")));
		expect(endpointIndex()).toHaveLength(listEndpoints(document).length);
		expect(endpointIndex()).toBe(endpointIndex());
	});
});

describe("assertFound", () => {
	it("should pass a page through and answer a missing one with the router's 404 signal", () => {
		expect(() => {
			assertFound("page");
		}).not.toThrow();
		try {
			assertFound(null);
			expect.unreachable("a missing page must throw");
		} catch (error: unknown) {
			expect(isNotFound(error)).toBe(true);
		}
	});
});
