// The showcase's features and Do / Don't pairs, read from each component's
// folder (`<examples>/<slug>/`):
//
// - features.json: one entry per feature (its id — the web example it mirrors —
//   its label, a description, the example file and its export), in order;
// - guidelines.json: the Do / Don't pairs, each side with its text and a live
//   example (file and export).
//
// From them the generator writes, per component, one module holding every
// example (loaded only when its screen opens), the feature index (plain data
// for the search and the index screen) and the feature sets (every component's
// module behind a dynamic import).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { z } from "zod";

import type { ShowcaseLayout } from "./layout.ts";

export const FEATURE_MANIFEST = "features.json";
export const GUIDELINES_MANIFEST = "guidelines.json";
const EXAMPLE_FILE_SUFFIX = ".tsx";
/** Bounds that keep a hand-edited manifest honest. */
const MAX_LABEL_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 320;
const MAX_GUIDELINE_TITLE_LENGTH = 80;
const MAX_GUIDELINE_TEXT_LENGTH = 240;
/** Every component shows at least this many Do / Don't pairs. */
export const MIN_GUIDELINES = 2;
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const PASCAL_EXPORT = /^[A-Z][A-Za-z0-9]*$/u;

const ExampleReferenceSchema = z.object({
	file: z.string().regex(KEBAB),
	export: z.string().regex(PASCAL_EXPORT),
});

const FeatureManifestSchema = z
	.array(
		ExampleReferenceSchema.extend({
			id: z.string().regex(/^c-[a-z0-9-]+$/u),
			label: z.string().trim().min(1).max(MAX_LABEL_LENGTH),
			description: z.string().trim().min(1).max(MAX_DESCRIPTION_LENGTH),
		}),
	)
	.min(1);

const GuidelineSideSchema = ExampleReferenceSchema.extend({ text: z.string().trim().min(1).max(MAX_GUIDELINE_TEXT_LENGTH) });

const GuidelinesManifestSchema = z
	.array(
		z.strictObject({
			title: z.string().trim().min(1).max(MAX_GUIDELINE_TITLE_LENGTH),
			do: GuidelineSideSchema,
			dont: GuidelineSideSchema,
		}),
	)
	.min(MIN_GUIDELINES);

export type FeatureManifest = z.output<typeof FeatureManifestSchema>;
type FeatureManifestEntry = FeatureManifest[number];
export type GuidelinesManifest = z.output<typeof GuidelinesManifestSchema>;
type GuidelineSideEntry = z.output<typeof GuidelineSideSchema>;

/** An example the generated module imports: its file, export and exact source. */
export interface ExampleFile {
	readonly file: string;
	readonly export: string;
	readonly source: string;
}

/** One feature with everything the generated modules need. */
export interface GeneratedFeature extends ExampleFile {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly anchor: string;
}

export interface GeneratedGuidelineSide extends ExampleFile {
	readonly text: string;
}

export interface GeneratedGuideline {
	readonly title: string;
	readonly do: GeneratedGuidelineSide;
	readonly dont: GeneratedGuidelineSide;
}

/** One component's folder: its features, in manifest order, and its Do / Don't pairs. */
export interface ComponentFeatures {
	readonly slug: string;
	readonly features: readonly GeneratedFeature[];
	readonly guidelines: readonly GeneratedGuideline[];
}

