import { ESLint, Linter } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

import { config as baseConfig } from "../base.js";
import { nestjsConfig } from "../nestjs.js";
import { nextJsConfig } from "../next.js";
import { config as reactInternalConfig } from "../react-internal.js";
import { withErrorSeverity } from "../rule-severity.js";

/** ESLint numeric severity for "warn" (0 = off, 1 = warn, 2 = error). */
const WARN_SEVERITY = 1;

const EXPORTED_CONFIGS = [
	["base", baseConfig],
	["next-js", nextJsConfig],
	["react-internal", reactInternalConfig],
	["nestjs", nestjsConfig],
];

/**
 * Every rule that a config block sets to "warn" (string or numeric form,
 * bare or as the first entry of an options array).
 */
function findWarnRules(configArray) {
	const warnRules = [];
	for (const block of configArray) {
		for (const [ruleName, ruleEntry] of Object.entries(block.rules ?? {})) {
			const severity = Array.isArray(ruleEntry) ? ruleEntry[0] : ruleEntry;
			if (severity === "warn" || severity === WARN_SEVERITY) {
				warnRules.push(ruleName);
			}
		}
	}
	return warnRules;
}

describe("shared ESLint configs: every rule is an error, never a warning (rules/00)", () => {
	it.each(EXPORTED_CONFIGS)("%s sets no rule (own or inherited from a plugin preset) to warn", (_name, configArray) => {
		expect(findWarnRules(configArray)).toEqual([]);
	});

	it("detects a warn rule in both string and numeric form (guards the check itself)", () => {
		expect(findWarnRules([{ rules: { a: "warn", b: ["warn", {}], c: WARN_SEVERITY, d: "error", e: "off" } }])).toEqual(["a", "b", "c"]);
	});
});

describe("withErrorSeverity", () => {
	it("promotes warn entries to error, keeps options, and leaves error/off untouched", () => {
		expect(withErrorSeverity({ a: "warn", b: ["warn", { strict: true }], c: WARN_SEVERITY, d: "error", e: "off", f: 0 })).toEqual({
			a: "error",
			b: ["error", { strict: true }],
			c: "error",
			d: "error",
			e: "off",
			f: 0,
		});
	});
});

/** The rule entry ESLint resolves for a `.tsx` file under `configArray`. */
async function resolvedRule(configArray, ruleName) {
	const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: configArray });
	const resolved = await eslint.calculateConfigForFile("component.tsx");
	return resolved.rules[ruleName];
}

describe("React configs keep every rule of the presets they spread", () => {
	it.each([
		["next-js", nextJsConfig],
		["react-internal", reactInternalConfig],
	])("%s enables react recommended, jsx-a11y recommended and react-hooks rules as errors", async (_name, configArray) => {
		// One rule from each preset that the configs do not set themselves: a block
		// that spreads a preset and then sets its own `rules` object silently drops them.
		await expect(resolvedRule(configArray, "react/no-unescaped-entities")).resolves.toEqual([2]);
		await expect(resolvedRule(configArray, "jsx-a11y/anchor-is-valid")).resolves.toEqual([2]);
		await expect(resolvedRule(configArray, "react-hooks/exhaustive-deps")).resolves.toEqual([2]);
		// jsx-runtime still turns the legacy scope rule off.
		await expect(resolvedRule(configArray, "react/react-in-jsx-scope")).resolves.toEqual([0]);
	});
});

/**
 * Lints `code` with ONLY the base config's `no-restricted-syntax` block (the
 * type-keyword and cast bans) on the TypeScript parser — no type information
 * needed, so the selectors are tested in isolation.
 */
function restrictedSyntaxMessages(code) {
	const restrictedSyntaxBlock = baseConfig.find((block) => block.rules?.["no-restricted-syntax"] !== undefined);
	const linter = new Linter({ configType: "flat" });
	return linter
		.verify(
			code,
			[
				{
					files: ["**/*.ts"],
					languageOptions: { parser: tseslint.parser },
					rules: { "no-restricted-syntax": restrictedSyntaxBlock.rules["no-restricted-syntax"] },
				},
			],
			"fixture.ts",
		)
		.map((message) => message.message);
}

