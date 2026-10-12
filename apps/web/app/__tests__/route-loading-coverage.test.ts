import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { listAppPageFiles } from "@/test-support/app-routes";

const LOADING_FILE = "loading.tsx";

/** `app/`, without a trailing separator — the shape `dirname` returns. */
const APP_DIR: string = resolve(fileURLToPath(new URL("..", import.meta.url)));

/**
 * Routes that deliberately have no `loading.tsx`: client pages with static
 * content (their own Suspense fallbacks are shaped skeletons) and the legacy
 * verify-email path, which only redirects.
 */
const ROUTES_WITHOUT_LOADING: readonly string[] = ["auth/forgot-password", "auth/reset-password", "auth/signup", "auth/verify-email", "auth/verify-email/[token]"];

/** Whether `directory` or a folder above it (up to `app/`) has a `loading.tsx` — the boundary Next.js would show. */
function hasLoadingBoundary(directory: string): boolean {
	if (existsSync(join(directory, LOADING_FILE))) {
		return true;
	}
	return directory !== APP_DIR && directory.startsWith(APP_DIR) && hasLoadingBoundary(dirname(directory));
}

describe("route loading coverage", () => {
	it("gives every page that waits on the server a loading boundary", () => {
		const uncovered = listAppPageFiles()
			.filter((page) => !ROUTES_WITHOUT_LOADING.includes(page.segments.join("/")))
			.filter((page) => !hasLoadingBoundary(dirname(page.file)))
			.map((page) => `/${page.segments.join("/")}`);

		expect(uncovered).toEqual([]);
	});

	it("keeps every route on the list above free of a loading boundary, so the list stays true", () => {
		const covered = listAppPageFiles()
			.filter((page) => ROUTES_WITHOUT_LOADING.includes(page.segments.join("/")))
			.filter((page) => hasLoadingBoundary(dirname(page.file)))
			.map((page) => `/${page.segments.join("/")}`);

		expect(covered).toEqual([]);
	});

	it("keeps the landing skeleton out of every other route — no loading boundary at the app root", () => {
		expect(existsSync(join(APP_DIR, LOADING_FILE))).toBe(false);
	});
});
