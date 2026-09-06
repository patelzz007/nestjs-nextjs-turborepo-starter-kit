import { existsSync } from "node:fs";
import path from "node:path";

import type { ResourceIR } from "../ir/types.js";
import type { AppProjectConfig } from "./project.js";

export interface PlannedFile {
	readonly absolutePath: string;
	readonly relativePath: string;
	readonly ownership: "generated" | "scaffolded";
	readonly template: string;
}

export function planResourceFiles(config: AppProjectConfig, ir: ResourceIR): PlannedFile[] {
	const slug = ir.resource.slug;
	const moduleName = slug;
	const files: PlannedFile[] = [];

	const push = (relativePath: string, ownership: "generated" | "scaffolded", template: string): void => {
		files.push({
			absolutePath: path.join(config.rootDir, relativePath),
			relativePath,
			ownership,
			template,
		});
	};

	push(`apps/api/src/modules/${moduleName}/${moduleName}.module.ts`, "scaffolded", "nestjs/module");
	push(`apps/api/src/modules/${moduleName}/${moduleName}.controller.ts`, "scaffolded", "nestjs/controller");
	push(`apps/api/src/modules/${moduleName}/${moduleName}.service.ts`, "scaffolded", "nestjs/service");
	push(`apps/api/src/modules/${moduleName}/${moduleName}.repository.generated.ts`, "generated", "nestjs/repository");
	push(`apps/api/src/modules/${moduleName}/${moduleName}.service.generated.ts`, "generated", "nestjs/service-base");
	push(`apps/api/src/modules/${moduleName}/${moduleName}.controller.generated.ts`, "generated", "nestjs/controller-base");

	push(`packages/shared/src/schemas/domain/${slug}.generated.ts`, "generated", "contracts/zod");
	push(`apps/admin/app/(panel)/${slug}/page.tsx`, "scaffolded", "admin/page");
	push(`apps/admin/app/(panel)/${slug}/${slug}-view.generated.tsx`, "generated", "admin/view");
	push(`apps/admin/app/(panel)/${slug}/create/page.tsx`, "scaffolded", "admin/create-page");
	push(`apps/admin/app/(panel)/${slug}/[id]/edit/page.tsx`, "scaffolded", "admin/edit-page");

	push(`apps/api/src/modules/${moduleName}/__tests__/${moduleName}.service.spec.ts`, "scaffolded", "tests/service");
	push(`apps/api/src/modules/${moduleName}/__tests__/${moduleName}.repository.spec.ts`, "generated", "tests/repository");
	push(`apps/admin/app/(panel)/${slug}/__tests__/${slug}-view.test.tsx`, "generated", "tests/admin-view");

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
