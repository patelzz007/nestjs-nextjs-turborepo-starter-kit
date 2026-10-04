import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { WEB_DEMO_ACCOUNTS } from "./demo-account-list";
import { loadWebDemoAccounts } from "./demo-accounts";

const { serverEnvMock } = vi.hoisted(() => ({
	serverEnvMock: { NODE_ENV: "development", COOKIE_DOMAIN: undefined },
}));

vi.mock("@/lib/env/env.server", () => ({ serverEnv: serverEnvMock }));

const APP_ROOT: string = fileURLToPath(new URL("../..", import.meta.url));
const SKIPPED_DIRECTORIES: readonly string[] = ["node_modules", ".next", ".turbo", ".vitest", "coverage", "e2e"];
const SOURCE_FILE = /\.(ts|tsx)$/;
const TEST_FILE = /\.test\.(ts|tsx)$/;
const LIST_MODULE = "lib/auth/demo-account-list.ts";
const LOADER_MODULE = "lib/auth/demo-accounts.ts";

/** Every non-test source file of the app, as a path relative to the app root. */
function listSourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry): string[] => {
		const path: string = join(directory, entry.name);
		if (entry.isDirectory()) {
			return SKIPPED_DIRECTORIES.includes(entry.name) ? [] : listSourceFiles(path);
		}
		return SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name) ? [relative(APP_ROOT, path).split(sep).join("/")] : [];
	});
}

function readSource(path: string): string {
	return readFileSync(join(APP_ROOT, path), "utf8");
}

afterEach((): void => {
	serverEnvMock.NODE_ENV = "development";
});

describe("loadWebDemoAccounts", () => {
	it("returns the seeded demo accounts in development", async () => {
		expect(await loadWebDemoAccounts()).toEqual(WEB_DEMO_ACCOUNTS);
	});

	it.each(["production", "test"])("returns no accounts in %s", async (nodeEnv: string) => {
		serverEnvMock.NODE_ENV = nodeEnv;

		expect(await loadWebDemoAccounts()).toEqual([]);
	});
});

describe("demo account list is kept out of client and production bundles", () => {
	const sources: string[] = listSourceFiles(APP_ROOT);

	it("is server-only", () => {
		expect(readSource(LIST_MODULE)).toContain('import "server-only";');
		expect(readSource(LOADER_MODULE)).toContain('import "server-only";');
	});

	it("is imported by the loader alone, and only dynamically", () => {
		const importers: string[] = sources.filter((path) => path !== LIST_MODULE && readSource(path).includes("demo-account-list"));

		expect(importers).toEqual([LOADER_MODULE]);
		expect(readSource(LOADER_MODULE)).toMatch(/await import\("\.\/demo-account-list"\)/);
		expect(readSource(LOADER_MODULE)).not.toMatch(/^import .*demo-account-list/m);
	});

	it("is never reachable from a Client Component", () => {
		const clientModules: string[] = sources.filter((path) => /^["']use client["'];?/m.test(readSource(path).slice(0, 400)));
		const leaking: string[] = clientModules.filter((path) => /from "[^"]*demo-account/.test(readSource(path)));

		expect(leaking).toEqual([]);
	});

	it("is loaded by the login page, a Server Component", () => {
		const page: string = readSource("app/auth/login/page.tsx");

		expect(page).toContain("loadWebDemoAccounts");
		expect(page).not.toMatch(/^["']use client["']/);
	});
});
