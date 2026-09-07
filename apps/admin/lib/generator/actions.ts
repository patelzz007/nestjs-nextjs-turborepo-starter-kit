"use server";

import "server-only";

import type {
	DiscoveredModel,
	GeneratorDoctorResult,
	GeneratorUiModuleListItem,
	GenerationPlanFileDiff,
	ResourceGeneratorApplyResult,
	ResourceGeneratorListItem,
	ResourceGeneratorPreview,
	InitGeneratorModulesResult,
	RollbackApplyResult,
	RollbackPlan,
	WizardResourceInput,
} from "@workspace/cli/generator";
import {
	applyResourceGenerator,
	initGeneratorModules,
	listGeneratorUiModules,
	listResourceDefinitions,
	listResourceGeneratorModels,
	previewGenerationPlanFileDiff,
	previewResourceGenerator,
	previewResourceRollbackFromCwd,
	rollbackResourceFromCwd,
	runGeneratorDoctor,
} from "@workspace/cli/generator/server";

import { assertGeneratorAccess } from "./guard";

export async function fetchGeneratorModelsAction(): Promise<readonly DiscoveredModel[]> {
	await assertGeneratorAccess();
	const models = await listResourceGeneratorModels(process.cwd());
	return models;
}

export async function fetchGeneratorUiModulesAction(): Promise<readonly GeneratorUiModuleListItem[]> {
	await assertGeneratorAccess();
	const modules = await listGeneratorUiModules(process.cwd());
	return modules;
}

export async function fetchGeneratorResourcesAction(): Promise<readonly ResourceGeneratorListItem[]> {
	await assertGeneratorAccess();
	const resources = await listResourceDefinitions(process.cwd());
	return resources;
}

export async function previewGeneratorResourceAction(input: WizardResourceInput): Promise<ResourceGeneratorPreview> {
	await assertGeneratorAccess();
	const preview = await previewResourceGenerator(process.cwd(), input);
	return preview;
}

export async function applyGeneratorResourceAction(input: WizardResourceInput): Promise<ResourceGeneratorApplyResult> {
	await assertGeneratorAccess();
	const result = await applyResourceGenerator(process.cwd(), input);
	return result;
}

export async function fetchGenerationPlanDiffAction(input: WizardResourceInput, filePath: string): Promise<GenerationPlanFileDiff> {
	await assertGeneratorAccess();
	const diff = await previewGenerationPlanFileDiff(process.cwd(), input, filePath);
	return diff;
}

export async function previewResourceRollbackAction(slug: string, includeDefinition: boolean): Promise<RollbackPlan> {
	await assertGeneratorAccess();
	const plan = await previewResourceRollbackFromCwd(process.cwd(), slug, { includeDefinition });
	return plan;
}

export async function applyResourceRollbackAction(slug: string, includeDefinition: boolean, dryRun = false): Promise<RollbackApplyResult> {
	await assertGeneratorAccess();
	const result = await rollbackResourceFromCwd(process.cwd(), slug, { dryRun, includeDefinition });
	return result;
}

export async function runGeneratorDoctorAction(): Promise<GeneratorDoctorResult> {
	await assertGeneratorAccess();
	const result = await runGeneratorDoctor(process.cwd());
	return result;
}

export async function runInitGeneratorModulesAction(): Promise<InitGeneratorModulesResult> {
	await assertGeneratorAccess();
	const result = await initGeneratorModules(process.cwd());
	return result;
}
