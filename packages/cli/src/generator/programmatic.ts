import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildPlanActions, planResourceFiles, type PlanAction } from "../core/planner";
import { collectManifestPaths, readManifest } from "../core/manifest";
import { loadGeneratorModules } from "../core/load-modules";
import { loadProjectConfig } from "../core/project";
import { generateResource, type GenerateResult } from "../generators/generate-resource";
import { normalizeResourceDefinition } from "../ir/normalize";
import type { ResourceIR } from "../ir/types";
import { loadAllResourceDefinitions } from "../parser/load-all-resource-definitions";
import { parseResourceDefinitionFile, parseResourceDefinitionSource } from "../parser/parse-resource-definition";
import type { WizardResourceInput } from "../schema/wizard-input";
import { WizardResourceInputSchema } from "../schema/wizard-input";
import { runPostGenerateValidation } from "../validation/post-generate";
import { buildResourceDefinition } from "../wizard/build-definition";
import { discoverExistingModels } from "../wizard/discover-models";
import { renderResourceDefinitionSource } from "../wizard/render-definition-source";
import type { DiscoveredModel } from "../wizard/types";
import { buildPlannedFileContents } from "./planned-file-content";
import { resolveRepoPath } from "../rollback/generator-paths";
import { rollbackResource } from "../rollback/apply-rollback";
import type {
	ResourceGeneratorActionCounts,
	ResourceGeneratorApplyResult,
	ResourceGeneratorListItem,
	ResourceGeneratorPreview,
	ResourceGeneratorSummary,
	ResourceGeneratorValidationStep,
	GenerationPlanFileDiff,
} from "./types";

export type {
	ResourceGeneratorActionCounts,
	ResourceGeneratorApplyResult,
	ResourceGeneratorListItem,
	ResourceGeneratorPreview,
	ResourceGeneratorSummary,
	ResourceGeneratorValidationStep,
	GenerationPlanFileDiff,
} from "./types";

const VALIDATION_STEP_LABELS: ["format", "lint", "typecheck"] = ["format", "lint", "typecheck"];

function countPlanActions(actions: readonly PlanAction[]): ResourceGeneratorActionCounts {
	let create = 0;
	let modify = 0;
	let skip = 0;
	let conflict = 0;
	for (const action of actions) {
		if (action.action === "create") {
			create += 1;
		} else if (action.action === "modify") {
			modify += 1;
		} else if (action.action === "skip") {
			skip += 1;
		} else {
			conflict += 1;
		}
	}
	return { create, modify, skip, conflict };
}

function resolveNavigationLabel(ir: ResourceIR): string {
	const firstModuleId = ir.scope.ui[0];
	if (firstModuleId === undefined) {
		return ir.resource.plural;
	}
	return ir.uiTargets[firstModuleId]?.navigation?.label ?? ir.resource.plural;
}

function summarizeResource(ir: ResourceIR): ResourceGeneratorSummary {
	return {
		name: ir.resource.name,
		slug: ir.resource.slug,
		modelName: ir.resource.modelName,
		navigationLabel: resolveNavigationLabel(ir),
		rls: ir.rls,
		fieldCount: ir.fields.length,
		relationCount: ir.relations.length,
		softDelete: ir.softDelete,
	};
}

export function listResourceGeneratorModels(cwd: string): Promise<readonly DiscoveredModel[]> {
	const config = loadProjectConfig(cwd);
	return Promise.resolve(discoverExistingModels(config.definitionsDir));
}

export interface GeneratorUiModuleListItem {
	readonly id: string;
	readonly resourceRouteTemplate: string;
}

export async function listGeneratorUiModules(cwd: string): Promise<readonly GeneratorUiModuleListItem[]> {
	const config = loadProjectConfig(cwd);
	const manifest = await loadGeneratorModules(config, { seedIfMissing: true });
	return manifest.modules.map((module) => ({
		id: module.id,
		resourceRouteTemplate: module.resourceRouteTemplate,
	}));
}

export async function listResourceDefinitions(cwd: string): Promise<readonly ResourceGeneratorListItem[]> {
	const config = loadProjectConfig(cwd);
	const modulesManifest = await loadGeneratorModules(config, { seedIfMissing: true });
	let entries: string[] = [];
	try {
		entries = await readdir(config.definitionsDir);
	} catch {
		return [];
	}

	const items: ResourceGeneratorListItem[] = [];
	for (const entry of entries.filter((file) => file.endsWith(".resource.ts"))) {
		const filePath = path.join(config.definitionsDir, entry);
		const source = await readFile(filePath, "utf8");
		const definition = parseResourceDefinitionFile(source, filePath);
		const ir = normalizeResourceDefinition(definition, { modules: modulesManifest.modules });
		items.push({
			slug: ir.resource.slug,
			contractKey: ir.resource.contractKey,
			label: resolveNavigationLabel(ir),
			fieldCount: ir.fields.length,
		});
	}

	return items.sort((left, right) => left.slug.localeCompare(right.slug));
}

export function parseWizardResourceInput(value: WizardResourceInput): WizardResourceInput {
	return WizardResourceInputSchema.parse(value);
}