describe("base config: `unknown` type keyword ban", () => {
	it.each([
		["a parameter", "export function parse(input: unknown): void {}"],
		["a variable annotation", "export const value: unknown = 1;"],
		["a generic argument", "export type Bag = Record<string, unknown>;"],
		["a return type", "export function load(): unknown { return 1; }"],
		["a non-error parameter of a .catch() callback", "promise.catch((error: Error, extra: unknown): void => {});"],
		["a .then() callback parameter", "promise.then((value: unknown): void => {});"],
	])("flags `unknown` in %s", (_position, code) => {
		expect(restrictedSyntaxMessages(code)).toEqual([expect.stringContaining("`unknown` type is banned")]);
	});

	it.each([
		["a catch-clause parameter", "try { run(); } catch (error: unknown) { report(error); }"],
		["the error parameter of a .catch() arrow callback", "promise.catch((error: unknown): void => { report(error); });"],
		["the error parameter of a .catch() function callback", "promise.catch(function onError(error: unknown): void { report(error); });"],
	])("allows `unknown` as %s", (_position, code) => {
		expect(restrictedSyntaxMessages(code)).toEqual([]);
	});
});

describe("base config: `never` type keyword ban", () => {
	it.each([
		["a parameter of an ordinary function", "export function fail(value: never): void {}"],
		["a Record value keyed by a plain type parameter", "export type NoExtra<K extends string> = Record<K, never>;"],
		["a variable annotation", "const exhaustive: never = value;"],
		["an arrow function return type", "export const stop = (): never => { throw new Error('x'); };"],
	])("flags `never` in %s", (_position, code) => {
		expect(restrictedSyntaxMessages(code)).toEqual([expect.stringContaining("`never` type is banned")]);
	});

	it("flags `never` as the first argument of a Record or as a Record value without an Exclude key set", () => {
		expect(restrictedSyntaxMessages("export type A = Record<never, string>;")).toEqual([expect.stringContaining("`never` type is banned")]);
		expect(restrictedSyntaxMessages("export type B<K extends string> = Record<Extract<K, 'a'>, never>;")).toEqual([expect.stringContaining("`never` type is banned")]);
	});

	it("allows the Record<Exclude<…>, never> key-exhaustiveness guard", () => {
		expect(restrictedSyntaxMessages("export type OnlyKnown<M, S> = M & Record<Exclude<keyof M, keyof S>, never>;")).toEqual([]);
	});

	it("allows the parameter and return type of an assertNever exhaustiveness helper", () => {
		expect(restrictedSyntaxMessages("function assertNeverStatus(value: never): never { throw new Error(String(value)); }")).toEqual([]);
	});
});

describe("base config: cast and zod escape-hatch bans still apply", () => {
	it.each([
		["`as const`", "export const sizes = ['sm', 'md'] as const;", "`as const` is banned"],
		["z.unknown()", "export const schema = z.unknown();", "`z.any()` / `z.unknown()` / `z.never()` are banned"],
	])("flags %s", (_construct, code, expected) => {
		expect(restrictedSyntaxMessages(code)).toEqual([expect.stringContaining(expected)]);
	});
});

describe("base config: query-cache keys and unchecked z.custom", () => {
	it.each([
		["a literal invalidation key", 'queryClient.invalidateQueries({ queryKey: ["merchant", "kyb"] });'],
		["a literal removeQueries key", 'queryClient.removeQueries({ queryKey: ["a"], exact: true });'],
		["a literal setQueryData key", 'queryClient.setQueryData(["auth", "me"], data);'],
		["a literal getQueryData key", 'queryClient.getQueryData(["auth", "me"]);'],
	])("flags %s", (_what, code) => {
		expect(restrictedSyntaxMessages(code)).toEqual([expect.stringContaining("hand-type a query key")]);
	});

	it.each([
		["a registry scope key", "queryClient.invalidateQueries({ queryKey: apiRouter.auth.me.scopeKey(undefined) });"],
		["invalidating everything is a different rule (no key at all)", "queryClient.clear();"],
	])("allows %s", (_what, code) => {
		expect(restrictedSyntaxMessages(code)).toEqual([]);
	});

	it("flags an argumentless z.custom<T>() and allows one with a predicate", () => {
		expect(restrictedSyntaxMessages("export const schema = z.custom<Thing>();")).toEqual([expect.stringContaining("without a predicate")]);
		expect(restrictedSyntaxMessages("export const schema = z.custom<Thing>((value): value is Thing => value !== null);")).toEqual([]);
	});
});

