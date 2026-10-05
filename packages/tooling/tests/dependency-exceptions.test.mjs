/**
 * Push-time check of the time-boxed dependency decisions in pnpm-workspace.yaml
 * (accepted advisories, supply-chain cooldown exceptions): every entry must be
 * well-formed — a written reason and a valid date. Deliberately independent of
 * today's date, so CI never turns red because a calendar day passed; the weekly
 * `dependency-review` workflow (scripts/check-dependency-exceptions.mjs) reports
 * entries whose date is due.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseDependencyExceptions, structuralProblems } from "../scripts/lib/dependency-exceptions.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

describe("pnpm-workspace.yaml dependency exceptions", () => {
	const exceptions = parseDependencyExceptions(readFileSync(path.join(REPO_ROOT, "pnpm-workspace.yaml"), "utf8"));

	it("every accepted advisory and cooldown exception has a written reason and a valid date", () => {
		expect(structuralProblems(exceptions)).toEqual([]);
	});
});
