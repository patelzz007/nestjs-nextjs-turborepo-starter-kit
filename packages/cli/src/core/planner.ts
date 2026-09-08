import { existsSync } from "node:fs";
import path from "node:path";

import { resolveModuleResourceDir } from "./discover-modules";
import { resolveModulesForIr } from "./load-modules";
import type { GeneratorModulesManifest } from "../schema/generator-modules";
import type { ResourceIR } from "../ir/types";
import type { AppProjectConfig } from "./project";

export interface PlannedFile {
	readonly absolutePath: string;
	readonly relativePath: string;
	readonly ownership: "generated" | "scaffolded";
	readonly template: string;
}

export function planResourceFiles(config: AppProjectConfig, ir: ResourceIR, modulesManifest: GeneratorModulesManifest): PlannedFile[] {
	const slug = ir.resource.slug;
	const moduleName = slug;
	const files: PlannedFile[] = [];
	const uiModules = resolveModulesForIr(modulesManifest, ir.scope.ui);

	const push = (relativePath: string, ownership: "generated" | "scaffolded", template: string): void => {
		files.push({
			absolutePath: path.join(config.rootDir, relativePath),
			relativePath,
			ownership,
			template,
		});
	};

	if (ir.scope.api) {
		push(`apps/api/src/modules/${moduleName}/${moduleName}.module.ts`, "scaffolded", "nestjs/module");
		push(`apps/api/src/modules/${moduleName}/${moduleName}.controller.ts`, "scaffolded", "nestjs/controller");
		push(`apps/api/src/modules/${moduleName}/${moduleName}.service.ts`, "scaffolded", "nestjs/service");
		push(`apps/api/src/modules/${moduleName}/${moduleName}.repository.generated.ts`, "generated", "nestjs/repository");
		push(`apps/api/src/modules/${moduleName}/${moduleName}.service.generated.ts`, "generated", "nestjs/service-base");
		push(`apps/api/src/modules/${moduleName}/${moduleName}.controller.generated.ts`, "generated", "nestjs/controller-base");
		push(`apps/api/src/modules/${moduleName}/__tests__/${moduleName}.service.spec.ts`, "scaffolded", "tests/service");
		push(`apps/api/src/modules/${moduleName}/__tests__/${moduleName}.repository.spec.ts`, "generated", "tests/repository");
	}

	if (ir.scope.shared) {
		push(`packages/shared/src/schemas/domain/${slug}.generated.ts`, "generated", "contracts/zod");
	}

	for (const uiModule of uiModules) {
		const resourceDir = resolveModuleResourceDir(uiModule, slug);
		push(`${resourceDir}/page.tsx`, "generated", "ui/page");
		push(`${resourceDir}/${slug}-detail-view.generated.tsx`, "generated", "ui/detail-view");
		push(`${resourceDir}/[id]/page.tsx`, "generated", "ui/detail-page");
		push(`${resourceDir}/${slug}-view.generated.tsx`, "generated", "ui/view");
		push(`${resourceDir}/create/page.tsx`, "scaffolded", "ui/create-page");
		push(`${resourceDir}/[id]/edit/page.tsx`, "scaffolded", "ui/edit-page");
		push(`${resourceDir}/__tests__/${slug}-view.test.tsx`, "generated", "tests/ui-view");
	}

	return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export interface PlanAction {
	readonly path: string;
	readonly action: "create" | "modify" | "skip" | "conflict";
	readonly reason: string;
	readonly ownership: "generated" | "scaffolded" | "manual";
}

export function buildPlanActions(planned: readonly PlannedFile[], existingManifestPaths: ReadonlySet<string>): PlanAction[] {
	return planned.map((file) => {
		const exists = existsSync(file.absolutePath);
		if (!exists) {
			return {
				path: file.relativePath,
				action: "create",
				reason: "File does not exist",
				ownership: file.ownership,
			};
		}
		if (file.ownership === "generated" || existingManifestPaths.has(file.relativePath)) {
			return {
				path: file.relativePath,
				action: "modify",
				reason: "Generator-owned file will be updated",
				ownership: file.ownership,
			};
		}
		return {
			path: file.relativePath,
			action: "skip",
			reason: "Developer-owned scaffold already exists",
			ownership: "manual",
		};
	});
}
