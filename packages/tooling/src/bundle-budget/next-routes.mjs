/**
 * Maps every App Router page of a `next build` (Turbopack, Next 16.3) to the
 * client JavaScript its first load needs (plan §19.6, decision #64).
 *
 * What the build writes into `<app>/.next/` and what this reads:
 *
 * - `build-manifest.json` → `rootMainFiles`: the runtime chunks every App
 *   Router page loads (framework, Turbopack runtime). `polyfillFiles` are
 *   `nomodule` scripts modern browsers skip, so they are not counted.
 * - `app-path-routes-manifest.json`: app path (`/(landing)/page`) → URL
 *   route (`/`). Route groups and `route.js` handlers live here too.
 * - `server/app-paths-manifest.json`: app path → its server entry
 *   (`app/dashboard/page.js`). The page's client reference manifest is
 *   written next to it as `page_client-reference-manifest.js`.
 * - `page_client-reference-manifest.js` assigns
 *   `globalThis.__RSC_MANIFEST["<app path>"] = {…}`; its `entryJSFiles` lists,
 *   per segment of the route (root layout, nested layouts, loading, error,
 *   not-found, the page), the chunks that segment's client components need.
 *
 * A route's first-load JS is the unique union of `rootMainFiles` and every
 * `entryJSFiles` list of its manifest. Paths are relative to `.next/`.
 */
import path from "node:path";

import { z } from "zod";

const BuildManifestSchema = z.object({ rootMainFiles: z.array(z.string().min(1)) });
const PathMapSchema = z.record(z.string(), z.string());
const ClientReferenceManifestSchema = z.object({ entryJSFiles: z.record(z.string(), z.array(z.string().min(1))) });

/** The suffix of an App Router page's app path (route handlers end in `/route`). */
const PAGE_SUFFIX = "/page";
/** The file Next writes beside each page's server entry. */
const CLIENT_MANIFEST_SUFFIX = "_client-reference-manifest.js";
/** `globalThis.__RSC_MANIFEST["<app path>"] = <json>;` — one line of the manifest module. */
const MANIFEST_ASSIGNMENT = /^globalThis\.__RSC_MANIFEST\[(?<key>"(?:[^"\\]|\\.)*")\]\s*=\s*(?<json>\{.*\});?\s*$/;

/**
 * The `entryJSFiles` of one `page_client-reference-manifest.js`, checked to
 * belong to `appPath`. Parsed as data (never evaluated).
 *
 * @param {string} source
 * @param {string} appPath
 * @returns {Record<string, string[]>}
 */
export function parseClientReferenceManifest(source, appPath) {
	for (const line of source.split("\n")) {
		const groups = MANIFEST_ASSIGNMENT.exec(line.trim())?.groups;
		if (groups?.key === undefined || groups.json === undefined) {
			continue;
		}
		const key = z.string().parse(JSON.parse(groups.key));
		if (key !== appPath) {
			throw new Error(`client reference manifest is for ${key}, expected ${appPath}`);
		}
		return ClientReferenceManifestSchema.parse(JSON.parse(groups.json)).entryJSFiles;
	}
	throw new Error(`no __RSC_MANIFEST assignment found for ${appPath}`);
}

/**
 * @typedef {{ readText: (file: string) => Promise<string> }} BuildReader
 */

/**
 * Every page route of the build → its unique first-load JS chunks (paths
 * relative to `buildDir`), sorted by route.
 *
 * @param {string} buildDir the app's `.next` directory
 * @param {BuildReader} reader
 * @returns {Promise<Map<string, string[]>>}
 */
export async function readNextRouteChunks(buildDir, { readText }) {
	const readJson = async (/** @type {string} */ relative) => JSON.parse(await readText(path.join(buildDir, relative)));
	const { rootMainFiles } = BuildManifestSchema.parse(await readJson("build-manifest.json"));
	const routes = PathMapSchema.parse(await readJson("app-path-routes-manifest.json"));
	const serverEntries = PathMapSchema.parse(await readJson(path.join("server", "app-paths-manifest.json")));

	const pages = Object.keys(serverEntries)
		.filter((appPath) => appPath.endsWith(PAGE_SUFFIX))
		.sort();
	if (pages.length === 0) {
		throw new Error(`${buildDir} lists no App Router pages — is this a \`next build\` output?`);
	}

	/** @type {Map<string, string[]>} */
	const chunksByRoute = new Map();
	for (const appPath of pages) {
		const route = routes[appPath];
		const serverEntry = serverEntries[appPath];
		if (route === undefined || serverEntry === undefined) {
			throw new Error(`${appPath} has no URL route in app-path-routes-manifest.json`);
		}
		const manifestFile = path.join(buildDir, "server", serverEntry.replace(/\.js$/, CLIENT_MANIFEST_SUFFIX));
		const entryJSFiles = parseClientReferenceManifest(await readText(manifestFile), appPath);
		const chunks = new Set([...rootMainFiles, ...Object.values(entryJSFiles).flat()]);
		chunksByRoute.set(route, [...chunks].sort());
	}
	return new Map([...chunksByRoute].sort(([left], [right]) => left.localeCompare(right)));
}
