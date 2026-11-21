// `pnpm showcase:generate` builds the showcase's generated modules from
// components/component-showcase/examples/<component>/features.json — one entry per feature
// of a component (its id, its label, the example file and its export):
//
// and, beside it, guidelines.json — the component's Do / Don't pairs (a title,
// then each side's advice, example file and export):
//
// - generated/feature-index.ts: every component's features (id, label, anchor).
//   Plain data, safe on the server: the index page's counts and the search read it.
// - generated/components/<component>.tsx: one client module per component with
//   each feature's live example (its own `next/dynamic` chunk), its description
//   and its exact source text. A component page loads only its own module.
// - generated/feature-sets.tsx: every component's module behind `next/dynamic`,
//   keyed by its slug.
// - generated/examples/<component>.ts: the component's examples as plain,
//   statically imported components, for TESTS that render every one. The app
//   never imports these: each would put all of a component's examples in one
//   bundle.
//
// The showcase test checks the committed files match what this produces.

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

import { anchorOf } from "../components/component-showcase/showcase-anchor.ts";

/** Where the feature folders live, relative to the repository root. */
export const EXAMPLES_DIR = "components/component-showcase/examples";
/** The generated modules, relative to the repository root. */
export const GENERATED_DIR = "components/component-showcase/generated";
export const FEATURE_INDEX_FILE = `${GENERATED_DIR}/feature-index.ts`;
export const FEATURE_SETS_FILE = `${GENERATED_DIR}/feature-sets.tsx`;
export const COMPONENTS_DIR = `${GENERATED_DIR}/components`;
export const STATIC_EXAMPLES_DIR = `${GENERATED_DIR}/examples`;
export const STATIC_EXAMPLES_INDEX_FILE = `${STATIC_EXAMPLES_DIR}/index.ts`;
/** The import alias of the repository root, as the generated modules import from it. */
const ROOT_ALIAS = "@";

const FEATURE_MANIFEST = "features.json";
const GUIDELINES_MANIFEST = "guidelines.json";
/** Every component shows at least this many Do / Don't pairs. */
const MIN_GUIDELINES = 2;
const MAX_GUIDELINE_TEXT_LENGTH = 320;
const EXAMPLE_FILE_SUFFIX = ".tsx";
/** Bounds that keep a hand-edited manifest honest. */
const MAX_LABEL_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 320;
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const PASCAL_EXPORT = /^[A-Z][A-Za-z0-9]*$/u;
/** The route segment a page part may not take: the component's docs page lives there. */
const RESERVED_PART_ID = "docs";

const FeatureManifestSchema = z
	.array(
		z.object({
			id: z.string().regex(/^c-[a-z0-9-]+$/u),
			label: z.string().trim().min(1).max(MAX_LABEL_LENGTH),
			description: z.string().trim().min(1).max(MAX_DESCRIPTION_LENGTH),
			file: z.string().regex(KEBAB),
			export: z.string().regex(PASCAL_EXPORT),
			/**
			 * The page part the feature sits on ("Finding rows"). A component with many heavy examples splits its page
			 * into parts, one route each (`/components/<slug>/<part>`), so a page never runs every example at once. Either
			 * every feature of a component names its part or none does.
			 */
			group: z.string().trim().min(1).max(MAX_LABEL_LENGTH).optional(),
		}),
	)
	.min(1)
	.refine((entries) => entries.every((entry) => entry.group !== undefined) || entries.every((entry) => entry.group === undefined), {
		message: "either every feature names its group or none does",
	});

export type FeatureManifest = z.output<typeof FeatureManifestSchema>;

/** One part of a split component page: its route segment and its title. */
export interface GeneratedPart {
	readonly id: string;
	readonly label: string;
}

/** A component's parts in first-seen order; none for a component on one page. */
export function partsOf(manifest: FeatureManifest): GeneratedPart[] {
	const parts: GeneratedPart[] = [];
	for (const entry of manifest) {
		if (entry.group !== undefined && !parts.some((part) => part.label === entry.group)) {
			const id = anchorOf(entry.group);
			// The docs page owns `/components/<slug>/docs`; a part of that name could never be reached.
			if (id === RESERVED_PART_ID) {
				throw new Error(`group "${entry.group}" would take the docs page's route`);
			}
			parts.push({ id, label: entry.group });
		}
	}
	return parts;
}

