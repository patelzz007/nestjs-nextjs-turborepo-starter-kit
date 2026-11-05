// Enhancement 3.6: CI runs the unit tests in shards, one runner each (.github/workflows/ci.yml → unit-test's
// matrix). A shard names its workspaces with turbo `--filter`s, so a workspace missing from every shard would
// silently never be tested in CI, and one in two shards would run twice. This reads the workspaces from disk:
// a new workspace with a `test` script fails here until it is given a shard.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { z } from "zod";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");
const WORKFLOW = parse(readFileSync(path.join(REPO_ROOT, ".github/workflows/ci.yml"), "utf8"));

const ManifestSchema = z.object({ name: z.string(), scripts: z.record(z.string(), z.string()).optional() });
const ShardsSchema = z.array(z.object({ shard: z.string().min(1), filters: z.string().min(1) }).strict()).min(1);

/** Every workspace (apps/*, packages/*) whose package.json has a `test` script. */
function testedWorkspaces() {
	return ["apps", "packages"].flatMap((folder) =>
		readdirSync(path.join(REPO_ROOT, folder), { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => path.join(REPO_ROOT, folder, entry.name, "package.json"))
			.filter((manifestPath) => existsSync(manifestPath))
			.map((manifestPath) => ManifestSchema.parse(JSON.parse(readFileSync(manifestPath, "utf8"))))
			.filter((manifest) => manifest.scripts?.test !== undefined)
			.map((manifest) => manifest.name),
	);
}

const shards = ShardsSchema.parse(WORKFLOW.jobs["unit-test"].strategy.matrix.include);
const FILTER_PATTERN = /^--filter=(?<name>@workspace\/[a-z0-9-]+)$/u;

/** Each shard's workspaces, from its `--filter=` list (anything else in it is refused). */
const shardWorkspaces = shards.map(({ shard, filters }) => ({
	shard,
	workspaces: filters.split(" ").map((filter) => {
		const name = FILTER_PATTERN.exec(filter)?.groups?.name;
		if (name === undefined) {
			throw new Error(`Shard ${shard}: "${filter}" is not a --filter=@workspace/<name>`);
		}
		return name;
	}),
}));

describe("CI unit-test shards", () => {
	it("give every workspace with a test script exactly one shard", () => {
		const assigned = shardWorkspaces.flatMap(({ workspaces }) => workspaces);
		expect([...assigned].sort()).toStrictEqual([...testedWorkspaces()].sort());
	});

	it("have unique names", () => {
		const names = shards.map(({ shard }) => shard);
		expect(new Set(names).size).toBe(names.length);
	});

	it("include the docs shard the documentation-only rule keeps running", () => {
		expect(shardWorkspaces.find(({ shard }) => shard === "docs")?.workspaces).toContain("@workspace/docs");
		expect(JSON.stringify(WORKFLOW.jobs["unit-test"].steps)).toContain("matrix.shard == 'docs'");
	});

	it("run each shard one workspace at a time, as the whole suite runs locally", () => {
		const run = WORKFLOW.jobs["unit-test"].steps.find((step) => step.name === "Unit tests")?.run;
		expect(run).toBe("pnpm turbo run test --concurrency=1 ${{ matrix.filters }}");
	});
});
