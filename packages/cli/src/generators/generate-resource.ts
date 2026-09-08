import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { resolveWorkspaceBin } from "../core/resolve-workspace-bin";

import { resolveModuleResourceDir } from "../core/discover-modules";
import { resolveModulesForIr } from "../core/load-modules";
import type { GeneratorModule, GeneratorModulesManifest } from "../schema/generator-modules";
import type { ResourceIR } from "../ir/types";
import { withActiveUiModule } from "../ir/ui-context";
import type { AppProjectConfig } from "../core/project";
import { GENERATOR_VERSION, hashContent, writeManifest, type ResourceManifest } from "../core/manifest";
import { planResourceFiles } from "../core/planner";
import { finalizeResourceGeneration, prepareResourceGeneration } from "../rollback/prepare-rollback";
import { listSharedPatchRelativePaths } from "../rollback/generator-paths";
import { renderPrismaModelBlock, renderRlsBlock } from "./prisma/render-prisma";
import { renderZodSchemas } from "./contracts/render-zod";
import { renderNestRepository } from "./nestjs/render-repository";
import { renderNestServiceBase } from "./nestjs/render-service-base";
import { renderNestServiceWrapper } from "./nestjs/render-service";
import { renderNestControllerBase } from "./nestjs/render-controller-base";
import { renderNestControllerWrapper } from "./nestjs/render-controller";
import { renderNestModule } from "./nestjs/render-module";
import { renderAdminView } from "./admin/render-view";
import { renderAdminPage } from "./admin/render-page";
import { renderAdminDetailPage } from "./admin/render-detail-page";
import { renderAdminDetailView } from "./admin/render-detail-view";
import { renderAdminCreatePage } from "./admin/render-create-page";
import { renderAdminEditPage } from "./admin/render-edit-page";
import { renderServiceTest } from "./tests/render-service-test";
import { renderRepositoryTest } from "./tests/render-repository-test";
import { renderAdminViewTest } from "./tests/render-admin-view-test";
import { patchPrismaSchema } from "./prisma/patch-schema";
import { patchRlsSql } from "./prisma/patch-rls";
import { patchPermissionEnum } from "./contracts/patch-permissions";
import { patchApiRoutes } from "./contracts/patch-api-routes";
import { patchContractsIndex } from "./contracts/patch-contracts";
import { patchEndpoints } from "./client/patch-endpoints";
import { patchSchemasIndex } from "./contracts/patch-schemas-index";
import { patchVersionedRoutes } from "./contracts/patch-versioned-routes";
import { patchAppModule } from "./nestjs/patch-app-module";
import { patchSidebarMenu } from "./admin/patch-sidebar-menu";

export interface GenerateOptions {
	readonly dryRun: boolean;
	readonly allowDestructive: boolean;
	readonly runMigrate: boolean;
}

export interface GenerateResult {
	readonly writtenFiles: readonly string[];
	readonly patchedFiles: readonly string[];
	readonly skippedFiles: readonly string[];
	readonly manualFollowUps: readonly string[];
}

async function writeFileEnsuringDir(filePath: string, content: string): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, content, "utf8");
}

function shouldWrite(ownership: "generated" | "scaffolded", exists: boolean): boolean {
	if (ownership === "generated") {
		return true;
	}
	return !exists;
}

async function runSharedPackageBuild(repoRoot: string): Promise<void> {
	const turboBin = resolveWorkspaceBin(repoRoot, "turbo");
	await new Promise<void>((resolve, reject) => {
		const child = spawn(turboBin, ["run", "build", "--filter=@workspace/shared"], {
			cwd: repoRoot,
			stdio: "inherit",
			shell: false,
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(`@workspace/shared build failed with exit code ${String(code)}`));
		});
	});
}

function buildUiFileContents(ir: ResourceIR, uiModule: GeneratorModule): Record<string, string> {
	const moduleIr = withActiveUiModule(ir, uiModule);
	const slug = ir.resource.slug;
	const resourceDir = resolveModuleResourceDir(uiModule, slug);
	return {
		[`${resourceDir}/${slug}-view.generated.tsx`]: renderAdminView(moduleIr),
		[`${resourceDir}/page.tsx`]: renderAdminPage(moduleIr),
		[`${resourceDir}/${slug}-detail-view.generated.tsx`]: renderAdminDetailView(moduleIr),
		[`${resourceDir}/[id]/page.tsx`]: renderAdminDetailPage(moduleIr),
		[`${resourceDir}/__tests__/${slug}-view.test.tsx`]: renderAdminViewTest(moduleIr),
	};
}

function buildUiScaffoldContents(ir: ResourceIR, uiModule: GeneratorModule): Record<string, string> {
	const moduleIr = withActiveUiModule(ir, uiModule);
	const slug = ir.resource.slug;
	const resourceDir = resolveModuleResourceDir(uiModule, slug);
	return {
		[`${resourceDir}/create/page.tsx`]: renderAdminCreatePage(moduleIr),
		[`${resourceDir}/[id]/edit/page.tsx`]: renderAdminEditPage(moduleIr),
	};
}

