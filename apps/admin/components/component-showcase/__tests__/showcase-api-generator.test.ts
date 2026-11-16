import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SHOWCASE_CATALOG_ORDER } from "@/components/component-showcase/showcase-catalog";

import {
	API_DIR,
	API_INDEX_FILE,
	apiIndexSource,
	apiModuleSource,
	apiModulesOf,
	belongsTo,
	clipType,
	cvaDefaultsOf,
	extractComponentApis,
	fileOfSpecifier,
	inheritedFrom,
	KIT_LAYOUT,
	kitImportsOf,
	orderEntries,
	readApiModules,
	type ApiEntry,
	type ComponentApi,
} from "../../../scripts/showcase-api";

import { formattedAll, ROOT } from "./formatted-sources";

/** Starting the TypeScript server and reading every module takes a few seconds. */
const EXTRACT_TIMEOUT_MS = 120_000;

function entry(name: string, kind: ApiEntry["kind"]): ApiEntry {
	return { name, kind, module: "@workspace/ui/components/x", description: "", props: [], inherits: [], signature: null };
}

describe("showcase API generator", () => {
	it("knows which kit modules belong to a component", () => {
		expect(belongsTo("code-block", "code-block")).toBe(true);
		expect(belongsTo("code-block", "code-block-highlight")).toBe(true);
		expect(belongsTo("gantt", "gantt/gantt-nav")).toBe(true);
		expect(belongsTo("input", "input-group")).toBe(true);
		expect(belongsTo("button", "badge")).toBe(false);
		expect(belongsTo("gantt", "data-grid/data-grid")).toBe(false);
	});

	it("reads the kit imports of an example and keeps the component's own", () => {
		const source =
			'import { Button } from "@workspace/ui/components/button";\nimport { CodeBlock } from "@workspace/ui/components/code-block";\nimport * as React from "react";\n';
		expect(kitImportsOf(source, KIT_LAYOUT)).toEqual(["button", "code-block"]);
		expect(apiModulesOf("code-block", [source, source], KIT_LAYOUT)).toEqual(["@workspace/ui/components/code-block"]);
	});

	it("resolves a specifier to its file, or null outside the kit", () => {
		expect(fileOfSpecifier(ROOT, `${KIT_LAYOUT.componentsAlias}badge`, KIT_LAYOUT)).toBe(path.join(ROOT, KIT_LAYOUT.componentsDir, "badge.tsx"));
		const [[hooksAlias, hooksDir] = ["", ""]] = Object.entries(KIT_LAYOUT.otherAliases);
		expect(fileOfSpecifier(ROOT, `${hooksAlias}use-file-upload`, KIT_LAYOUT)).toBe(path.join(ROOT, hooksDir, "use-file-upload.ts"));
		expect(fileOfSpecifier(ROOT, `${KIT_LAYOUT.componentsAlias}not-a-component`, KIT_LAYOUT)).toBeNull();
		expect(fileOfSpecifier(ROOT, "react", KIT_LAYOUT)).toBeNull();
	});

	it("names where inherited props come from", () => {
		expect(inheritedFrom("/x/node_modules/@base-ui/react/esm/button/Button.d.ts")).toBe("Base UI button props");
		expect(inheritedFrom("/x/node_modules/@base-ui/react/esm/use-render/useRender.d.ts")).toBe("HTML attributes");
		expect(inheritedFrom("/x/node_modules/@types/react/index.d.ts")).toBe("HTML attributes");
		expect(inheritedFrom("/x/node_modules/some-lib/index.d.ts")).toBeNull();
	});

	it("reads cva default variants, leaving out a key two calls disagree on", () => {
		const source =
			'const a = cva("", { variants: {}, defaultVariants: { variant: "default", size: "sm" } });\nconst b = cva("", { defaultVariants: { size: "lg", tone: true } });';
		expect(Object.fromEntries(cvaDefaultsOf(source))).toEqual({ variant: '"default"', tone: "true" });
	});

	it("flattens a type and cuts a long one", () => {
		expect(clipType("{\n  a: string;\n}")).toBe("{ a: string; }");
		const long = clipType(`"${"x".repeat(400)}"`);
		expect(long.length).toBe(240);
		expect(long.endsWith("…")).toBe(true);
	});

	it("orders the page's own component first, then components, hooks and helpers", () => {
		const ordered = orderEntries("code-block", [
			entry("ansiToLines", "function"),
			entry("useCodeBlockConfig", "hook"),
			entry("CodeBlockHeader", "component"),
			entry("CodeBlock", "component"),
		]);
		expect(ordered.map(({ name }) => name)).toEqual(["CodeBlock", "CodeBlockHeader", "useCodeBlockConfig", "ansiToLines"]);
	});

	it("writes each API module and the index", () => {
		const api: ComponentApi = { slug: "kbd", entries: [entry("Kbd", "component")] };
		expect(apiModuleSource(api, KIT_LAYOUT)).toContain("export const API_ENTRIES: readonly ApiEntry[] = [");
		expect(apiIndexSource(["kbd"], KIT_LAYOUT)).toContain(
			'["kbd", async (): Promise<readonly ApiEntry[]> => (await import("@/components/component-showcase/generated/api/kbd")).API_ENTRIES]',
		);
	});

	it("documents modules for every catalog component", () => {
		const modules = readApiModules(ROOT, KIT_LAYOUT);
		expect([...modules.keys()].sort()).toEqual(SHOWCASE_CATALOG_ORDER.map(({ entry: catalogEntry }) => catalogEntry.slug).sort());
		expect([...modules].filter(([, specifiers]) => specifiers.length === 0).map(([slug]) => slug)).toEqual([]);
	});

	it("keeps every generated API module up to date — run `pnpm showcase:generate`", { timeout: EXTRACT_TIMEOUT_MS }, () => {
		const apis = extractComponentApis(ROOT, readApiModules(ROOT, KIT_LAYOUT), KIT_LAYOUT);
		const expected = new Map<string, string>([
			[
				API_INDEX_FILE,
				apiIndexSource(
					apis.map(({ slug }) => slug),
					KIT_LAYOUT,
				),
			],
			...apis.map((api: ComponentApi): [string, string] => [`${API_DIR}/${api.slug}.ts`, apiModuleSource(api, KIT_LAYOUT)]),
		]);
		for (const [file, source] of formattedAll(expected)) {
			expect(readFileSync(path.join(ROOT, file), "utf8"), file).toBe(source);
		}
		expect(readdirSync(path.join(ROOT, API_DIR)).length).toBe(apis.length + 1);
		const codeBlock = apis.find(({ slug }) => slug === "code-block");
		expect(codeBlock?.entries.at(0)?.name).toBe("CodeBlock");
		expect(codeBlock?.entries.at(0)?.props.find(({ name }) => name === "showLineNumbers")?.defaultValue).toBe("false");
	});
});
