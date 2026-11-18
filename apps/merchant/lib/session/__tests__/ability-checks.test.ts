import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { MERCHANT_CAPABILITY_PERMISSION } from "@workspace/shared";
import { describe, expect, it } from "vitest";

/**
 * The merchant app's ability holds only the pairs a merchant capability maps to (MERCHANT_CAPABILITY_PERMISSION).
 * A check on any other pair — `ability.can("READ", "ROLE")` — is false for every member, owners included, so the UI
 * it gates silently disappears. This scans the app's own code for every check and names the ones no capability grants.
 */

const APP_ROOT: string = fileURLToPath(new URL("../../..", import.meta.url));
const SKIPPED_FOLDERS: ReadonlySet<string> = new Set(["node_modules", ".next", "__tests__", "testing", "coverage"]);
const SOURCE_FILE = /\.tsx?$/u;
const ABILITY_CHECK = /can\("(?<action>[A-Z_]+)", "(?<resource>[A-Z_]+)"\)|I="(?<canAction>[A-Z_]+)" an?="(?<canResource>[A-Z_]+)"/gu;

function sourceFiles(directory: string): readonly string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry): readonly string[] => {
		if (entry.isDirectory()) {
			return SKIPPED_FOLDERS.has(entry.name) ? [] : sourceFiles(join(directory, entry.name));
		}
		return SOURCE_FILE.test(entry.name) ? [join(directory, entry.name)] : [];
	});
}

const GRANTABLE: ReadonlySet<string> = new Set(Object.values(MERCHANT_CAPABILITY_PERMISSION).map((pair) => `${pair.action} ${pair.resource}`));

describe("the merchant app's ability checks", () => {
	it("finds the checks it scans for", () => {
		const checks = sourceFiles(APP_ROOT).flatMap((file) => [...readFileSync(file, "utf8").matchAll(ABILITY_CHECK)]);
		expect(checks.length).toBeGreaterThan(0);
	});

	it("only ask for what a merchant capability grants", () => {
		const ungrantable = sourceFiles(APP_ROOT).flatMap((file) =>
			[...readFileSync(file, "utf8").matchAll(ABILITY_CHECK)]
				.map((match) => `${match.groups?.action ?? match.groups?.canAction ?? ""} ${match.groups?.resource ?? match.groups?.canResource ?? ""}`)
				.filter((check) => !GRANTABLE.has(check))
				.map((check) => `${file.slice(APP_ROOT.length)}: ${check}`),
		);
		expect(ungrantable).toStrictEqual([]);
	});
});
