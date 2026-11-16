// node scripts/showcase.ts [--check]: writes the showcase's generated modules
// (src/features/showcase/generated), or fails when the committed ones are out
// of date. The app owns its layout, conventions and catalog and hands them to
// the generator (@workspace/tooling/mobile-showcase), which never imports the app.

import { catalogGaps, checkShowcase, writeShowcase, type ShowcaseAppLayout, type ShowcaseCatalogComponent } from "@workspace/tooling/mobile-showcase";

import { anchorOf } from "../src/features/showcase/showcase-anchor.ts";
import { NOT_SHOWN_MODULES, SHOWCASE_CATALOG_ORDER, type NotShownModule, type ShowcaseCatalogItem } from "../src/features/showcase/showcase-catalog.ts";
import { API_FENCE, EXAMPLE_FENCE } from "../src/features/showcase/showcase-fences.ts";

const LAYOUT: ShowcaseAppLayout = {
	appUrl: new URL("..", import.meta.url),
	examplesDir: "src/features/showcase/examples",
	generatedDir: "src/features/showcase/generated",
	kitDir: "../../packages/ui-native/src",
	kitAlias: "@workspace/ui-native/",
	tsconfig: "../../packages/ui-native/tsconfig.json",
	anchorOf,
	fences: { api: API_FENCE, example: EXAMPLE_FENCE },
};

const CATALOG: readonly ShowcaseCatalogComponent[] = SHOWCASE_CATALOG_ORDER.map(({ entry }: ShowcaseCatalogItem): ShowcaseCatalogComponent => entry);

const gaps = catalogGaps(
	LAYOUT,
	CATALOG,
	NOT_SHOWN_MODULES.map(({ module }: NotShownModule): string => module),
);
if (gaps.length > 0) {
	process.stderr.write(`The showcase catalog (src/features/showcase/showcase-catalog.ts) is incomplete:\n${gaps.join("\n")}\n`);
	process.exit(1);
}

if (process.argv.includes("--check")) {
	const stale = await checkShowcase(LAYOUT, CATALOG);
	if (stale.length > 0) {
		process.stderr.write(`The showcase's generated modules are out of date (${stale.join(", ")}). Run: pnpm tools mobile:showcase\n`);
		process.exit(1);
	}
} else {
	const count = await writeShowcase(LAYOUT, CATALOG);
	process.stdout.write(`mobile showcase: ${String(count)} generated modules\n`);
}
