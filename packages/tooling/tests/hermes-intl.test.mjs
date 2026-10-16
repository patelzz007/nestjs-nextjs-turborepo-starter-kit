import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { workingTreeFiles } from "../scripts/lib/working-tree-files.mjs";

import { HERMES_SOURCE_ROOTS, hermesMissingIntlUses } from "../scripts/lib/hermes-intl.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

describe("hermesMissingIntlUses", () => {
	it("flags an Intl API Hermes lacks, and accepts the ones it has", () => {
		expect(hermesMissingIntlUses('const f = new Intl.RelativeTimeFormat("en");')).toStrictEqual(["Intl.RelativeTimeFormat"]);
		expect(hermesMissingIntlUses("new Intl.PluralRules(locale).select(1); new Intl.ListFormat(locale);")).toStrictEqual(["Intl.PluralRules", "Intl.ListFormat"]);
		expect(hermesMissingIntlUses('new Intl.DateTimeFormat("en"); new Intl.NumberFormat("en"); const o: Intl.DateTimeFormatOptions = {};')).toStrictEqual([]);
	});

	it("ignores a comment that names one", () => {
		expect(hermesMissingIntlUses("// NOT `Intl.RelativeTimeFormat`: Hermes lacks it\nconst x = 1;")).toStrictEqual([]);
	});
});

describe("code that runs on Hermes", () => {
	it("uses no Intl API that Hermes lacks (tests run on Node and are skipped)", () => {
		const files = workingTreeFiles(REPO_ROOT, HERMES_SOURCE_ROOTS).filter((file) => /\.(?:ts|tsx)$/u.test(file) && !file.split("/").includes("__tests__"));
		const uses = files.flatMap((file) => hermesMissingIntlUses(readFileSync(path.join(REPO_ROOT, file), "utf8")).map((use) => `${file}: ${use}`));
		expect(uses).toStrictEqual([]);
	});
});
