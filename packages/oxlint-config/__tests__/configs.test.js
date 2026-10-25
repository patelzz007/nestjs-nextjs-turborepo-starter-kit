import { describe, expect, it } from "vitest";

import { config as baseConfig } from "../base.js";
import { apiClientBoundaryConfigs, backendImportBoundaryConfig, mobileImportBoundaryConfig } from "../import-boundaries.js";
import { NESTJS_PLUGIN, REACT_NATIVE_PLUGIN } from "../js-plugins.js";
import { nestjsConfig } from "../nestjs.js";
import { nextJsConfig } from "../next.js";
import { approvedRuleExceptions, config as reactInternalConfig } from "../react-internal.js";
import { config as reactNativeConfig, REACT_NATIVE_ACCESSIBILITY_SELECTORS, REACT_NATIVE_GLOBALS } from "../react-native.js";
import { restrictedSyntaxRules } from "../restricted-syntax-rules.js";
import { nestjsRules } from "../rules/nestjs.js";
import { reactNativeRules } from "../rules/react-native.js";
import { isolatedConfig, lintAsIf } from "../testing.js";

const EXPORTED_CONFIGS = [
	["base", baseConfig],
	["next-js", nextJsConfig],
	["react-internal", reactInternalConfig],
	["nestjs", nestjsConfig],
	["react-native", reactNativeConfig],
];

const OXLINT_WARN_SEVERITIES = new Set(["warn", 1]);

/** Every rule entry a config sets — top level and in every override — as [ruleName, entry]. */
function ruleEntries(config) {
	return [config.rules ?? {}, ...(config.overrides ?? []).map((override) => override.rules ?? {})].flatMap((rules) => Object.entries(rules));
}

/** Every rule a config sets to "warn" (string or numeric form, bare or as the first entry of an options array). */
function findWarnRules(config) {
	return ruleEntries(config)
		.filter(([, entry]) => OXLINT_WARN_SEVERITIES.has([entry].flat().at(0)))
		.map(([ruleName]) => ruleName);
}

/** What oxlint reports for `code` linted as `filePath` under `config` (in a temp directory). */
function reports(config, code, filePath) {
	return lintAsIf(config, { [filePath]: code })[filePath] ?? [];
}

/** The rule ids oxlint reports for `code` linted as `filePath` under `config`. */
function ruleIds(config, code, filePath) {
	return reports(config, code, filePath).map((report) => report.ruleId);
}

/** "ruleId: message" lines, for asserting both at once. */
function lines(config, code, filePath) {
	return reports(config, code, filePath).map((report) => `${report.ruleId}: ${report.message}`);
}

describe("shared oxlint configs: every rule is an error, never a warning (rules/00)", () => {
	it.each(EXPORTED_CONFIGS)("%s sets no rule to warn", (_name, config) => {
		expect(findWarnRules(config)).toEqual([]);
	});

	it.each(EXPORTED_CONFIGS)("%s turns every category off, so only the explicit rule lists apply", (_name, config) => {
		expect(Object.values(config.categories)).toEqual(["off", "off", "off", "off", "off", "off", "off"]);
	});

	it("detects a warn rule in both string and numeric form (guards the check itself)", () => {
		expect(findWarnRules({ rules: { a: "warn", c: 1, d: "error", e: "off" }, overrides: [{ files: ["x"], rules: { b: ["warn", {}] } }] })).toEqual(["a", "c", "b"]);
	});
});

describe("React configs run the React, Hooks, Compiler and accessibility rules", () => {
	it.each([
		["next-js", nextJsConfig],
		["react-internal", reactInternalConfig],
	])("%s reports an unescaped entity, an invalid anchor, a missing hook dependency and a leaked render", (_name, config) => {
		const code = [
			'import { useEffect } from "react";',
			"export function Probe({ value, count }: { readonly value: string; readonly count: number }): React.JSX.Element {",
			"\tuseEffect((): void => { console.warn(value); }, []);",
			"\treturn <div><a>link</a>{count && <span>'</span>}</div>;",
			"}",
		].join("\n");
		expect(ruleIds(config, code, "src/components/probe.tsx")).toEqual(
			expect.arrayContaining(["react/no-unescaped-entities", "jsx-a11y/anchor-is-valid", "react-hooks/exhaustive-deps", "react-js/jsx-no-leaked-render"]),
		);
	});

	it("runs the React Compiler rules through eslint-plugin-react-hooks", () => {
		const code = "export function Probe(): React.JSX.Element {\n\tconst seed = Math.random();\n\treturn <div>{seed}</div>;\n}\n";
		expect(ruleIds(reactInternalConfig, code, "src/components/probe.tsx")).toContain("react-hooks-js/purity");
	});
});

