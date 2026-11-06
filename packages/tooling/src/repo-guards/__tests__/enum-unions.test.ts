import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { workingTreeFiles } from "../../shared/working-tree-files.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../../..");
const SOURCE_FILE = /\.tsx?$/u;
/** The mobile code must stay identical to expo-boilerplate; generated and test code is not a source of truth. */
const SKIPPED = /__tests__|apps\/mobile\/|packages\/ui-native\/|\.d\.ts$|generated/u;
const ENUM_DECLARATION = /const \w+(?:: [^=]+)? = z\s*\.?enum\(\[(?<values>[^\]]*)\]/gu;
const STRING_UNION = /^(?:export )?type (?<name>\w+) =\s*\n?\s*\|?\s*(?<values>"[^"\n]+"(?:\s*\n?\s*\|\s*"[^"\n]+")+);/gmu;
const STRING_LITERAL = /"(?<value>[^"]+)"/gu;

/** Unions that repeat an enum's words on purpose, each with why: the reason is the review. */
const NOT_THE_SAME_SET = new Map<string, string>([
	["apps/admin/components/component-gallery/examples/filters/filters-12.tsx#Locale", "Same words as another enum, a different meaning"],
	["apps/admin/contexts/kanban/components/kanban-board-columns.tsx#KanbanColumnStep", "Same words as another enum, a different meaning"],
	["apps/api/src/contexts/identity/application/services/pending-sign-in.ts#LoginVerificationMode", "The API env schema is config; identity must not import it"],
	["apps/api/src/platform/application/ports/rate-limiter.port.ts#RateLimitFailMode", "Same words as a kanban rollup, unrelated"],
	["packages/shared/src/contracts/define-contract.ts#RestMethod", "Same values as a gallery example, unrelated"],
	["packages/shared/src/schemas/api/list-query.ts#SortDirection", "The list-query type, unrelated to the geo enum that repeats its words"],
	["packages/tooling/src/api-ci-env/api-ci-env.ts#TenancyMode", "packages/tooling runs before an install, so it cannot import @workspace/shared"],
	["packages/ui/src/components/cascader/cascader-types.tsx#CascaderSize", "Same words as another enum, a different meaning"],
	["packages/ui/src/components/code-block-highlight.ts#CodeBlockFontStyle", "Same words as another enum, a different meaning"],
	["packages/ui/src/components/gantt/gantt-types.tsx#GanttRowAlign", "Same words as another enum, a different meaning"],
	["packages/ui/src/components/gantt/gantt.tsx#GanttBarLabel", "Same words as another enum, a different meaning"],
	["packages/ui/src/components/number-field.tsx#NumberFieldSize", "Same words as another enum, a different meaning"],
	["packages/ui/src/components/phone-input.tsx#PhoneInputSize", "Same words as another enum, a different meaning"],
	["packages/ui/src/components/tree.tsx#TreeFlagAttribute", "Same words as another enum, a different meaning"],
	["packages/ui/src/lib/emoji-picker/layout.ts#EmojiPickerSize", "Same words as another enum, a different meaning"],
	["packages/ui/src/lib/sidebar/menu-view.ts#PanelSectionColor", "Same words as another enum, a different meaning"],
]);

function valueSet(text: string): string {
	return [...text.matchAll(STRING_LITERAL)]
		.map((match) => match.groups?.value ?? "")
		.sort()
		.join("|");
}

function repeatedUnions(): string[] {
	const sources = workingTreeFiles(REPO_ROOT, ["apps", "packages", "infra"])
		.filter((file) => SOURCE_FILE.test(file) && !SKIPPED.test(file))
		.map((file) => ({ file, text: readFileSync(path.join(REPO_ROOT, file), "utf8") }));
	const enums = new Set(sources.flatMap(({ text }) => [...text.matchAll(ENUM_DECLARATION)].map((match) => valueSet(match.groups?.values ?? ""))));
	return sources.flatMap(({ file, text }) =>
		[...text.matchAll(STRING_UNION)].filter((match) => enums.has(valueSet(match.groups?.values ?? ""))).map((match) => `${file}#${match.groups?.name ?? ""}`),
	);
}

describe("one source per set of values", () => {
	const repeated = repeatedUnions();

	it("derives a union from its z.enum instead of repeating it", () => {
		expect(repeated.filter((union) => !NOT_THE_SAME_SET.has(union))).toStrictEqual([]);
	});

	it("keeps every stated exception still needed", () => {
		expect([...NOT_THE_SAME_SET.keys()].filter((union) => !repeated.includes(union))).toStrictEqual([]);
	});
});
