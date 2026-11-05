import { describe, expect, it } from "vitest";

import { changedFilesArgs, changedFilesOf, codeChanged, isDocumentation, outputLines, parseChangesArgs } from "../ci-changes.mjs";

describe("ci changes", () => {
	it("counts the docs site's folders and Markdown anywhere as documentation", () => {
		expect(isDocumentation("docs/technical/operations/ci.md")).toBe(true);
		expect(isDocumentation("docs/images/readme/mobile-home.webp")).toBe(true);
		expect(isDocumentation("blog/2026-11-05-release.mdx")).toBe(true);
		expect(isDocumentation("apps/mobile/README.md")).toBe(true);
		expect(isDocumentation("rules/04-mobile-expo.md")).toBe(true);
	});

	it("counts everything else as code, the docs site's own code included", () => {
		expect(isDocumentation("apps/docs/src/routes/index.tsx")).toBe(false);
		expect(isDocumentation("apps/api/src/main.ts")).toBe(false);
		expect(isDocumentation(".github/workflows/ci.yml")).toBe(false);
		expect(isDocumentation("package.json")).toBe(false);
		expect(isDocumentation("docsite/config.ts")).toBe(false);
		expect(isDocumentation("README.mdx.ts")).toBe(false);
		// The OpenAPI document the API's e2e suite checks against the code, and the docs build's API samples.
		expect(isDocumentation("docs/generated/openapi.json")).toBe(false);
		expect(isDocumentation("docs/generated/api-samples.json")).toBe(false);
	});

	it("skips the code jobs only for a pull request that changes documentation alone", () => {
		expect(codeChanged("pull_request", ["docs/a.md", "README.md"])).toBe(false);
		expect(codeChanged("pull_request", ["docs/a.md", "apps/api/src/main.ts"])).toBe(true);
	});

	it("runs everything on a push, a manual run, or a pull request whose changes could not be listed", () => {
		expect(codeChanged("push", ["docs/a.md"])).toBe(true);
		expect(codeChanged("workflow_dispatch", ["docs/a.md"])).toBe(true);
		expect(codeChanged("pull_request", [])).toBe(true);
	});

	it("lists a pull request's files against the merge base, renames as a delete and an add", () => {
		expect(changedFilesArgs("origin/main")).toEqual(["diff", "--name-only", "--no-renames", "origin/main...HEAD"]);
		expect(changedFilesOf("docs/a.md\n\napps/api/x.ts\n")).toEqual(["docs/a.md", "apps/api/x.ts"]);
	});

	it("writes the job's output", () => {
		expect(outputLines(false)).toBe("code=false\n");
	});

	it("takes CI's inputs as arguments, with origin/main as the default base", () => {
		expect(parseChangesArgs(["--event", "pull_request", "--base", "origin/develop", "--output", "/tmp/out"])).toStrictEqual({
			eventName: "pull_request",
			baseRef: "origin/develop",
			outputFile: "/tmp/out",
		});
		expect(parseChangesArgs(["--event", "push"])).toStrictEqual({ eventName: "push", baseRef: "origin/main", outputFile: undefined });
		expect(parseChangesArgs(["--event", "push", "--output", ""]).outputFile).toBeUndefined();
	});

	it("refuses an argument it does not know", () => {
		expect(() => parseChangesArgs(["--evnt", "push"])).toThrow();
	});
});