export async function generateResource(
	config: AppProjectConfig,
	ir: ResourceIR,
	modulesManifest: GeneratorModulesManifest,
	options: GenerateOptions,
): Promise<GenerateResult> {
	const planned = planResourceFiles(config, ir, modulesManifest);
	const writtenFiles: string[] = [];
	const patchedFiles: string[] = [];
	const skippedFiles: string[] = [];
	const manualFollowUps: string[] = [];
	const manifestFiles: ResourceManifest["files"] = {};

	const moduleName = ir.resource.slug;
	const slug = ir.resource.slug;
	const uiModules = resolveModulesForIr(modulesManifest, ir.scope.ui);

	if (!options.dryRun) {
		await prepareResourceGeneration(config, ir, modulesManifest);
	}

	const fileContents: Record<string, string> = {};

	if (ir.scope.api) {
		fileContents[`apps/api/src/modules/${moduleName}/${moduleName}.repository.generated.ts`] = renderNestRepository(ir);
		fileContents[`apps/api/src/modules/${moduleName}/${moduleName}.service.generated.ts`] = renderNestServiceBase(ir);
		fileContents[`apps/api/src/modules/${moduleName}/${moduleName}.controller.generated.ts`] = renderNestControllerBase(ir);
		fileContents[`apps/api/src/modules/${moduleName}/__tests__/${moduleName}.repository.spec.ts`] = renderRepositoryTest(ir);
	}

	if (ir.scope.shared) {
		fileContents[`packages/shared/src/schemas/domain/${slug}.generated.ts`] = renderZodSchemas(ir);
	}

	for (const uiModule of uiModules) {
		Object.assign(fileContents, buildUiFileContents(ir, uiModule));
	}

	const scaffoldContents: Record<string, string> = {};

	if (ir.scope.api) {
		scaffoldContents[`apps/api/src/modules/${moduleName}/${moduleName}.module.ts`] = renderNestModule(ir);
		scaffoldContents[`apps/api/src/modules/${moduleName}/${moduleName}.service.ts`] = renderNestServiceWrapper(ir);
		scaffoldContents[`apps/api/src/modules/${moduleName}/${moduleName}.controller.ts`] = renderNestControllerWrapper(ir);
		scaffoldContents[`apps/api/src/modules/${moduleName}/__tests__/${moduleName}.service.spec.ts`] = renderServiceTest(ir);
	}

	for (const uiModule of uiModules) {
		Object.assign(scaffoldContents, buildUiScaffoldContents(ir, uiModule));
	}

	for (const plannedFile of planned) {
		const generated = fileContents[plannedFile.relativePath];
		const scaffold = scaffoldContents[plannedFile.relativePath];
		const content = generated ?? scaffold;
		if (content === undefined) {
			continue;
		}

		let exists = false;
		try {
			await readFile(plannedFile.absolutePath, "utf8");
			exists = true;
		} catch {
			exists = false;
		}

		if (!shouldWrite(plannedFile.ownership, exists)) {
			skippedFiles.push(plannedFile.relativePath);
			continue;
		}

		if (!options.dryRun) {
			await writeFileEnsuringDir(plannedFile.absolutePath, content);
		}
		writtenFiles.push(plannedFile.relativePath);
		manifestFiles[plannedFile.relativePath] = {
			template: plannedFile.template,
			hash: hashContent(content),
			ownership: plannedFile.ownership,
		};
	}

	if (!options.dryRun) {
		if (ir.scope.api) {
			patchedFiles.push("apps/api/prisma/schema.prisma", "apps/api/prisma/rls.sql", "apps/api/src/app.module.ts");
			const prismaBlock = renderPrismaModelBlock(ir);
			const rlsBlock = renderRlsBlock(ir);
			await patchPrismaSchema(config.prismaSchemaPath, ir, prismaBlock, options);
			await patchRlsSql(config.rlsSqlPath, ir, rlsBlock);
			await patchAppModule(path.join(config.apiDir, "src/app.module.ts"), ir);
		}

		if (ir.scope.shared) {
			patchedFiles.push(...listSharedPatchRelativePaths(ir, modulesManifest));
			await patchPermissionEnum(path.join(config.sharedDir, "src/schemas/domain/enums.ts"), ir);
			await patchApiRoutes(path.join(config.sharedDir, "src/api-routes.ts"), ir);
			await patchContractsIndex(path.join(config.sharedDir, "src/contracts/index.ts"), ir);
			await patchSchemasIndex(path.join(config.sharedDir, "src/schemas/index.ts"), ir);
			await patchVersionedRoutes(path.join(config.sharedDir, "src/contracts/versioning.ts"), ir);
		}

		if (ir.scope.client) {
			patchedFiles.push("packages/client/src/lib/api/endpoints.ts");
			await patchEndpoints(path.join(config.clientDir, "src/lib/api/endpoints.ts"), ir);
		}

		for (const uiModule of uiModules) {
			const moduleIr = withActiveUiModule(ir, uiModule);
			const menuPath = path.join(config.rootDir, uiModule.sidebarMenuPath);
			patchedFiles.push(uiModule.sidebarMenuPath);
			await patchSidebarMenu(menuPath, moduleIr, uiModule.routePrefix);
		}

		if (ir.scope.shared) {
			await runSharedPackageBuild(config.rootDir);
		}

		const manifest: ResourceManifest = {
			resource: slug,
			schemaVersion: ir.version,
			generatorVersion: GENERATOR_VERSION,
			files: manifestFiles,
			manualFollowUps,
		};
		await writeManifest(config.rootDir, manifest);
		await finalizeResourceGeneration(config, slug, writtenFiles);
	}

	return { writtenFiles, patchedFiles, skippedFiles, manualFollowUps };
}

export function listPatchPathsForIr(ir: ResourceIR, modulesManifest: GeneratorModulesManifest): string[] {
	return listSharedPatchRelativePaths(ir, modulesManifest);
}
