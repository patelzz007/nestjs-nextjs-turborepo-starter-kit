// The mobile showcase's generated modules, rendered in one pass and formatted
// the way the repository formats the committed files (oxfmt with its own
// config), so a test can say whether the committed files are current:
//
//   generated/feature-index.ts       every component's feature summaries
//   generated/feature-sets.ts        every component's module, behind import()
//   generated/components/<slug>.tsx  one component's examples and Do / Don't pairs
//   generated/code/…                 every example, coloured (code.ts)
//   generated/snippets/<slug>.ts     the code a component's examples show inside a code block, coloured (code.ts)
//   generated/content/…              overview and docs (content.ts)
//   generated/api/…                  the API reference (api.ts)

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { apiIndexSource, apiModuleSource, extractComponentApis, type ComponentApi } from "./api.ts";
import { codeIndexSource, codeModuleSource, loadHighlighter, readSnippets, snippetModuleSource } from "./code.ts";
import { contentIndexSource, contentModuleSource, readComponentContent } from "./content.ts";
import { componentModuleSource, featureIndexSource, featureSetsSource, readComponents, type ComponentFeatures } from "./features.ts";
import type { ShowcaseCatalogComponent, ShowcaseLayout } from "./layout.ts";

/** Generated files by their path inside the generated folder (`components/button.tsx`). */
export type GeneratedFiles = ReadonlyMap<string, string>;

/** Which parts to render: the API reference starts the TypeScript server, so a test of the rest can leave it out. */
export interface RenderOptions {
	readonly api: boolean;
}

/** Every generated module of the showcase, unformatted. */
export async function renderShowcaseFiles(layout: ShowcaseLayout, catalog: readonly ShowcaseCatalogComponent[], options: RenderOptions): Promise<GeneratedFiles> {
	const components = readComponents(layout);
	const slugs = components.map(({ slug }: ComponentFeatures): string => slug);
	const files = new Map<string, string>([
		["feature-index.ts", featureIndexSource(components)],
		["feature-sets.ts", featureSetsSource(slugs)],
		["code/index.ts", codeIndexSource(slugs)],
	]);
	const highlighter = await loadHighlighter();
	try {
		for (const component of components) {
			files.set(`components/${component.slug}.tsx`, componentModuleSource(component));
			files.set(`code/${component.slug}.ts`, codeModuleSource(highlighter, component));
			const snippets = readSnippets(path.join(layout.appRoot, layout.examplesDir), component.slug);
			if (snippets.length > 0) {
				files.set(`snippets/${component.slug}.ts`, snippetModuleSource(highlighter, component.slug, snippets));
			}
		}
	} finally {
		highlighter.dispose();
	}
	const written = components.flatMap((component: ComponentFeatures): string[] => {
		const content = readComponentContent(layout, component);
		if (content === null) {
			return [];
		}
		files.set(`content/${component.slug}.ts`, contentModuleSource(component.slug, content));
		return [component.slug];
	});
	files.set("content/index.ts", contentIndexSource(written));
	if (options.api) {
		// The components with examples (a catalog entry without its folder fails the showcase's own test instead).
		const shown = new Set(slugs);
		const apis = extractComponentApis(
			layout,
			catalog.filter((component: ShowcaseCatalogComponent): boolean => shown.has(component.slug)),
		);
		for (const componentApi of apis) {
			files.set(`api/${componentApi.slug}.ts`, apiModuleSource(componentApi));
		}
		files.set("api/index.ts", apiIndexSource(apis.map(({ slug }: ComponentApi): string => slug)));
	}
	return files;
}

/** The formatter config that applies to the app: the nearest `.oxfmtrc.json` at or above it. */
function formatterConfig(start: string): string {
	for (let dir = start; ; dir = path.dirname(dir)) {
		const candidate = path.join(dir, ".oxfmtrc.json");
		if (existsSync(candidate)) {
			return candidate;
		}
		if (path.dirname(dir) === dir) {
			throw new Error(`No .oxfmtrc.json at or above ${start}`);
		}
	}
}

/** The oxfmt CLI the app formats with (located through its package.json: its `exports` do not expose `bin/`). */
function oxfmtBin(appRoot: string): string {
	return path.join(path.dirname(createRequire(path.join(appRoot, "package.json")).resolve("oxfmt/package.json")), "bin", "oxfmt");
}

/** `files` as oxfmt formats them with the app's own config, in one run in a scratch folder. */
export function formatFiles(layout: ShowcaseLayout, files: GeneratedFiles): GeneratedFiles {
	const scratch = mkdtempSync(path.join(tmpdir(), "mobile-showcase-"));
	try {
		for (const [file, source] of files) {
			mkdirSync(path.dirname(path.join(scratch, file)), { recursive: true });
			writeFileSync(path.join(scratch, file), source);
		}
		execFileSync(process.execPath, [oxfmtBin(layout.appRoot), `--config=${formatterConfig(layout.appRoot)}`, "."], { cwd: scratch, encoding: "utf8" });
		return new Map([...files.keys()].map((file: string): [string, string] => [file, readFileSync(path.join(scratch, file), "utf8")]));
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
}

/** Every file under `dir`, by its path inside it. */
function filesUnder(dir: string, prefix = ""): string[] {
	if (!existsSync(dir)) {
		return [];
	}
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry): string[] =>
		entry.isDirectory() ? filesUnder(path.join(dir, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`],
	);
}

/** Which committed files differ from `expected`: changed, missing or left over (a test of the parts rendered can skip a folder). */
export function staleFiles(layout: ShowcaseLayout, expected: GeneratedFiles, skipFolders: readonly string[] = []): string[] {
	const dir = path.join(layout.appRoot, layout.generatedDir);
	const committed = filesUnder(dir).filter((file: string): boolean => !skipFolders.some((folder: string): boolean => file.startsWith(`${folder}/`)));
	const changed = [...expected].filter(([file, source]): boolean => !existsSync(path.join(dir, file)) || readFileSync(path.join(dir, file), "utf8") !== source);
	const leftOver = committed.filter((file: string): boolean => !expected.has(file));
	return [...changed.map(([file]): string => file), ...leftOver].sort();
}

/** Replaces the generated folder with `files`. */
export function writeFiles(layout: ShowcaseLayout, files: GeneratedFiles): void {
	const dir = path.join(layout.appRoot, layout.generatedDir);
	rmSync(dir, { recursive: true, force: true });
	for (const [file, source] of files) {
		mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		writeFileSync(path.join(dir, file), source);
	}
}