const SIGNATURE_PAD_FILE = "src/components/signature-pad.tsx";

describe("approved rule exceptions (react-internal)", () => {
	it("holds exactly the one approved exception: signature-pad's application role", () => {
		// Adding an exception needs a maintainer's approval: update this list with it.
		expect(approvedRuleExceptions).toEqual([
			{
				files: [SIGNATURE_PAD_FILE],
				rules: {
					"jsx-a11y/no-noninteractive-element-interactions": "off",
					"jsx-a11y/no-noninteractive-tabindex": "off",
				},
			},
		]);
	});

	const NONINTERACTIVE = "export const Pad = (): React.JSX.Element => <main tabIndex={0} onKeyDown={undo}>pad</main>;\n";

	it("turns the two excepted rules off for signature-pad.tsx only", () => {
		const excepted = ruleIds(reactInternalConfig, NONINTERACTIVE, SIGNATURE_PAD_FILE);
		const elsewhere = ruleIds(reactInternalConfig, NONINTERACTIVE, "src/components/button.tsx");
		expect(excepted).not.toContain("jsx-a11y/no-noninteractive-element-interactions");
		expect(excepted).not.toContain("jsx-a11y/no-noninteractive-tabindex");
		expect(elsewhere).toEqual(expect.arrayContaining(["jsx-a11y/no-noninteractive-element-interactions", "jsx-a11y/no-noninteractive-tabindex"]));
	});

	it("leaves every other rule in force for signature-pad.tsx", () => {
		expect(ruleIds(reactInternalConfig, "export const Pad = (): React.JSX.Element => <a>link</a>;\n", SIGNATURE_PAD_FILE)).toContain("jsx-a11y/anchor-is-valid");
	});
});

const RESTRICTED_SYNTAX_ONLY = isolatedConfig({ rules: { "workspace/restricted-syntax": restrictedSyntaxRules } });