/** `data-grid` → `DataGrid`. */
export function pascalCaseOf(kebab: string): string {
	return kebab
		.split("-")
		.map((part: string): string => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join("");
}

/** `data-grid` → `DATA_GRID`. */
export function constantCaseOf(kebab: string): string {
	return kebab.toUpperCase().replace(/-/gu, "_");
}

/** Anchors for `labels`, made unique within one component (`basic`, `basic-2`). */
export function uniqueAnchors(labels: readonly string[], anchorOf: (label: string) => string): string[] {
	const seen = new Map<string, number>();
	return labels.map((label: string): string => {
		const base = anchorOf(label);
		const count = (seen.get(base) ?? 0) + 1;
		seen.set(base, count);
		return count === 1 ? base : `${base}-${String(count)}`;
	});
}

function parsed<T>(schema: z.ZodType<T>, json: string, file: string): T {
	const result = schema.safeParse(JSON.parse(json));
	if (!result.success) {
		throw new Error(`${file}: ${result.error.message}`);
	}
	return result.data;
}

/** Parses a folder's features manifest: a malformed one fails the build with the file named. */
export function parseManifest(file: string, json: string): FeatureManifest {
	return parsed(FeatureManifestSchema, json, file);
}

/** Parses a folder's Do / Don't manifest. */
export function parseGuidelines(file: string, json: string): GuidelinesManifest {
	return parsed(GuidelinesManifestSchema, json, file);
}

/** The component folders (one per slug), sorted. */
export function componentSlugs(layout: ShowcaseLayout): string[] {
	return readdirSync(path.join(layout.appRoot, layout.examplesDir), { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && entry.name !== "__tests__")
		.map((entry) => entry.name)
		.sort();
}

function exampleOf(folder: string, folderLabel: string, reference: z.output<typeof ExampleReferenceSchema>): ExampleFile {
	const file = path.join(folder, `${reference.file}${EXAMPLE_FILE_SUFFIX}`);
	if (!existsSync(file)) {
		throw new Error(`${folderLabel}: names ${reference.file}${EXAMPLE_FILE_SUFFIX}, which does not exist`);
	}
	return { file: reference.file, export: reference.export, source: readFileSync(file, "utf8") };
}

/** One component's features and guidelines, read from its folder. */
export function readComponent(layout: ShowcaseLayout, slug: string): ComponentFeatures {
	const folderLabel = `${layout.examplesDir}/${slug}`;
	const folder = path.join(layout.appRoot, layout.examplesDir, slug);
	const manifest = parseManifest(`${folderLabel}/${FEATURE_MANIFEST}`, readFileSync(path.join(folder, FEATURE_MANIFEST), "utf8"));
	const anchors = uniqueAnchors(
		manifest.map((entry: FeatureManifestEntry): string => entry.label),
		layout.anchorOf,
	);
	const features = manifest.map((entry: FeatureManifestEntry, position: number): GeneratedFeature => ({
		...exampleOf(folder, folderLabel, entry),
		id: entry.id,
		label: entry.label,
		description: entry.description,
		anchor: anchors.at(position) ?? layout.anchorOf(entry.label),
	}));
	const guidelinesFile = path.join(folder, GUIDELINES_MANIFEST);
	const sideOf = (side: GuidelineSideEntry): GeneratedGuidelineSide => ({ ...exampleOf(folder, folderLabel, side), text: side.text });
	const guidelines = existsSync(guidelinesFile)
		? parseGuidelines(`${folderLabel}/${GUIDELINES_MANIFEST}`, readFileSync(guidelinesFile, "utf8")).map((guideline): GeneratedGuideline => ({
				title: guideline.title,
				do: sideOf(guideline.do),
				dont: sideOf(guideline.dont),
			}))
		: [];
	return { slug, features, guidelines };
}

/** Every component folder's features and guidelines, sorted by slug. */
export function readComponents(layout: ShowcaseLayout): ComponentFeatures[] {
	return componentSlugs(layout).map((slug: string): ComponentFeatures => readComponent(layout, slug));
}

/** Every example file a component's module imports: its features', then its guidelines' (each file once). */
export function examplesOf({ features, guidelines }: ComponentFeatures): ExampleFile[] {
	const all = [...features, ...guidelines.flatMap((guideline: GeneratedGuideline): GeneratedGuidelineSide[] => [guideline.do, guideline.dont])];
	const seen = new Set<string>();
	return all.filter((example: ExampleFile): boolean => {
		if (seen.has(example.file)) {
			return false;
		}
		seen.add(example.file);
		return true;
	});
}

const GENERATED_HEADER = "// GENERATED by the showcase generator — do not edit by hand.";

/** The feature index module: every component's feature summaries (plain data). */
export function featureIndexSource(components: readonly ComponentFeatures[]): string {
	const entries = components.map(({ slug, features }: ComponentFeatures): string => {
		const rows = features.map(
			(feature: GeneratedFeature): string => `{ id: ${JSON.stringify(feature.id)}, label: ${JSON.stringify(feature.label)}, anchor: ${JSON.stringify(feature.anchor)} }`,
		);
		return `\t[${JSON.stringify(slug)}, [${rows.join(", ")}]],`;
	});
	return `${GENERATED_HEADER}
// Every component's features (examples/<component>/${FEATURE_MANIFEST}), in order. Plain data.

import type { ShowcaseFeatureSummary } from "../showcase-feature";

export const SHOWCASE_FEATURE_INDEX: ReadonlyMap<string, readonly ShowcaseFeatureSummary[]> = new Map<string, readonly ShowcaseFeatureSummary[]>([
${entries.join("\n")}
]);
`;
}

function sideSource(side: GeneratedGuidelineSide): string {
	return `{ text: ${JSON.stringify(side.text)}, file: ${JSON.stringify(side.file)}, source: ${JSON.stringify(side.source)}, render: (): React.JSX.Element => <${side.export} /> }`;
}

/** One component's module: its features' live examples and sources, and its Do / Don't pairs. */
export function componentModuleSource(component: ComponentFeatures): string {
	const imports = examplesOf(component).map((example: ExampleFile): string => `import { ${example.export} } from "../../examples/${component.slug}/${example.file}";`);
	const features = component.features.map(
		(feature: GeneratedFeature): string =>
			`\t\t{ id: ${JSON.stringify(feature.id)}, label: ${JSON.stringify(feature.label)}, anchor: ${JSON.stringify(feature.anchor)}, description: ${JSON.stringify(feature.description)}, file: ${JSON.stringify(feature.file)}, source: ${JSON.stringify(feature.source)}, render: (): React.JSX.Element => <${feature.export} /> },`,
	);
	const guidelines = component.guidelines.map(
		(guideline: GeneratedGuideline): string => `\t\t{ title: ${JSON.stringify(guideline.title)}, do: ${sideSource(guideline.do)}, dont: ${sideSource(guideline.dont)} },`,
	);
	return `${GENERATED_HEADER}
// The ${component.slug} component's features and Do / Don't pairs: evaluated only when its screen opens.

import type * as React from "react";

import type { ShowcaseComponentModule } from "../../showcase-feature";
${imports.join("\n")}

export const SHOWCASE_COMPONENT: ShowcaseComponentModule = {
	features: [
${features.join("\n")}
	],
	guidelines: [
${guidelines.join("\n")}
	],
};
`;
}

/** The feature-sets module: every component's module behind a dynamic import, keyed by slug. */
export function featureSetsSource(slugs: readonly string[]): string {
	const entries = slugs.map(
		(slug: string): string => `\t[${JSON.stringify(slug)}, async (): Promise<ShowcaseComponentModule> => (await import("./components/${slug}")).SHOWCASE_COMPONENT],`,
	);
	return `${GENERATED_HEADER}
// Every component's module, keyed by its slug: a component's examples are evaluated only when its screen opens.

import type { ShowcaseComponentModule } from "../showcase-feature";

export type LoadShowcaseComponent = () => Promise<ShowcaseComponentModule>;

export const SHOWCASE_FEATURE_SETS: ReadonlyMap<string, LoadShowcaseComponent> = new Map<string, LoadShowcaseComponent>([
${entries.join("\n")}
]);
`;
}