const GuidelineSideSchema = z.object({
	text: z.string().trim().min(1).max(MAX_GUIDELINE_TEXT_LENGTH),
	file: z.string().regex(KEBAB),
	export: z.string().regex(PASCAL_EXPORT),
});

const GuidelinesManifestSchema = z
	.array(z.object({ title: z.string().trim().min(1).max(MAX_LABEL_LENGTH), do: GuidelineSideSchema, dont: GuidelineSideSchema }))
	.min(MIN_GUIDELINES);

export type GuidelinesManifest = z.output<typeof GuidelinesManifestSchema>;
type GuidelineSideEntry = z.output<typeof GuidelineSideSchema>;

/** One side of a pair with its source. */
export interface GeneratedGuidelineSide extends GuidelineSideEntry {
	readonly source: string;
}

export interface GeneratedGuideline {
	readonly title: string;
	readonly do: GeneratedGuidelineSide;
	readonly dont: GeneratedGuidelineSide;
}
type ManifestEntry = FeatureManifest[number];

/** One feature with everything the generated modules need. */
export interface GeneratedFeature extends ManifestEntry {
	readonly anchor: string;
	readonly source: string;
	/** The id of the part the feature sits on, or `null` on a one-page component. */
	readonly part: string | null;
}

/** One component's folder and its features, in manifest order. */
export interface ComponentFeatures {
	readonly slug: string;
	readonly features: readonly GeneratedFeature[];
	/** The page's parts, in order; empty for a component on one page. */
	readonly parts: readonly GeneratedPart[];
	/** Its Do / Don't pairs, in manifest order (none while the folder has no guidelines.json). */
	readonly guidelines: readonly GeneratedGuideline[];
}

/** `data-grid` → `DataGrid`. */
export function pascalCaseOf(kebab: string): string {
	return kebab
		.split("-")
		.map((part: string): string => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join("");
}

export { anchorOf };

/** Anchors for `labels`, made unique within one component (`basic`, `basic-2`). */
export function uniqueAnchors(labels: readonly string[]): string[] {
	const seen = new Map<string, number>();
	return labels.map((label: string): string => {
		const base = anchorOf(label);
		const count = (seen.get(base) ?? 0) + 1;
		seen.set(base, count);
		return count === 1 ? base : `${base}-${String(count)}`;
	});
}

/** Parses a folder's manifest: a malformed one fails the build with the folder named. */
export function parseManifest(folder: string, json: string): FeatureManifest {
	const parsed = FeatureManifestSchema.safeParse(JSON.parse(json));
	if (!parsed.success) {
		throw new Error(`${EXAMPLES_DIR}/${folder}/${FEATURE_MANIFEST}: ${parsed.error.message}`);
	}
	return parsed.data;
}

/** Parses a folder's Do / Don't manifest: a malformed one fails the build with the folder named. */
export function parseGuidelines(folder: string, json: string): GuidelinesManifest {
	const parsed = GuidelinesManifestSchema.safeParse(JSON.parse(json));
	if (!parsed.success) {
		throw new Error(`${EXAMPLES_DIR}/${folder}/${GUIDELINES_MANIFEST}: ${parsed.error.message}`);
	}
	return parsed.data;
}

/** Each guideline side's file and export, once each, in order: what a module imports. */
export function guidelineSidesOf(guidelines: readonly GeneratedGuideline[]): GeneratedGuidelineSide[] {
	return guidelines.flatMap((guideline: GeneratedGuideline): GeneratedGuidelineSide[] => [guideline.do, guideline.dont]);
}

/** Every component folder (one with a manifest) and its features, sorted by slug. */
export function readComponentFeatures(root: string): ComponentFeatures[] {
	const dir = path.join(root, EXAMPLES_DIR);
	return readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && entry.name !== "__tests__")
		.map((entry) => entry.name)
		.sort()
		.map((slug: string): ComponentFeatures => {
			const manifest = parseManifest(slug, readFileSync(path.join(dir, slug, FEATURE_MANIFEST), "utf8"));
			const anchors = uniqueAnchors(manifest.map((entry: ManifestEntry): string => entry.label));
			const features = manifest.map((entry: ManifestEntry, position: number): GeneratedFeature => {
				const source = readFileSync(path.join(dir, slug, `${entry.file}${EXAMPLE_FILE_SUFFIX}`), "utf8");
				return { ...entry, anchor: anchors.at(position) ?? anchorOf(entry.label), source, part: entry.group === undefined ? null : anchorOf(entry.group) };
			});
			const parts = partsOf(manifest);
			const guidelinesFile = path.join(dir, slug, GUIDELINES_MANIFEST);
			const sideOf = (side: GuidelineSideEntry): GeneratedGuidelineSide => ({
				...side,
				source: readFileSync(path.join(dir, slug, `${side.file}${EXAMPLE_FILE_SUFFIX}`), "utf8"),
			});
			const guidelines = existsSync(guidelinesFile)
				? parseGuidelines(slug, readFileSync(guidelinesFile, "utf8")).map((guideline): GeneratedGuideline => ({
						title: guideline.title,
						do: sideOf(guideline.do),
						dont: sideOf(guideline.dont),
					}))
				: [];
			return { slug, features, parts, guidelines };
		});
}

