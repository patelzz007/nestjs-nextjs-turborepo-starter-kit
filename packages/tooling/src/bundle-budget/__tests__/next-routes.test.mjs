import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseClientReferenceManifest, readNextRouteChunks } from "../next-routes.mjs";

/**
 * Trimmed copies of a real `next build` (Next 16.3.8, Turbopack) of apps/web:
 * the three routing manifests, and two page client reference manifests with
 * `clientModules` emptied (only `entryJSFiles` is read). The client reference
 * manifests are stored as JSON data (`*.fixture.json`) because the formatter
 * would rewrite a `.js` fixture into a shape Next never emits; `renderModule`
 * turns them back into the exact module text `next build` writes.
 */
const BUILD_DIR = path.join(import.meta.dirname, "fixtures", "next-app", "next-build");
const CLIENT_MANIFEST_MODULE = /page_client-reference-manifest\.js$/;

/**
 * The module text Next 16.3 writes for a page's client reference manifest
 * (copied from `.next/server/app/dashboard/page_client-reference-manifest.js`).
 */
function renderModule(appPath, manifest) {
	return `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\nglobalThis.__RSC_MANIFEST[${JSON.stringify(appPath)}] = ${JSON.stringify(manifest)};\n\n`;
}

const readText = async (file) => {
	if (CLIENT_MANIFEST_MODULE.test(file)) {
		const { appPath, manifest } = JSON.parse(await readFile(file.replace(CLIENT_MANIFEST_MODULE, "page_client-reference-manifest.fixture.json"), "utf8"));
		return renderModule(appPath, manifest);
	}
	return readFile(file, "utf8");
};

/** The runtime chunks `build-manifest.json` → `rootMainFiles` lists for every page. */
const ROOT_MAIN_FILES = [
	"static/chunks/10dpz2dw9d6ep.js",
	"static/chunks/25gdr7fnlll34.js",
	"static/chunks/2xuyfjatw610a.js",
	"static/chunks/2x3v43piy_d60.js",
	"static/chunks/turbopack-0fyn0a4eew7pg.js",
];

describe("readNextRouteChunks", () => {
	it("maps each page route (route groups resolved, route handlers skipped) to its chunks", async () => {
		const routes = await readNextRouteChunks(BUILD_DIR, { readText });
		expect([...routes.keys()]).toEqual(["/", "/dashboard"]);
	});

	it("unions rootMainFiles with every segment's entryJSFiles, without duplicates", async () => {
		const routes = await readNextRouteChunks(BUILD_DIR, { readText });
		const dashboard = routes.get("/dashboard") ?? [];
		const source = await readText(path.join(BUILD_DIR, "server", "app", "dashboard", "page_client-reference-manifest.js"));
		const segments = Object.values(parseClientReferenceManifest(source, "/dashboard/page"));
		const expected = [...new Set([...ROOT_MAIN_FILES, ...segments.flat()])].sort();
		expect(dashboard).toEqual(expected);
		expect(new Set(dashboard).size).toBe(dashboard.length);
		expect(dashboard).toEqual(expect.arrayContaining(ROOT_MAIN_FILES));
	});

	it("counts a nested layout's chunks only on the routes under it", async () => {
		const routes = await readNextRouteChunks(BUILD_DIR, { readText });
		// static/chunks/2_ooprfpex5tf.js is first listed by the dashboard layout segment.
		expect(routes.get("/dashboard")).toContain("static/chunks/2_ooprfpex5tf.js");
		expect(routes.get("/")).not.toContain("static/chunks/2_ooprfpex5tf.js");
	});

	it("does not count the nomodule polyfill files", async () => {
		const routes = await readNextRouteChunks(BUILD_DIR, { readText });
		for (const chunks of routes.values()) {
			expect(chunks).not.toContain("static/chunks/0cz1d0mv5g_q7.js");
		}
	});

	it("fails when a page has no client reference manifest", async () => {
		const missing = async (file) => {
			if (file.endsWith(path.join("dashboard", "page_client-reference-manifest.js"))) {
				throw new Error(`ENOENT: ${file}`);
			}
			return readText(file);
		};
		await expect(readNextRouteChunks(BUILD_DIR, { readText: missing })).rejects.toThrow(/ENOENT/);
	});

	it("fails when a page has no URL route", async () => {
		const withoutRoutes = async (file) => (file.endsWith("app-path-routes-manifest.json") ? "{}" : readText(file));
		await expect(readNextRouteChunks(BUILD_DIR, { readText: withoutRoutes })).rejects.toThrow(/has no URL route/);
	});

	it("fails on a build that lists no pages", async () => {
		const noPages = async (file) => (file.endsWith("app-paths-manifest.json") ? '{ "/favicon.ico/route": "app/favicon.ico/route.js" }' : readText(file));
		await expect(readNextRouteChunks(BUILD_DIR, { readText: noPages })).rejects.toThrow(/lists no App Router pages/);
	});
});

describe("parseClientReferenceManifest", () => {
	const manifest = renderModule;

	it("reads entryJSFiles of the matching app path", () => {
		const entryJSFiles = { "[project]/apps/web/app/layout": ["static/chunks/a.js"] };
		expect(parseClientReferenceManifest(manifest("/(landing)/page", { entryJSFiles }), "/(landing)/page")).toEqual(entryJSFiles);
	});

	it("rejects a manifest written for another page", () => {
		expect(() => parseClientReferenceManifest(manifest("/hello/page", { entryJSFiles: {} }), "/dashboard/page")).toThrow(/is for \/hello\/page, expected \/dashboard\/page/);
	});

	it("rejects a module without the manifest assignment", () => {
		expect(() => parseClientReferenceManifest("export default {};\n", "/dashboard/page")).toThrow(/no __RSC_MANIFEST assignment/);
	});

	it("rejects a manifest whose entryJSFiles has the wrong shape", () => {
		expect(() => parseClientReferenceManifest(manifest("/hello/page", { entryJSFiles: { layout: "a.js" } }), "/hello/page")).toThrow();
	});
});
