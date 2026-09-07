import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { discoverGeneratorModules } from "./discover-modules";
import type { AppProjectConfig } from "./project";
import {
	GENERATOR_MODULES_MANIFEST_RELATIVE_PATH,
	GeneratorModulesManifestSchema,
	type GeneratorModule,
	type GeneratorModulesManifest,
} from "../schema/generator-modules";

export interface LoadGeneratorModulesOptions {
	readonly seedIfMissing?: boolean;
	readonly refresh?: boolean;
}

export function generatorModulesManifestPath(rootDir: string): string {
	return path.join(rootDir, GENERATOR_MODULES_MANIFEST_RELATIVE_PATH);
}

export function buildGeneratorModulesManifest(rootDir: string): GeneratorModulesManifest {
	return {
		version: 1,
		modules: discoverGeneratorModules(rootDir),
	};
}

export async function writeGeneratorModulesManifest(rootDir: string, manifest: GeneratorModulesManifest): Promise<void> {
	const filePath = generatorModulesManifestPath(rootDir);
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export async function readGeneratorModulesManifest(rootDir: string): Promise<GeneratorModulesManifest | null> {
	const filePath = generatorModulesManifestPath(rootDir);
	if (!existsSync(filePath)) {
		return null;
	}
	const raw = await readFile(filePath, "utf8");
	const parsed = GeneratorModulesManifestSchema.safeParse(JSON.parse(raw));
	if (!parsed.success) {
		throw new Error(`Invalid generator modules manifest: ${parsed.error.message}`);
	}
	return parsed.data;
}

export async function loadGeneratorModules(
	config: AppProjectConfig,
	options: LoadGeneratorModulesOptions = {},
): Promise<GeneratorModulesManifest> {
	const seedIfMissing = options.seedIfMissing === true;
	const refresh = options.refresh === true;
	const existing = await readGeneratorModulesManifest(config.rootDir);

	if (refresh || (existing === null && seedIfMissing)) {
		const discovered = buildGeneratorModulesManifest(config.rootDir);
		if (discovered.modules.length === 0) {
			throw new Error("No UI panel modules were discovered under apps/. Check your monorepo layout.");
		}
		await writeGeneratorModulesManifest(config.rootDir, discovered);
		return discovered;
	}

	if (existing === null) {
		throw new Error(
			`Generator modules manifest not found at ${GENERATOR_MODULES_MANIFEST_RELATIVE_PATH}. Run "app init-modules" or "app doctor".`,
		);
	}

	return existing;
}

export function listUiModuleIds(manifest: GeneratorModulesManifest): string[] {
	return manifest.modules.map((module) => module.id);
}

export function resolveModulesForIr(
	manifest: GeneratorModulesManifest,
	uiModuleIds: readonly string[],
): GeneratorModule[] {
	const resolved: GeneratorModule[] = [];
	for (const moduleId of uiModuleIds) {
		const module = manifest.modules.find((entry) => entry.id === moduleId);
		if (module === undefined) {
			throw new Error(`Unknown UI module "${moduleId}". Update ${GENERATOR_MODULES_MANIFEST_RELATIVE_PATH}.`);
		}
		resolved.push(module);
	}
	return resolved;
}
