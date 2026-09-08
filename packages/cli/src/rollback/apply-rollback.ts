import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import { loadGeneratorModules } from "../core/load-modules";
import type { AppProjectConfig } from "../core/project";
import { normalizeResourceDefinition } from "../ir/normalize";
import { parseResourceDefinitionFile } from "../parser/parse-resource-definition";
import { dropRollbackGitStash, readRollbackRecord, removeRollbackArtifacts } from "./prepare-rollback";
import { buildRollbackPlan, type BuildRollbackPlanOptions } from "./plan-rollback";
import type { RollbackPlan, RollbackPlanStep } from "./rollback-schema";
import { resolveRepoPath, validateResourceSlug } from "./generator-paths";
import { unpatchSharedFiles } from "./unpatch-shared";

export interface ApplyRollbackOptions extends BuildRollbackPlanOptions {
	readonly dryRun: boolean;
}

export interface ApplyRollbackResult {
	readonly plan: RollbackPlan;
	readonly applied: boolean;
}

async function applyRollbackStep(config: AppProjectConfig, step: RollbackPlanStep): Promise<void> {
	if (step.action === "unpatch") {
		return;
	}
	const absolutePath = resolveRepoPath(config.rootDir, step.path);
	if (step.action === "delete") {
		if (existsSync(absolutePath)) {
			await rm(absolutePath, { force: true });
		}
		return;
	}
	if (existsSync(absolutePath)) {
		await rm(absolutePath, { recursive: true, force: true });
	}
}

export async function rollbackResource(config: AppProjectConfig, slug: string, options: ApplyRollbackOptions): Promise<ApplyRollbackResult> {
	const safeSlug = validateResourceSlug(slug);
	const plan = await buildRollbackPlan(config, safeSlug, options);
	if (!plan.canRollback) {
		return { plan, applied: false };
	}
	if (options.dryRun) {
		return { plan, applied: false };
	}

	const record = await readRollbackRecord(config, safeSlug);
	const definitionPath = path.join(config.definitionsDir, `${safeSlug}.resource.ts`);

	if (existsSync(definitionPath)) {
		try {
			const modulesManifest = await loadGeneratorModules(config);
			const source = await readFile(definitionPath, "utf8");
			const definition = parseResourceDefinitionFile(source, definitionPath);
			const ir = normalizeResourceDefinition(definition, { modules: modulesManifest.modules });
			await unpatchSharedFiles(config, ir, modulesManifest);
		} catch (error) {
			const detail = error instanceof Error ? error.message : "unknown error";
			throw new Error(`Failed to unpatch shared files for ${safeSlug}: ${detail}`);
		}
	}

	const otherSteps = plan.steps.filter((step) => step.action !== "unpatch");
	for (const step of otherSteps) {
		await applyRollbackStep(config, step);
	}

	if (record !== null) {
		await dropRollbackGitStash(config, record);
	}
	await removeRollbackArtifacts(config, safeSlug);

	const snapshotDir = resolveRepoPath(config.rootDir, `.app/snapshots/${safeSlug}`);
	if (existsSync(snapshotDir)) {
		await rm(snapshotDir, { recursive: true, force: true });
	}

	return { plan, applied: true };
}

export function previewResourceRollback(config: AppProjectConfig, slug: string, options: BuildRollbackPlanOptions): Promise<RollbackPlan> {
	const safeSlug = validateResourceSlug(slug);
	return buildRollbackPlan(config, safeSlug, options);
}
