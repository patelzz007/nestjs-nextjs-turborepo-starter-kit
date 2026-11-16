import { describe, expect, it } from "vitest";

import { contentTypeOf, staticCandidates } from "../../../scripts/static-path";

const ROOT = "/srv/docs/client";

describe("staticCandidates", () => {
	it("finds the home page", () => {
		expect(staticCandidates(ROOT, "/")).toEqual(["/srv/docs/client/index.html"]);
	});

	it("tries the file, then the pre-rendered page", () => {
		expect(staticCandidates(ROOT, "/docs/setup")).toEqual(["/srv/docs/client/docs/setup", "/srv/docs/client/docs/setup.html"]);
	});

	it.each(["/../secret", "/%2e%2e/secret", "/docs/../../secret", "/a%00b", "/%E0%A4%A"])("refuses %s", (pathname) => {
		expect(staticCandidates(ROOT, pathname)).toEqual([]);
	});
});

describe("contentTypeOf", () => {
	it("knows the site's files, and falls back safely", () => {
		expect(contentTypeOf("a.html")).toContain("text/html");
		expect(contentTypeOf("a.PNG")).toBe("image/png");
		expect(contentTypeOf("a.unknown")).toBe("application/octet-stream");
	});
});
