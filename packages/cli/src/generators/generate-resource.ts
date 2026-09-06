import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ResourceIR } from "../ir/types.js";
import type { AppProjectConfig } from "../core/project.js";
import { GENERATOR_VERSION, hashContent, writeManifest, type ResourceManifest } from "../core/manifest.js";
import { planResourceFiles } from "../core/planner.js";
import { renderPrismaModelBlock, renderRlsBlock } from "./prisma/render-prisma.js";
import { renderZodSchemas } from "./contracts/render-zod.js";
import { renderNestRepository } from "./nestjs/render-repository.js";
import { renderNestServiceBase } from "./nestjs/render-service-base.js";
import { renderNestServiceWrapper } from "./nestjs/render-service.js";
import { renderNestControllerBase } from "./nestjs/render-controller-base.js";
import { renderNestControllerWrapper } from "./nestjs/render-controller.js";
import { renderNestModule } from "./nestjs/render-module.js";
import { renderAdminView } from "./admin/render-view.js";
import { renderAdminPage } from "./admin/render-page.js";
import { renderAdminCreatePage } from "./admin/render-create-page.js";
import { renderAdminEditPage } from "./admin/render-edit-page.js";
import { renderServiceTest } from "./tests/render-service-test.js";
import { renderRepositoryTest } from "./tests/render-repository-test.js";
import { renderAdminViewTest } from "./tests/render-admin-view-test.js";
import { patchPrismaSchema } from "./prisma/patch-schema.js";
import { patchRlsSql } from "./prisma/patch-rls.js";
import { patchPermissionEnum } from "./contracts/patch-permissions.js";
import { patchApiRoutes } from "./contracts/patch-api-routes.js";
import { patchContractsIndex } from "./contracts/patch-contracts.js";
import { patchEndpoints } from "./client/patch-endpoints.js";
import { patchSchemasIndex } from "./contracts/patch-schemas-index.js";
import { patchVersionedRoutes } from "./contracts/patch-versioned-routes.js";
import { patchAppModule } from "./nestjs/patch-app-module.js";
import { patchSidebarMenu } from "./admin/patch-sidebar-menu.js";

export interface GenerateOptions {
	readonly dryRun: boolean;
	readonly allowDestructive: boolean;
	readonly runMigrate: boolean;
}

export interface GenerateResult {
	readonly writtenFiles: readonly string[];
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

export async function generateResource(config: AppProjectConfig, ir: ResourceIR, options: GenerateOptions): Promise<GenerateResult> {
	const planned = planResourceFiles(config, ir);
	const writtenFiles: string[] = [];
	const skippedFiles: string[] = [];
	const manualFollowUps: string[] = [];
	const manifestFiles: ResourceManifest["files"] = {};

	const moduleName = ir.resource.slug;
	const slug = ir.resource.slug;

	const fileContents: Record<string, string> = {
		[`apps/api/src/modules/${moduleName}/${moduleName}.repository.generated.ts`]: renderNestRepository(ir),
		[`apps/api/src/modules/${moduleName}/${moduleName}.service.generated.ts`]: renderNestServiceBase(ir),
		[`apps/api/src/modules/${moduleName}/${moduleName}.controller.generated.ts`]: renderNestControllerBase(ir),
		[`packages/shared/src/schemas/domain/${slug}.generated.ts`]: renderZodSchemas(ir),
		[`apps/admin/app/(panel)/${slug}/${slug}-view.generated.tsx`]: renderAdminView(ir),
		[`apps/api/src/modules/${moduleName}/__tests__/${moduleName}.repository.spec.ts`]: renderRepositoryTest(ir),
		[`apps/admin/app/(panel)/${slug}/__tests__/${slug}-view.test.tsx`]: renderAdminViewTest(ir),
	};

	const scaffoldContents: Record<string, string> = {
		[`apps/api/src/modules/${moduleName}/${moduleName}.module.ts`]: renderNestModule(ir),
		[`apps/api/src/modules/${moduleName}/${moduleName}.service.ts`]: renderNestServiceWrapper(ir),
		[`apps/api/src/modules/${moduleName}/${moduleName}.controller.ts`]: renderNestControllerWrapper(ir),
		[`apps/admin/app/(panel)/${slug}/page.tsx`]: renderAdminPage(ir),
		[`apps/admin/app/(panel)/${slug}/create/page.tsx`]: renderAdminCreatePage(ir),
		[`apps/admin/app/(panel)/${slug}/[id]/edit/page.tsx`]: renderAdminEditPage(ir),
		[`apps/api/src/modules/${moduleName}/__tests__/${moduleName}.service.spec.ts`]: renderServiceTest(ir),
	};

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
		const prismaBlock = renderPrismaModelBlock(ir);
		const rlsBlock = renderRlsBlock(ir);
		await patchPrismaSchema(config.prismaSchemaPath, ir, prismaBlock, options);
		await patchRlsSql(config.rlsSqlPath, ir, rlsBlock);
		await patchPermissionEnum(path.join(config.sharedDir, "src/schemas/domain/enums.ts"), ir);
		await patchApiRoutes(path.join(config.sharedDir, "src/api-routes.ts"), ir);
		await patchContractsIndex(path.join(config.sharedDir, "src/contracts/index.ts"), ir);
		await patchEndpoints(path.join(config.clientDir, "src/lib/api/endpoints.ts"), ir);
		await patchSchemasIndex(path.join(config.sharedDir, "src/schemas/index.ts"), ir);
		await patchVersionedRoutes(path.join(config.sharedDir, "src/contracts/versioning.ts"), ir);
		await patchAppModule(path.join(config.apiDir, "src/app.module.ts"), ir);
		await patchSidebarMenu(path.join(config.adminDir, "lib/navigation/sidebar-menu.json"), ir);

		const manifest: ResourceManifest = {
			resource: slug,
			schemaVersion: ir.version,
			generatorVersion: GENERATOR_VERSION,
			files: manifestFiles,
			manualFollowUps,
		};
		await writeManifest(config.rootDir, manifest);
	}

	return { writtenFiles, skippedFiles, manualFollowUps };
}
