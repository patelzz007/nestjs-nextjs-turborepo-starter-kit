import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { manifestPath, readManifest } from "../core/manifest";
import { loadGeneratorModules } from "../core/load-modules";
import type { AppProjectConfig } from "../core/project";
import { normalizeResourceDefinition } from "../ir/normalize";
import { parseResourceDefinitionFile } from "../parser/parse-resource-definition";
import { definitionRelativePath, normalizeRepoRelativePath, resourceModuleRelativeDir, resourceUiRelativeDirs } from "./generator-paths";
import { readRollbackRecord } from "./prepare-rollback";
import type { RollbackPlan, RollbackPlanStep } from "./rollback-schema";

export interface BuildRollbackPlanOptions {
	readonly includeDefinition: boolean;
}

export async function buildRollbackPlan(config: AppProjectConfig, slug: string, options: BuildRollbackPlanOptions): Promise<RollbackPlan> {
	const warnings: string[] = [];
	const steps: RollbackPlanStep[] = [];
	const record = await readRollbackRecord(config, slug);
	const manifest = await readManifest(config.rootDir, slug);

	if (record === null && manifest === null) {
		return {
			resource: slug,
			steps: [],
			warnings: [`No rollback metadata or manifest found for "${slug}".`],
			canRollback: false,
		};
	}

	steps.push({
		action: "unpatch",
		path: ".",
		reason: "Remove generator blocks from shared patched files",
	});

	const filesToDelete = new Set<string>();
	if (manifest !== null) {
		for (const relativePath of Object.keys(manifest.files)) {
			filesToDelete.add(normalizeRepoRelativePath(relativePath));
		}
	}
	if (record !== null) {
		for (const relativePath of record.trackedFiles) {
			filesToDelete.add(normalizeRepoRelativePath(relativePath));
		}
	}

	for (const relativePath of [...filesToDelete].sort((left, right) => left.localeCompare(right))) {
		const absolutePath = path.join(config.rootDir, relativePath);
		if (existsSync(absolutePath)) {
			steps.push({
				action: "delete",
				path: relativePath,
				reason: "Remove generator-created resource file",
			});
		}
	}

	const moduleDir = resourceModuleRelativeDir(slug);
	if (existsSync(path.join(config.rootDir, moduleDir))) {
		steps.push({
			action: "remove-directory",
			path: moduleDir,
			reason: "Remove API module directory",
		});
	}

	try {
		const modulesManifest = await loadGeneratorModules(config);
		const definitionPath = path.join(config.definitionsDir, `${slug}.resource.ts`);
		if (existsSync(definitionPath)) {
			const source = await readFile(definitionPath, "utf8");
			const definition = parseResourceDefinitionFile(source, definitionPath);
			const ir = normalizeResourceDefinition(definition, { modules: modulesManifest.modules });
			for (const uiDir of resourceUiRelativeDirs(ir, modulesManifest)) {
				if (existsSync(path.join(config.rootDir, uiDir))) {
					steps.push({
						action: "remove-directory",
						path: uiDir,
						reason: "Remove UI panel directory",
					});
				}
			}
		}
	} catch (error) {
		const detail = error instanceof Error ? error.message : "unknown error";
		warnings.push(`Could not resolve UI module directories from the generator manifest: ${detail}`);
	}

	const manifestRelativePath = normalizeRepoRelativePath(path.relative(config.rootDir, manifestPath(config.rootDir, slug)));
	if (existsSync(path.join(config.rootDir, manifestRelativePath))) {
		steps.push({
			action: "delete",
			path: manifestRelativePath,
			reason: "Remove generator manifest",
		});
	}

	const rollbackRelativePath = normalizeRepoRelativePath(path.join(".app", "rollback", `${slug}.json`));
	if (existsSync(path.join(config.rootDir, rollbackRelativePath))) {
		steps.push({
			action: "delete",
			path: rollbackRelativePath,
			reason: "Remove rollback metadata",
		});
	}

	const snapshotRelativePath = normalizeRepoRelativePath(path.join(".app", "snapshots", slug, "initial-shared-patches.json"));
	if (existsSync(path.join(config.rootDir, snapshotRelativePath))) {
		steps.push({
			action: "delete",
			path: snapshotRelativePath,
			reason: "Remove rollback snapshot",
		});
	}

	if (options.includeDefinition) {
		const definitionPath = definitionRelativePath(config, slug);
		if (existsSync(path.join(config.rootDir, definitionPath))) {
			steps.push({
				action: "delete",
				path: definitionPath,
				reason: "Remove resource definition file",
			});
		}
	}

	if (record !== null && record.gitStashRef !== null) {
		warnings.push(`Will attempt to drop git stash ${record.gitStashRef} after rollback (non-fatal if already removed).`);
	}

	warnings.push("Database migrations are not reverted. Run prisma migrate manually if needed.");

	return {
		resource: slug,
		steps,
		warnings,
		canRollback: steps.length > 0,
	};
}