/** Messages from ONLY the base config's restricted-syntax rule (the type-keyword and cast bans). */
function restrictedSyntaxMessages(code) {
	return reports(RESTRICTED_SYNTAX_ONLY, code, "fixture.ts").map((report) => report.message);
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

describe("base config: tenancy naming ban (MT-08)", () => {
	it.each([
		["a type name", "export interface OrganizationMember { readonly id: string }"],
		["a variable", "const organizationId = load();"],
		["a property key", "export const row = { organisationSlug: slug };"],
		["a function name", "export function loadOrganization(): void {}"],
		["a member access", "export const id = context.organizationId;"],
	])("flags %s that says organization", (_position, code) => {
		expect(restrictedSyntaxMessages(code)).toEqual([expect.stringContaining("Name the isolation boundary a tenant")]);
	});

	it.each([
		["UI copy", 'export const heading = "Your organization";'],
		["a web-platform autocomplete token", 'export const field = { autoComplete: "organization" };'],
		["a tenant identifier", "export interface TenantMember { readonly tenantId: string }"],
	])("allows %s", (_what, code) => {
		expect(restrictedSyntaxMessages(code)).toEqual([]);
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
	const RULE = "nestjs/api-method-should-specify-api-response";
	/** The rule exactly as the shared NestJS config sets it (options included). */
	const NEST_RESPONSE_ONLY = isolatedConfig({ jsPlugins: [NESTJS_PLUGIN], rules: { [RULE]: nestjsRules[RULE] } });

	function controllerRuleIds(decorator) {
		const source = `
import { Controller, Get } from "@nestjs/common";
@Controller("reports")
export class ReportsController {
	${decorator}
	@Get("export")
	public async exportReport(): Promise<void> {}
}
`;
		return ruleIds(NEST_RESPONSE_ONLY, source, "reports.controller.ts");
	}

	it("keeps the Zod response decorators in the rule's options", () => {
		expect(nestjsRules[RULE]).toEqual(["error", { additionalCustomApiResponseDecorators: ["ZodResponse", "ZodPaginatedResponse", "ZodRawResponse", "ZodFileResponse"] }]);
	});

	it.each(["@ZodResponse(ReportSchema)", "@ZodPaginatedResponse(ReportSchema)", "@ZodRawResponse(ReportSchema)", "@ZodFileResponse(contract.response)"])(
		"accepts a route documented by %s",
		(decorator) => {
			expect(controllerRuleIds(decorator)).toEqual([]);
		},
	);

	it("still fails a route with no response decorator", () => {
		expect(controllerRuleIds("")).toContain(RULE);
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

const API_CLIENT_BOUNDARIES_ONLY = isolatedConfig({ overrides: apiClientBoundaryConfigs });

describe("api-client: the core is portable (no React, Next, DOM-only or Node code)", () => {
	const CORE_FILE = "src/request.ts";

	it.each([
		["next", 'import { cookies } from "next/headers";'],
		["react-dom", 'import { createPortal } from "react-dom";'],
		["server-only", 'import "server-only";'],
		["react", 'import { useMemo } from "react";'],
		["@tanstack/react-query", 'import { useQuery } from "@tanstack/react-query";'],
		["a type-only TanStack import", 'import type { QueryKey } from "@tanstack/react-query";'],
		["a node: built-in", 'import { readFile } from "node:fs/promises";'],
		["a bare Node built-in", 'import { EventEmitter } from "events";'],
		["the web client package", 'import { useAuth } from "@workspace/client/lib/contexts/identity";'],
		["the web UI package", 'import { Button } from "@workspace/ui/components/button";'],
	])("flags %s", (_what, code) => {
		expect(ruleIds(API_CLIENT_BOUNDARIES_ONLY, code, CORE_FILE)).toEqual(["workspace/restricted-imports"]);
	});

	it.each([
		["window", "export const href = window.location.href;"],
		["localStorage", 'export const token = localStorage.getItem("t");'],
		["DOMException", "export const isAbort = (error: Error): boolean => error instanceof DOMException;"],
		["process", "export const env = process.env.NODE_ENV;"],
		["Buffer", 'export const bytes = Buffer.from("x");'],
	])("flags the %s global", (_name, code) => {
		expect(ruleIds(API_CLIENT_BOUNDARIES_ONLY, code, CORE_FILE)).toEqual(["no-restricted-globals"]);
	});

	it("lets a test build a browser DOMException (the abort it proves the client handles)", () => {
		expect(ruleIds(API_CLIENT_BOUNDARIES_ONLY, 'export const abort = new DOMException("aborted", "AbortError");', "src/request.test.ts")).toEqual([]);
	});

	it("allows the shared contracts, zod and the fetch-family globals", () => {
		const code = [
			'import { apiContract } from "@workspace/shared";',
			'import { z } from "zod";',
			"export const send = (url: string, body: FormData, signal: AbortSignal): Promise<Response> => fetch(new URL(url).toString(), { body, signal, headers: new Headers() });",
		].join("\n");
		expect(ruleIds(API_CLIENT_BOUNDARIES_ONLY, code, CORE_FILE)).toEqual([]);
	});
});

describe("api-client: the ./react entry adds react and @tanstack/react-query only", () => {
	const REACT_FILE = "src/react/hooks.ts";

	it("allows react and @tanstack/react-query", () => {
		expect(ruleIds(API_CLIENT_BOUNDARIES_ONLY, 'import { useMemo } from "react";\nimport { useQuery } from "@tanstack/react-query";', REACT_FILE)).toEqual([]);
	});

	it.each([
		["next", 'import { useRouter } from "next/navigation";'],
		["react-dom", 'import { flushSync } from "react-dom";'],
		["a Node built-in", 'import { join } from "node:path";'],
	])("still flags %s", (_what, code) => {
		expect(ruleIds(API_CLIENT_BOUNDARIES_ONLY, code, REACT_FILE)).toEqual(["workspace/restricted-imports"]);
	});

	it("still flags DOM-only globals", () => {
		expect(ruleIds(API_CLIENT_BOUNDARIES_ONLY, "export const title = document.title;", REACT_FILE)).toEqual(["no-restricted-globals"]);
	});
});

const BACKEND_BOUNDARY_ONLY = isolatedConfig({ overrides: [backendImportBoundaryConfig] });

describe("backend boundary: frontend packages and apps stay out of a Node backend", () => {
	it.each([
		["the API client", 'import { apiRouter } from "@workspace/api-client";'],
		["the mobile app", 'import { config } from "@workspace/mobile";'],
	])("flags %s", (_what, code) => {
		expect(ruleIds(BACKEND_BOUNDARY_ONLY, code, "service.ts")).toEqual(["workspace/restricted-imports"]);
	});
});

// ── React Native (apps/mobile) ─────────────────────────────────────────────

describe("react-native config: the shared React rules with React Native globals", () => {
	it("enables the React rules, the hooks rules and the React Native rules", () => {
		const code = [
			'import { useEffect } from "react";',
			'import { View } from "react-native";',
			"export function Probe({ value }: { readonly value: string }): React.JSX.Element {",
			"\tuseEffect((): void => { console.warn(value); }, []);",
			"\treturn <View style={{ marginTop: 4 }} onLayout={() => value}>Hello</View>;",
			"}",
		].join("\n");
		expect(ruleIds(reactNativeConfig, code, "src/probe.tsx")).toEqual(
			expect.arrayContaining(["react-hooks/exhaustive-deps", "react-js/jsx-no-bind", "react-native/no-raw-text", "react-native/no-inline-styles"]),
		);
	});

	it("uses React Native globals, not the browser's (jsx-a11y is DOM-only and not loaded)", () => {
		expect(reactNativeConfig.globals).toMatchObject({ __DEV__: "readonly", fetch: "readonly", FormData: "readonly" });
		expect(reactNativeConfig.globals).not.toHaveProperty("document");
		expect(reactNativeConfig.env ?? {}).not.toHaveProperty("browser");
		expect(ruleEntries(reactNativeConfig).map(([ruleName]) => ruleName)).not.toContain("jsx-a11y/alt-text");
		expect(REACT_NATIVE_GLOBALS).not.toHaveProperty("localStorage");
	});

	it("keeps the base type-safety selectors next to the accessibility ones in ONE rule entry", () => {
		const entry = reactNativeConfig.overrides.findLast((override) => override.rules?.["workspace/restricted-syntax"] !== undefined && override.files.includes("**/*.tsx"))
			.rules["workspace/restricted-syntax"];
		const selectors = entry.slice(1).map((option) => option.selector);
		expect(selectors).toEqual(expect.arrayContaining(["UnaryExpression[operator='typeof']", ...REACT_NATIVE_ACCESSIBILITY_SELECTORS.map((option) => option.selector)]));
	});
});

/** The react-native config's restricted-syntax and react-native/* rules alone (no type information). */
const REACT_NATIVE_SYNTAX_ONLY = isolatedConfig({
	jsPlugins: [REACT_NATIVE_PLUGIN],
	rules: { "workspace/restricted-syntax": [...restrictedSyntaxRules, ...REACT_NATIVE_ACCESSIBILITY_SELECTORS], ...reactNativeRules },
});

function reactNativeMessages(code) {
	return lines(REACT_NATIVE_SYNTAX_ONLY, code, "screen.tsx");
}

describe("react-native config: React Native accessibility selectors", () => {
	it.each([
		["a Pressable without a role", '<Pressable accessibilityLabel="Save" onPress={save} />', "needs `accessibilityRole`"],
		["a Pressable without a label", '<Pressable accessibilityRole="button" onPress={save} />', "needs `accessibilityLabel`"],
		["a TouchableOpacity without a role", '<TouchableOpacity accessibilityLabel="Save" onPress={save} />', "needs `accessibilityRole`"],
		["a TextInput without a label", "<TextInput value={value} onChangeText={setValue} />", "A TextInput needs `accessibilityLabel`"],
		["an Image without a label", "<Image source={logo} />", "An Image needs `accessibilityLabel`"],
	])("flags %s", (_what, jsx, expected) => {
		expect(reactNativeMessages(`export const node = ${jsx};`)).toEqual([expect.stringContaining(expected)]);
	});

	it.each([
		["a labelled button", '<Pressable accessibilityRole="button" accessibilityLabel="Save" onPress={save} />'],
		["a labelled TextInput", '<TextInput accessibilityLabel="Email" value={value} onChangeText={setValue} />'],
		["a decorative Image hidden from screen readers", '<Image source={logo} accessibilityElementsHidden importantForAccessibility="no" />'],
		["an Image with alt text", '<Image source={logo} alt="Company logo" />'],
	])("allows %s", (_what, jsx) => {
		expect(reactNativeMessages(`export const node = ${jsx};`)).toEqual([]);
	});

	it("still bans `as const` in TSX", () => {
		expect(reactNativeMessages("export const sizes = ['sm'] as const;")).toEqual([expect.stringContaining("`as const` is banned")]);
	});
});

describe("react-native config: React Native rules", () => {
	it("flags raw text outside <Text>, inline styles and colour literals", () => {
		expect(reactNativeMessages("export const node = <View>Hello</View>;")).toEqual([expect.stringMatching(/^react-native\/no-raw-text: /)]);
		expect(reactNativeMessages("export const node = <View style={{ marginTop: 4 }} />;")).toEqual([expect.stringMatching(/^react-native\/no-inline-styles: /)]);
		expect(reactNativeMessages("export const node = <View style={{ color: 'red' }} />;")).toEqual(
			expect.arrayContaining([expect.stringMatching(/^react-native\/no-color-literals: /)]),
		);
	});

	it("allows text inside <Text>", () => {
		expect(reactNativeMessages("export const node = <Text>Hello</Text>;")).toEqual([]);
	});
});

const MOBILE_BOUNDARY_ONLY = isolatedConfig({ overrides: [mobileImportBoundaryConfig] });

/** Rule ids for `code` as `filePath` (relative to apps/mobile) with ONLY the mobile boundary block. */
function mobileBoundaryRuleIds(code, filePath = "src/app/index.tsx") {
	return ruleIds(MOBILE_BOUNDARY_ONLY, code, filePath);
}

describe("mobile boundary: apps/mobile stays React Native-only (docs/technical/mobile/mobile-app.md §4, §9.8)", () => {
	it.each([
		["next", 'import Link from "next/link";'],
		["react-dom", 'import { createPortal } from "react-dom";'],
		["server-only", 'import "server-only";'],
		["the web UI package", 'import { Button } from "@workspace/ui/components/button";'],
		["the web client package", 'import { useAuth } from "@workspace/client/lib/contexts/identity";'],
		["a node: built-in", 'import { readFile } from "node:fs/promises";'],
		["a bare Node built-in", 'import path from "path";'],
		["AsyncStorage", 'import AsyncStorage from "@react-native-async-storage/async-storage";'],
		["another app", 'import { config } from "@workspace/web";'],
		["a server-only workspace", 'import { publish } from "@workspace/messaging";'],
		["a database client", 'import { PrismaClient } from "@prisma/client";'],
		["a deep shared path", 'import { LoginSchema } from "@workspace/shared/schemas/auth";'],
	])("flags %s", (_what, code) => {
		expect(mobileBoundaryRuleIds(code)).toEqual(["workspace/restricted-imports"]);
	});

	it.each([
		["the shared contracts", 'import { LoginSchema } from "@workspace/shared";'],
		["the API client core", 'import { apiRouter } from "@workspace/api-client";'],
		["the API client React entry", 'import { buildClientRouter } from "@workspace/api-client/react";'],
		["an Expo module", 'import * as SecureStore from "expo-secure-store";'],
		["React Native", 'import { View } from "react-native";'],
	])("allows %s", (_what, code) => {
		expect(mobileBoundaryRuleIds(code)).toEqual([]);
	});

	it.each([
		["document", "export const title = document.title;"],
		["localStorage", 'export const token = localStorage.getItem("t");'],
		["Buffer", 'export const bytes = Buffer.from("x");'],
		["__dirname", "export const here = __dirname;"],
	])("flags the %s global", (_name, code) => {
		expect(mobileBoundaryRuleIds(code)).toEqual(["no-restricted-globals"]);
	});

	it("allows the globals React Native provides", () => {
		expect(mobileBoundaryRuleIds('export const load = (): Promise<Response> => fetch(new URL("https://api.example.com").toString());')).toEqual([]);
	});

	it("leaves Node tooling files (.cjs, never bundled) alone", () => {
		expect(mobileBoundaryRuleIds("const path = require('node:path'); module.exports = path.resolve(__dirname);", "jest.resolver.cjs")).toEqual([]);
	});
});
