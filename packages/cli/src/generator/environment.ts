import { existsSync } from "node:fs";
import path from "node:path";

import { buildGeneratorModulesManifest, loadGeneratorModules, writeGeneratorModulesManifest } from "../core/load-modules";
import { loadProjectConfig } from "../core/project";
import { isCliEslintConfigValid } from "../generators/workspace/ensure-cli-eslint-config";
import { GENERATOR_MODULES_MANIFEST_RELATIVE_PATH } from "../schema/generator-modules";
import type { GeneratorDoctorResult, InitGeneratorModulesResult } from "./types";

export async function runGeneratorDoctor(cwd: string): Promise<GeneratorDoctorResult> {
	const config = loadProjectConfig(cwd);
	const cliEslintOk = await isCliEslintConfigValid(config.rootDir);

	let modulesOk = false;
	let modulesDetail = GENERATOR_MODULES_MANIFEST_RELATIVE_PATH;
	try {
		const modules = await loadGeneratorModules(config, { seedIfMissing: true });
		modulesOk = modules.modules.length > 0;
		modulesDetail = `${String(modules.modules.length)} module(s): ${modules.modules.map((module) => module.id).join(", ")}`;
	} catch {
		modulesOk = false;
	}

	const checks = [
		{ label: "NestJS API", ok: existsSync(config.apiDir), detail: config.apiDir },
		{ label: "Prisma schema", ok: existsSync(config.prismaSchemaPath), detail: config.prismaSchemaPath },
		{ label: "Next.js admin", ok: existsSync(config.adminDir), detail: config.adminDir },
		{ label: "Generator UI modules", ok: modulesOk, detail: modulesDetail },
		{
			label: "Shared contracts",
			ok: existsSync(path.join(config.sharedDir, "src/contracts/index.ts")),
			detail: path.join(config.sharedDir, "src/contracts"),
		},
		{
			label: "Client router",
			ok: existsSync(path.join(config.clientDir, "src/lib/api/endpoints.ts")),
			detail: path.join(config.clientDir, "src/lib/api"),
		},
		{ label: "Resource definitions", ok: existsSync(config.definitionsDir), detail: config.definitionsDir },
		{
			label: "CLI eslint config",
			ok: cliEslintOk,
			detail: path.join(config.rootDir, "packages/cli/eslint.config.js"),
		},
	];

	const success = checks.every((check) => check.ok);
	return { success, checks };
}

export async function initGeneratorModules(cwd: string): Promise<InitGeneratorModulesResult> {
	const config = loadProjectConfig(cwd);
	const manifest = buildGeneratorModulesManifest(config.rootDir);

	if (manifest.modules.length === 0) {
		return {
			success: false,
			modules: [],
			manifestPath: GENERATOR_MODULES_MANIFEST_RELATIVE_PATH,
			error: "No UI panel modules were discovered under apps/.",
		};
	}

	await writeGeneratorModulesManifest(config.rootDir, manifest);

	return {
		success: true,
		modules: manifest.modules.map((module) => ({
			id: module.id,
			resourceRouteTemplate: module.resourceRouteTemplate,
		})),
		manifestPath: GENERATOR_MODULES_MANIFEST_RELATIVE_PATH,
		error: null,
	};
}
