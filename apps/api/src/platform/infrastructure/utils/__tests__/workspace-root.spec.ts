import { describe, expect, it } from "vitest";

import { findWorkspaceRoot, resolveFromWorkspaceRoot, WORKSPACE_MARKER } from "../workspace-root";

/** A file system holding only `files`. */
function only(...files: string[]): (path: string) => boolean {
	const present = new Set<string>(files);
	return (path: string): boolean => present.has(path);
}

const REPO_FILES = only(`/home/dev/repo/${WORKSPACE_MARKER}`);

describe("findWorkspaceRoot", () => {
	it("finds the nearest folder holding the workspace marker, from any folder below it", () => {
		expect(findWorkspaceRoot("/home/dev/repo/apps/api", REPO_FILES)).toBe("/home/dev/repo");
		expect(findWorkspaceRoot("/home/dev/repo", REPO_FILES)).toBe("/home/dev/repo");
	});

	it("answers null outside a monorepo", () => {
		expect(findWorkspaceRoot("/srv/app", only())).toBeNull();
	});
});

describe("resolveFromWorkspaceRoot", () => {
	it("takes a relative path from the monorepo root, whatever the working directory", () => {
		expect(resolveFromWorkspaceRoot("logs/transactions", "/home/dev/repo/apps/api", REPO_FILES)).toBe("/home/dev/repo/logs/transactions");
		expect(resolveFromWorkspaceRoot("logs/transactions", "/home/dev/repo", REPO_FILES)).toBe("/home/dev/repo/logs/transactions");
	});

	it("keeps an absolute path as it is", () => {
		expect(resolveFromWorkspaceRoot("/var/log/api", "/home/dev/repo/apps/api", REPO_FILES)).toBe("/var/log/api");
	});

	it("falls back to the working directory without a monorepo around it (a deployed bundle)", () => {
		expect(resolveFromWorkspaceRoot("logs/transactions", "/srv/app", only())).toBe("/srv/app/logs/transactions");
	});
});