/** A part id as generated source: its quoted id, or `null`. */
function partLiteral(part: string | null): string {
	return part === null ? "null" : JSON.stringify(part);
}

/** The feature index module: every component's feature summaries. */
export function featureIndexSource(components: readonly ComponentFeatures[]): string {
	const entries = components.map(({ slug, features }: ComponentFeatures): string => {
		const rows = features.map(
			(feature: GeneratedFeature): string =>
				`{ id: ${JSON.stringify(feature.id)}, label: ${JSON.stringify(feature.label)}, anchor: ${JSON.stringify(feature.anchor)}, part: ${partLiteral(feature.part)} }`,
		);
		return `\t[${JSON.stringify(slug)}, [${rows.join(", ")}]],`;
	});
	const partEntries = components
		.filter(({ parts }: ComponentFeatures): boolean => parts.length > 0)
		.map(({ slug, parts }: ComponentFeatures): string => {
			const rows = parts.map((part: GeneratedPart): string => `{ id: ${JSON.stringify(part.id)}, label: ${JSON.stringify(part.label)} }`);
			return `\t[${JSON.stringify(slug)}, [${rows.join(", ")}]],`;
		});
	return `// GENERATED by \`pnpm showcase:generate\` — do not edit by hand.
// Every component's features (${EXAMPLES_DIR}/<component>/${FEATURE_MANIFEST}), in order.
// Plain data, safe to import on the server.

import type { ShowcaseFeatureSummary, ShowcasePart } from "${ROOT_ALIAS}/components/component-showcase/showcase-feature";

export const SHOWCASE_FEATURE_INDEX: ReadonlyMap<string, readonly ShowcaseFeatureSummary[]> = new Map<string, readonly ShowcaseFeatureSummary[]>([
${entries.join("\n")}
]);

/** The parts of every component whose page is split, in order: one route each. */
export const SHOWCASE_FEATURE_PARTS: ReadonlyMap<string, readonly ShowcasePart[]> = new Map<string, readonly ShowcasePart[]>([
${partEntries.join("\n")}
]);
`;
}

