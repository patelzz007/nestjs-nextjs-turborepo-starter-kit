import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { workingTreeFiles } from "../../../shared/working-tree-files.ts";

import { MOBILE_TYPE_SOURCE_ROOTS, offScaleTextSizes } from "../mobile-type-scale.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../../..");

describe("offScaleTextSizes", () => {
	it("flags Tailwind's own sizes and the web's chrome sizes, and accepts the mobile type roles", () => {
		expect(offScaleTextSizes('className="font-sans text-sm text-foreground"')).toStrictEqual(["text-sm"]);
		expect(offScaleTextSizes("cva(\"text-lg\", { size: { md: `text-2xl ${x}`, sm: 'active:text-xs' } })")).toStrictEqual(["text-lg", "text-2xl", "text-xs"]);
		expect(offScaleTextSizes('className="text-badge-sm"')).toStrictEqual(["text-badge-sm"]);
		expect(offScaleTextSizes('className="text-h1 text-body text-body-lg text-caption text-overline text-nav text-button text-label"')).toStrictEqual([]);
	});

	it("never mistakes a colour or another class for a size", () => {
		expect(offScaleTextSizes('className="text-foreground text-muted-foreground text-tab-bar-icon text-xs-wide"')).toStrictEqual([]);
	});

	it("ignores a comment that names one", () => {
		expect(offScaleTextSizes("// was `text-sm` before the type scale\nconst x = 1;")).toStrictEqual([]);
	});
});

describe("the phone's source", () => {
	it("sets its text in the mobile type scale only (tests are skipped: they may name any class)", () => {
		const files = workingTreeFiles(REPO_ROOT, MOBILE_TYPE_SOURCE_ROOTS).filter((file) => /\.(?:ts|tsx)$/u.test(file) && !file.split("/").includes("__tests__"));
		const uses = files.flatMap((file) => offScaleTextSizes(readFileSync(path.join(REPO_ROOT, file), "utf8")).map((use) => `${file}: ${use}`));
		expect(uses).toStrictEqual([]);
	});
});