export async function previewResourceGenerator(cwd: string, input: WizardResourceInput): Promise<ResourceGeneratorPreview> {
	const parsed = WizardResourceInputSchema.parse(input);
	const config = loadProjectConfig(cwd);
	const modulesManifest = await loadGeneratorModules(config, { seedIfMissing: true });
	const definition = buildResourceDefinition(parsed);
	const definitionSource = renderResourceDefinitionSource(definition);
	parseResourceDefinitionSource(definitionSource, "preview.resource.ts");
	const allDefinitions = await loadAllResourceDefinitions(config.definitionsDir);
	const ir = normalizeResourceDefinition(definition, { allDefinitions, modules: modulesManifest.modules });
	const planned = planResourceFiles(config, ir, modulesManifest);
	const existingManifest = await readManifest(config.rootDir, ir.resource.slug);
	const actions = buildPlanActions(planned, collectManifestPaths(existingManifest));
	const definitionPath = path.join(config.definitionsDir, `${ir.resource.slug}.resource.ts`);

	return {
		summary: summarizeResource(ir),
		definitionSource,
		definitionPath,
		definitionExists: existsSync(definitionPath),
		actions,
		actionCounts: countPlanActions(actions),
	};
}

export async function applyResourceGenerator(cwd: string, input: WizardResourceInput): Promise<ResourceGeneratorApplyResult> {
	const parsed = WizardResourceInputSchema.parse(input);
	const preview = await previewResourceGenerator(cwd, parsed);

	if (preview.definitionExists) {
		return {
			success: false,
			slug: preview.summary.slug,
			definitionPath: preview.definitionPath,
			writtenFiles: [],
			skippedFiles: [],
			validationSteps: [],
			error: `Definition already exists: ${preview.definitionPath}`,
		};
	}

	if (preview.actionCounts.conflict > 0) {
		return {
			success: false,
			slug: preview.summary.slug,
			definitionPath: preview.definitionPath,
			writtenFiles: [],
			skippedFiles: [],
			validationSteps: [],
			error: "Generation plan has conflicts. Resolve conflicts before applying.",
		};
	}

	const config = loadProjectConfig(cwd);
	const modulesManifest = await loadGeneratorModules(config, { seedIfMissing: true });
	const definition = buildResourceDefinition(parsed);
	const allDefinitions = await loadAllResourceDefinitions(config.definitionsDir);
	const ir = normalizeResourceDefinition(definition, { allDefinitions, modules: modulesManifest.modules });

	let generation: GenerateResult;
	try {
		generation = await generateResource(config, ir, modulesManifest, {
			dryRun: false,
			allowDestructive: false,
			runMigrate: false,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			slug: ir.resource.slug,
			definitionPath: preview.definitionPath,
			writtenFiles: [],
			skippedFiles: [],
			validationSteps: [],
			error: `Generation failed: ${message}`,
		};
	}

	const validationResults = await runPostGenerateValidation(config.rootDir, {
		useSpinner: false,
		resourceSlug: ir.resource.slug,
		writtenPaths: [...generation.writtenFiles, ...generation.patchedFiles],
	});

	const validationSteps: ResourceGeneratorValidationStep[] = validationResults.map((result, index) => ({
		label: VALIDATION_STEP_LABELS[index] ?? `step-${String(index + 1)}`,
		success: result.success,
		output: result.output,
	}));

	const validationFailed = validationResults.some((result) => !result.success);

	if (validationFailed) {
		try {
			await rollbackResource(config, ir.resource.slug, { dryRun: false, includeDefinition: false });
		} catch {
			// Best-effort rollback after validation failure.
		}
		return {
			success: false,
			slug: ir.resource.slug,
			definitionPath: preview.definitionPath,
			writtenFiles: generation.writtenFiles,
			skippedFiles: generation.skippedFiles,
			validationSteps,
			error: "Post-generation validation failed. Rolled back generated artifacts where possible.",
		};
	}

	await writeFile(preview.definitionPath, preview.definitionSource, "utf8");

	return {
		success: true,
		slug: ir.resource.slug,
		definitionPath: preview.definitionPath,
		writtenFiles: generation.writtenFiles,
		skippedFiles: generation.skippedFiles,
		validationSteps,
		error: null,
	};
}

async function readRepoFileIfExists(rootDir: string, relativePath: string): Promise<string> {
	const absolutePath = resolveRepoPath(rootDir, relativePath);
	if (!existsSync(absolutePath)) {
		return "";
	}
	const content = await readFile(absolutePath, "utf8");
	return content;
}

export async function previewGenerationPlanFileDiff(cwd: string, input: WizardResourceInput, filePath: string): Promise<GenerationPlanFileDiff> {
	const parsed = WizardResourceInputSchema.parse(input);
	const config = loadProjectConfig(cwd);
	const modulesManifest = await loadGeneratorModules(config, { seedIfMissing: true });
	const definition = buildResourceDefinition(parsed);
	const allDefinitions = await loadAllResourceDefinitions(config.definitionsDir);
	const ir = normalizeResourceDefinition(definition, { allDefinitions, modules: modulesManifest.modules });
	const normalizedPath = filePath.split(path.sep).join("/");
	const plannedContents = buildPlannedFileContents(ir, modulesManifest);
	const after = plannedContents[normalizedPath];
	if (after === undefined) {
		throw new Error(`No generated content available for ${normalizedPath}.`);
	}
	const before = await readRepoFileIfExists(config.rootDir, normalizedPath);
	return {
		path: normalizedPath,
		before,
		after,
	};
}
