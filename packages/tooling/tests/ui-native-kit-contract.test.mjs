import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { kitContractProblems, stripComments } from "../scripts/lib/ui-native-kit-contract.mjs";

const COMPONENTS_DIR = path.resolve(import.meta.dirname, "../../ui-native/src/components");

const COMPLIANT = `
import { cva } from "class-variance-authority";
export const buttonVariants = cva("flex-row", { variants: {} });
export const Button = React.memo(React.forwardRef<View, ButtonProps>(function Button() { return null; }));
`;

describe("kitContractProblems", () => {
	it("accepts a memoised, ref-forwarding, CVA-styled, tested component", () => {
		expect(kitContractProblems("button", COMPLIANT, true)).toStrictEqual([]);
	});

	it("flags a missing ref, memo, CVA and test", () => {
		const source = "export function Badge(): React.JSX.Element { return null; }";
		expect(kitContractProblems("badge", source, false)).toStrictEqual([
			"no React.forwardRef: every component forwards its ref",
			"Badge is a plain function: export React.memo(React.forwardRef(…))",
			"no cva(): style through a CVA variant function",
			"no test: add __tests__/badge.test.tsx",
		]);
	});

	it("flags hardcoded values, but not when a comment only names them", () => {
		const withValues = `${COMPLIANT}\nconst a = "w-[13px]"; const b = "#ffffff"; <View style={{ flex: 1 }} />; const c = "font-semibold";`;
		// The style literal is also an inline object in a JSX prop: five problems from four lines.
		expect(kitContractProblems("button", withValues, true)).toHaveLength(5);
		const inComments = `${COMPLIANT}\n// never "w-[13px]" or "font-semibold"\n/* no "#fff" */`;
		expect(kitContractProblems("button", inComments, true)).toStrictEqual([]);
	});

	it("flags an object or array literal created inline in a JSX prop", () => {
		expect(kitContractProblems("button", `${COMPLIANT}\n<Pressable accessibilityState={{ disabled: true }} />`, true)).toStrictEqual([
			"an object or array literal in a JSX prop: hoist it to a constant or useMemo",
		]);
		expect(kitContractProblems("button", `${COMPLIANT}\n<View hitSlop={[4]} />`, true)).toHaveLength(1);
		expect(kitContractProblems("button", `${COMPLIANT}\n<Pressable accessibilityState={accessibilityState} />`, true)).toStrictEqual([]);
	});

	it("lets a listed composite skip CVA only while it composes its kit component", () => {
		const composite = 'import { Input } from "./input";\nexport const TextField = React.memo(React.forwardRef(function TextField() { return null; }));';
		expect(kitContractProblems("text-field", composite, true)).toStrictEqual([]);
		expect(kitContractProblems("text-field", composite.replace('"./input"', '"./other"'), true)).toStrictEqual(["a composite without cva() must compose ./input"]);
	});

	it("keeps URLs and strings with // intact when stripping comments", () => {
		expect(stripComments('const url = "https://example.com"; // note')).toBe('const url = "https://example.com"; ');
	});
});

describe("packages/ui-native components", () => {
	const files = readdirSync(COMPONENTS_DIR).filter((file) => file.endsWith(".tsx"));

	it("has components to check", () => {
		expect(files.length).toBeGreaterThan(0);
	});

	it.each(files)("%s meets the kit contract", (file) => {
		const name = file.replace(/\.tsx$/u, "");
		const source = readFileSync(path.join(COMPONENTS_DIR, file), "utf8");
		const hasTest = existsSync(path.join(COMPONENTS_DIR, "__tests__", `${name}.test.tsx`));
		expect(kitContractProblems(name, source, hasTest)).toStrictEqual([]);
	});
});
