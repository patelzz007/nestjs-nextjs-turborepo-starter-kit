// The showcase generator's public entry. The app runs it from its own script
// (apps/mobile scripts/showcase.ts), passing its layout and catalog:
//
//   writeShowcase(app, catalog)            replaces the generated folder
//   checkShowcase(app, catalog)            the generated files that are out of date (none when current)
//   catalogGaps(app, catalog, notShown)    kit components the catalog misses, and catalog modules with no kit file
//
// The app names its root by file URL: the app's own code may not import Node's modules (it runs on Hermes).

import { fileURLToPath } from "node:url";

import { catalogGaps as layoutCatalogGaps } from "./api.ts";
import { formatFiles, renderShowcaseFiles, staleFiles, writeFiles, type GeneratedFiles } from "./generate.ts";
import type { ShowcaseAppLayout, ShowcaseCatalogComponent, ShowcaseLayout } from "./layout.ts";

export type {
	ApiEntry,
	ApiEntryKind,
	ApiProp,
	ShowcaseAppLayout,
	ShowcaseCatalogComponent,
	ShowcaseContent,
	ShowcaseDocs,
	ShowcaseDocsExample,
	ShowcaseFaqEntry,
	ShowcaseFences,
	ShowcaseLayout,
	ShowcaseOverview,
} from "./layout.ts";

/** The layout with the app's root as a path. */
export function layoutOf({ appUrl, ...rest }: ShowcaseAppLayout): ShowcaseLayout {
	return { ...rest, appRoot: fileURLToPath(appUrl) };
}

async function renderFormatted(layout: ShowcaseLayout, catalog: readonly ShowcaseCatalogComponent[]): Promise<GeneratedFiles> {
	return formatFiles(layout, await renderShowcaseFiles(layout, catalog, { api: true }));
}

/** Writes every generated module, replacing the generated folder; resolves to how many there are. */
export async function writeShowcase(app: ShowcaseAppLayout, catalog: readonly ShowcaseCatalogComponent[]): Promise<number> {
	const layout = layoutOf(app);
	const files = await renderFormatted(layout, catalog);
	writeFiles(layout, files);
	return files.size;
}

/** The generated files that differ from what the generator would write now (changed, missing or left over), sorted. */
export async function checkShowcase(app: ShowcaseAppLayout, catalog: readonly ShowcaseCatalogComponent[]): Promise<string[]> {
	const layout = layoutOf(app);
	return staleFiles(layout, await renderFormatted(layout, catalog));
}

/** What the catalog misses: a kit component in no entry and not in `notShown`, and an entry's module with no kit file. */
export function catalogGaps(app: ShowcaseAppLayout, catalog: readonly ShowcaseCatalogComponent[], notShown: readonly string[]): string[] {
	return layoutCatalogGaps(layoutOf(app), catalog, notShown);
}