/** One component's module: its features' live examples, descriptions and sources. */
export function componentModuleSource({ slug, features, guidelines }: ComponentFeatures): string {
	const component = `${pascalCaseOf(slug)}Features`;
	const sides = guidelineSidesOf(guidelines);
	const sideImports = sides.map(
		(side: GeneratedGuidelineSide, position: number): string =>
			`const Guideline${String(position + 1)} = dynamic(() => import("${ROOT_ALIAS}/${EXAMPLES_DIR}/${slug}/${side.file}").then((m) => m.${side.export}), { loading: FeatureLoading });`,
	);
	const sideRow = (side: GeneratedGuidelineSide): string =>
		`{ text: ${JSON.stringify(side.text)}, file: ${JSON.stringify(side.file)}, source: ${JSON.stringify(side.source)}, render: (): React.JSX.Element => <Guideline${String(sides.indexOf(side) + 1)} /> }`;
	const guidelineRows = guidelines.map(
		(guideline: GeneratedGuideline): string => `\t{ title: ${JSON.stringify(guideline.title)}, do: ${sideRow(guideline.do)}, dont: ${sideRow(guideline.dont)} },`,
	);
	const imports = features.map(
		(feature: GeneratedFeature, position: number): string =>
			`const Example${String(position + 1)} = dynamic(() => import("${ROOT_ALIAS}/${EXAMPLES_DIR}/${slug}/${feature.file}").then((m) => m.${feature.export}), { loading: FeatureLoading });`,
	);
	const rows = features.map(
		(feature: GeneratedFeature, position: number): string =>
			`\t{ id: ${JSON.stringify(feature.id)}, label: ${JSON.stringify(feature.label)}, anchor: ${JSON.stringify(feature.anchor)}, part: ${partLiteral(feature.part)}, description: ${JSON.stringify(feature.description)}, file: ${JSON.stringify(feature.file)}, source: ${JSON.stringify(feature.source)}, render: (): React.JSX.Element => <Example${String(position + 1)} /> },`,
	);
	return `"use client";

// GENERATED by \`pnpm showcase:generate\` — do not edit by hand.
// The ${slug} component's features: each live example is its own chunk.

import dynamic from "next/dynamic";
import type * as React from "react";

import { FeatureLoading } from "${ROOT_ALIAS}/components/component-showcase/feature-loading";
import type { ShowcaseFeature, ShowcaseGuideline } from "${ROOT_ALIAS}/components/component-showcase/showcase-feature";
import { ShowcaseFeatureList, type ShowcaseFeatureSetProps } from "${ROOT_ALIAS}/components/component-showcase/showcase-feature-list";

${[...imports, ...sideImports].join("\n")}

const FEATURES: readonly ShowcaseFeature[] = [
${rows.join("\n")}
];

const GUIDELINES: readonly ShowcaseGuideline[] = [
${guidelineRows.join("\n")}
];

export function ${component}({ part }: ShowcaseFeatureSetProps): React.JSX.Element {
	return <ShowcaseFeatureList features={FEATURES} guidelines={GUIDELINES} part={part} />;
}
`;
}

/** A component's static examples module (tests only): every example imported directly. */
export function staticExamplesSource({ slug, features, guidelines }: ComponentFeatures): string {
	const sides = guidelineSidesOf(guidelines);
	const imports = [...features, ...sides].map(
		(example: GeneratedFeature | GeneratedGuidelineSide): string => `import { ${example.export} } from "${ROOT_ALIAS}/${EXAMPLES_DIR}/${slug}/${example.file}";`,
	);
	const sideRows = sides.map((side: GeneratedGuidelineSide): string => `\t{ file: ${JSON.stringify(side.file)}, component: ${side.export} },`);
	const rows = features.map(
		(feature: GeneratedFeature): string =>
			`\t{ id: ${JSON.stringify(feature.id)}, label: ${JSON.stringify(feature.label)}, anchor: ${JSON.stringify(feature.anchor)}, component: ${feature.export} },`,
	);
	return `// GENERATED by \`pnpm showcase:generate\` — do not edit by hand.
// The ${slug} component's examples as plain components, for TESTS that render
// every one. Never import this from the app: it bundles every example at once.

import type { ShowcaseFeatureExample, ShowcaseGuidelineExample } from "${ROOT_ALIAS}/components/component-showcase/showcase-feature";

${imports.join("\n")}

export const FEATURE_EXAMPLES: readonly ShowcaseFeatureExample[] = [
${rows.join("\n")}
];

export const GUIDELINE_EXAMPLES: readonly ShowcaseGuidelineExample[] = [
${sideRows.join("\n")}
];
`;
}

