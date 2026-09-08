import path from "node:path";

import type { GeneratorModulesManifest } from "../schema/generator-modules";
import type { AppProjectConfig } from "../core/project";
import type { ResourceIR } from "../ir/types";
import { unpatchApiRoutes } from "../generators/contracts/patch-api-routes";
import { unpatchContractsIndex } from "../generators/contracts/patch-contracts";
import { unpatchPermissionEnum } from "../generators/contracts/patch-permissions";
import { unpatchSchemasIndex } from "../generators/contracts/patch-schemas-index";
import { unpatchVersionedRoutes } from "../generators/contracts/patch-versioned-routes";
import { unpatchEndpoints } from "../generators/client/patch-endpoints";
import { unpatchAppModule } from "../generators/nestjs/patch-app-module";
import { unpatchPrismaSchema } from "../generators/prisma/patch-schema";
import { unpatchRlsSql } from "../generators/prisma/patch-rls";
import { unpatchSidebarMenu } from "../generators/admin/patch-sidebar-menu";
import { resolveModulesForIr } from "../core/load-modules";

/** Removes all generator blocks for a resource from shared patched files. */
export async function unpatchSharedFiles(config: AppProjectConfig, ir: ResourceIR, modulesManifest: GeneratorModulesManifest): Promise<void> {
	const slug = ir.resource.slug;
	const contractKey = ir.resource.contractKey;
	const modelName = ir.resource.modelName;
	const permissionResource = ir.resource.permissionResource;

	if (ir.scope.api) {
		await unpatchPrismaSchema(config.prismaSchemaPath, modelName);
		await unpatchRlsSql(config.rlsSqlPath, modelName);
		await unpatchAppModule(path.join(config.apiDir, "src/app.module.ts"), slug, modelName);
	}

	if (ir.scope.shared) {
		await unpatchPermissionEnum(path.join(config.sharedDir, "src/schemas/domain/enums.ts"), permissionResource);
		await unpatchApiRoutes(path.join(config.sharedDir, "src/api-routes.ts"), contractKey);
		await unpatchContractsIndex(path.join(config.sharedDir, "src/contracts/index.ts"), contractKey);
		await unpatchSchemasIndex(path.join(config.sharedDir, "src/schemas/index.ts"), contractKey);
		await unpatchVersionedRoutes(path.join(config.sharedDir, "src/contracts/versioning.ts"), slug);
	}

	if (ir.scope.client) {
		await unpatchEndpoints(path.join(config.clientDir, "src/lib/api/endpoints.ts"), contractKey);
	}

	const uiModules = resolveModulesForIr(modulesManifest, ir.scope.ui);
	for (const uiModule of uiModules) {
		const menuPath = path.join(config.rootDir, uiModule.sidebarMenuPath);
		await unpatchSidebarMenu(menuPath, ir, uiModule.routePrefix);
	}
}
