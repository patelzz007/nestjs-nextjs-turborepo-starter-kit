import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const APP_ROOT: string = fileURLToPath(new URL("../..", import.meta.url));
const SOURCE_DIRECTORIES: readonly string[] = ["app", "components", "features", "lib"];
const SOURCE_FILE = /\.tsx?$/u;
const TEST_FILE = /\.test\.tsx?$/u;
const SLUG_COOKIE_WRITE = "writeOrganizationSlugCookie(";
/** Where the writer is declared, not called. */
const SLUG_COOKIE_MODULE = join("lib", "org", "slug.ts");
const THE_ONE_WRITER = join("components", "org", "org-tenant-bootstrap.tsx");

function collectSourceFiles(directory: string): readonly string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry): readonly string[] => {
		const entryPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			return collectSourceFiles(entryPath);
		}
		return SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name) ? [relative(APP_ROOT, entryPath)] : [];
	});
}

describe("organizationSlug cookie", () => {
	it("is written in exactly one place — the org layout's OrgTenantBootstrap (the URL owns the active organization)", () => {
		const writers = SOURCE_DIRECTORIES.flatMap((directory) => collectSourceFiles(join(APP_ROOT, directory))).filter(
			(file) => file !== SLUG_COOKIE_MODULE && readFileSync(join(APP_ROOT, file), "utf8").includes(SLUG_COOKIE_WRITE),
		);

		expect(writers).toEqual([THE_ONE_WRITER]);
	});
});