/** Every component's static examples, keyed by slug (tests only). */
export function staticExamplesIndexSource(slugs: readonly string[]): string {
	const imports = slugs.map(
		(slug: string): string =>
			`import { FEATURE_EXAMPLES as ${pascalCaseOf(slug)}, GUIDELINE_EXAMPLES as ${pascalCaseOf(slug)}Guidelines } from "${ROOT_ALIAS}/${STATIC_EXAMPLES_DIR}/${slug}";`,
	);
	const entries = slugs.map((slug: string): string => `\t[${JSON.stringify(slug)}, ${pascalCaseOf(slug)}],`);
	const guidelineEntries = slugs.map((slug: string): string => `\t[${JSON.stringify(slug)}, ${pascalCaseOf(slug)}Guidelines],`);
	return `// GENERATED by \`pnpm showcase:generate\` — do not edit by hand.
// Every component's examples as plain components, keyed by slug, for TESTS
// that render every feature. Never import this from the app.

import type { ShowcaseFeatureExample, ShowcaseGuidelineExample } from "${ROOT_ALIAS}/components/component-showcase/showcase-feature";

${imports.join("\n")}

export const ALL_FEATURE_EXAMPLES: ReadonlyMap<string, readonly ShowcaseFeatureExample[]> = new Map<string, readonly ShowcaseFeatureExample[]>([
${entries.join("\n")}
]);

export const ALL_GUIDELINE_EXAMPLES: ReadonlyMap<string, readonly ShowcaseGuidelineExample[]> = new Map<string, readonly ShowcaseGuidelineExample[]>([
${guidelineEntries.join("\n")}
]);
`;
}

/** The feature-sets module: every component's module as its own chunk, keyed by slug. */
export function featureSetsSource(slugs: readonly string[]): string {
	const imports = slugs.map((slug: string): string => {
		const component = `${pascalCaseOf(slug)}Features`;
		return `const ${component} = dynamic(() => import("${ROOT_ALIAS}/${COMPONENTS_DIR}/${slug}").then((m) => m.${component}), { loading: FeatureSetLoading });`;
	});
	const entries = slugs.map(
		(slug: string): string => `\t[${JSON.stringify(slug)}, (part: string | null): React.JSX.Element => <${pascalCaseOf(slug)}Features part={part} />],`,
	);
	return `"use client";

// GENERATED by \`pnpm showcase:generate\` — do not edit by hand.
// Every component's features module, keyed by its slug: a component page
// downloads only its own.

import dynamic from "next/dynamic";
import type * as React from "react";

import { FeatureSetLoading } from "${ROOT_ALIAS}/components/component-showcase/feature-loading";

${imports.join("\n")}

/**
 * Renders one component's features, or one part's on a split page (a render function, not a component: picking a
 * component during render would remount it).
 */
export type RenderFeatureSet = (part: string | null) => React.JSX.Element;

export const SHOWCASE_FEATURE_SETS: ReadonlyMap<string, RenderFeatureSet> = new Map<string, RenderFeatureSet>([
${entries.join("\n")}
]);
`;
}

// Run directly (`node scripts/showcase-features.ts`): rewrite every generated module.
if (import.meta.main) {
	const root = path.resolve(import.meta.dirname, "..");
	const components = readComponentFeatures(root);
	for (const dir of [COMPONENTS_DIR, STATIC_EXAMPLES_DIR]) {
		rmSync(path.join(root, dir), { recursive: true, force: true });
		mkdirSync(path.join(root, dir), { recursive: true });
	}
	writeFileSync(path.join(root, FEATURE_INDEX_FILE), featureIndexSource(components));
	for (const component of components) {
		writeFileSync(path.join(root, COMPONENTS_DIR, `${component.slug}.tsx`), componentModuleSource(component));
		writeFileSync(path.join(root, STATIC_EXAMPLES_DIR, `${component.slug}.ts`), staticExamplesSource(component));
	}
	const slugs = components.map(({ slug }: ComponentFeatures): string => slug);
	writeFileSync(path.join(root, FEATURE_SETS_FILE), featureSetsSource(slugs));
	writeFileSync(path.join(root, STATIC_EXAMPLES_INDEX_FILE), staticExamplesIndexSource(slugs));
	const total = components.reduce((sum: number, { features }: ComponentFeatures): number => sum + features.length, 0);
	process.stdout.write(`showcase features: ${String(components.length)} components, ${String(total)} features\n`);
}
