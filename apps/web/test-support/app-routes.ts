import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** The App Router directory of this app. */
const APP_DIR: string = fileURLToPath(new URL("../app", import.meta.url));

const PAGE_FILE = "page.tsx";

/** A dynamic `[id]` segment matches any single value (the app has no catch-all routes). */
const DYNAMIC_SEGMENT_PATTERN = /^\[.+\]$/;

/** `(group)` folders organise files without adding a URL segment. */
const ROUTE_GROUP_PATTERN = /^\(.+\)$/;

/** Folders that never produce a URL: private (`_x`) and parallel-route slots (`@x`). */
const NON_ROUTE_FOLDER_PATTERN = /^[_@]/;

function collectPageRoutes(directory: string, segments: readonly string[], routes: string[][]): void {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (entry.isFile() && entry.name === PAGE_FILE) {
			routes.push([...segments]);
			continue;
		}
		if (!entry.isDirectory() || NON_ROUTE_FOLDER_PATTERN.test(entry.name)) {
			continue;
		}
		const nextSegments: readonly string[] = ROUTE_GROUP_PATTERN.test(entry.name) ? segments : [...segments, entry.name];
		collectPageRoutes(join(directory, entry.name), nextSegments, routes);
	}
}

/** Every page route under `app/`, as URL segments (`[]` is `/`). Read from disk, so it can never go stale. */
export function listAppPageRoutes(): readonly (readonly string[])[] {
	const routes: string[][] = [];
	collectPageRoutes(APP_DIR, [], routes);
	return routes;
}

/** One `app/**\/page.tsx`: its URL segments and its absolute file path. */
export interface AppPageFile {
	readonly segments: readonly string[];
	readonly file: string;
}

function collectPageFiles(directory: string, segments: readonly string[], pages: AppPageFile[]): void {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (entry.isFile() && entry.name === PAGE_FILE) {
			pages.push({ segments: [...segments], file: join(directory, entry.name) });
			continue;
		}
		if (!entry.isDirectory() || NON_ROUTE_FOLDER_PATTERN.test(entry.name)) {
			continue;
		}
		collectPageFiles(join(directory, entry.name), ROUTE_GROUP_PATTERN.test(entry.name) ? segments : [...segments, entry.name], pages);
	}
}

/** Every page file under `app/` with its route. Read from disk, so it can never go stale. */
export function listAppPageFiles(): readonly AppPageFile[] {
	const pages: AppPageFile[] = [];
	collectPageFiles(APP_DIR, [], pages);
	return pages;
}

/** The pathname of an internal href — query string and fragment removed. */
export function pathnameOf(href: string): string {
	return href.split(/[?#]/)[0] ?? href;
}

function segmentsOf(pathname: string): readonly string[] {
	return pathname.split("/").filter((segment) => segment.length > 0);
}

function routeMatches(route: readonly string[], pathSegments: readonly string[]): boolean {
	if (route.length !== pathSegments.length) {
		return false;
	}
	return route.every((segment, index) => DYNAMIC_SEGMENT_PATTERN.test(segment) || segment === pathSegments[index]);
}

/** Whether an internal href resolves to an existing `app/**\/page.tsx`. */
export function resolvesToAppPage(href: string, routes: readonly (readonly string[])[]): boolean {
	const pathSegments = segmentsOf(pathnameOf(href));
	return routes.some((route) => routeMatches(route, pathSegments));
}