describe("nestjs: every route declares its response", () => {
	const RULE = "@darraghor/nestjs-typed/api-method-should-specify-api-response";
	/** The rule exactly as the shared NestJS config sets it (options included). */
	const ruleEntry = nestjsConfig.findLast((block) => block.rules?.[RULE] !== undefined)?.rules?.[RULE];
	const plugins = nestjsConfig.find((block) => block.plugins?.["@darraghor/nestjs-typed"] !== undefined)?.plugins;

	function lintController(decorator) {
		const linter = new Linter({ configType: "flat" });
		const source = `
import { Controller, Get } from "@nestjs/common";
@Controller("reports")
export class ReportsController {
	${decorator}
	@Get("export")
	public async exportReport(): Promise<void> {}
}
`;
		return linter.verify(
			source,
			[
				{
					files: ["**/*.ts"],
					languageOptions: { parser: tseslint.parser, parserOptions: { ecmaVersion: "latest", sourceType: "module" } },
					plugins,
					rules: { [RULE]: ruleEntry },
				},
			],
			"reports.controller.ts",
		);
	}

	it.each(["@ZodResponse(ReportSchema)", "@ZodPaginatedResponse(ReportSchema)", "@ZodRawResponse(ReportSchema)", "@ZodFileResponse(contract.response)"])(
		"accepts a route documented by %s",
		(decorator) => {
			expect(lintController(decorator).filter((message) => message.ruleId === RULE)).toEqual([]);
		},
	);

	it("still fails a route with no response decorator", () => {
		expect(lintController("").map((message) => message.ruleId)).toContain(RULE);
	});
});

describe("base config: runtime type checks belong to zod (rules/28)", () => {
	it.each([
		["a typeof comparison on a variable", 'if (typeof value === "string") run();'],
		["a typeof comparison on a member expression", 'if (typeof item.checked !== "boolean") run();'],
		["a typeof on the right-hand side", 'if ("number" === typeof count) run();'],
		["a typeof switch", "switch (typeof value) { default: break; }"],
		["a stored typeof result", "const kind = typeof value;"],
		["an environment probe", 'const isServer = typeof window === "undefined";'],
	])("flags %s", (_what, code) => {
		expect(restrictedSyntaxMessages(code)).toEqual([expect.stringContaining("runtime `typeof` operator is banned")]);
	});

	it("allows type-position typeof (z.infer, ReturnType)", () => {
		expect(restrictedSyntaxMessages("export type Order = z.infer<typeof OrderSchema>;")).toEqual([]);
		expect(restrictedSyntaxMessages("let spy: MockInstance<typeof console.error>;")).toEqual([]);
	});

	it("flags Array.isArray and Object.prototype.toString tag sniffing", () => {
		expect(restrictedSyntaxMessages("if (Array.isArray(value)) run();")).toEqual([expect.stringContaining("`Array.isArray` is banned")]);
		expect(restrictedSyntaxMessages("const tag = Object.prototype.toString.call(value);")).toEqual([expect.stringContaining("tag sniffing")]);
	});
});

describe("base config: numeric-literal index access (rules/27)", () => {
	it.each([
		["a plain index", "const first = items[0];"],
		["an optional index", "const second = items?.[1];"],
		["an index on a call result", 'const head = text.split(",")[0];'],
		["an index assignment", "row[0] = 1;"],
	])("flags %s", (_what, code) => {
		expect(restrictedSyntaxMessages(code)).toEqual([expect.stringContaining("Numeric-literal index access")]);
	});

	it.each([
		["a named slot", "const first = items[LIST_SLOT_INDEX.first];"],
		["destructuring", "const [first] = items;"],
		["a loop variable", "const item = items[index];"],
		["a string key", 'const value = record["0"];'],
		["a named capture group", "const year = match.groups?.year;"],
	])("allows %s", (_what, code) => {
		expect(restrictedSyntaxMessages(code)).toEqual([]);
	});
});
