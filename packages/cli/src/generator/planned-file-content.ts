import type { GeneratorModulesManifest } from "../schema/generator-modules";
import type { ResourceIR } from "../ir/types";
import { resolveModuleResourceDir } from "../core/discover-modules";
import { resolveModulesForIr } from "../core/load-modules";
import type { GeneratorModule } from "../schema/generator-modules";
import { withActiveUiModule } from "../ir/ui-context";
import { renderNestRepository } from "../generators/nestjs/render-repository";
import { renderNestServiceBase } from "../generators/nestjs/render-service-base";
import { renderNestControllerBase } from "../generators/nestjs/render-controller-base";
import { renderRepositoryTest } from "../generators/tests/render-repository-test";
import { renderZodSchemas } from "../generators/contracts/render-zod";
import { renderAdminView } from "../generators/admin/render-view";
import { renderAdminPage } from "../generators/admin/render-page";
import { renderAdminDetailPage } from "../generators/admin/render-detail-page";
import { renderAdminDetailView } from "../generators/admin/render-detail-view";
import { renderAdminViewTest } from "../generators/tests/render-admin-view-test";
import { renderNestModule } from "../generators/nestjs/render-module";
import { renderNestServiceWrapper } from "../generators/nestjs/render-service";
import { renderNestControllerWrapper } from "../generators/nestjs/render-controller";
import { renderServiceTest } from "../generators/tests/render-service-test";
import { renderAdminCreatePage } from "../generators/admin/render-create-page";
import { renderAdminEditPage } from "../generators/admin/render-edit-page";

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

/** Renders planned generator file contents for a resource IR (dry-run, no disk writes). */
export function buildPlannedFileContents(ir: ResourceIR, modulesManifest: GeneratorModulesManifest): Record<string, string> {
	const moduleName = ir.resource.slug;
	const slug = ir.resource.slug;
	const uiModules = resolveModulesForIr(modulesManifest, ir.scope.ui);
	const fileContents: Record<string, string> = {};

	if (ir.scope.api) {
		fileContents[`apps/api/src/modules/${moduleName}/${moduleName}.repository.generated.ts`] = renderNestRepository(ir);
		fileContents[`apps/api/src/modules/${moduleName}/${moduleName}.service.generated.ts`] = renderNestServiceBase(ir);
		fileContents[`apps/api/src/modules/${moduleName}/${moduleName}.controller.generated.ts`] = renderNestControllerBase(ir);
		fileContents[`apps/api/src/modules/${moduleName}/__tests__/${moduleName}.repository.spec.ts`] = renderRepositoryTest(ir);
		fileContents[`apps/api/src/modules/${moduleName}/${moduleName}.module.ts`] = renderNestModule(ir);
		fileContents[`apps/api/src/modules/${moduleName}/${moduleName}.service.ts`] = renderNestServiceWrapper(ir);
		fileContents[`apps/api/src/modules/${moduleName}/${moduleName}.controller.ts`] = renderNestControllerWrapper(ir);
		fileContents[`apps/api/src/modules/${moduleName}/__tests__/${moduleName}.service.spec.ts`] = renderServiceTest(ir);
	}

	if (ir.scope.shared) {
		fileContents[`packages/shared/src/schemas/domain/${slug}.generated.ts`] = renderZodSchemas(ir);
	}

	for (const uiModule of uiModules) {
		Object.assign(fileContents, buildUiFileContents(ir, uiModule));
		Object.assign(fileContents, buildUiScaffoldContents(ir, uiModule));
	}

	return fileContents;
}
