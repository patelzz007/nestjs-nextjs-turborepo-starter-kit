import path from "node:path";

import type { GeneratorModulesManifest } from "../schema/generator-modules";
import type { ResourceIR } from "../ir/types";
import type { AppProjectConfig } from "../core/project";
import { parseGeneratorSlug } from "../schema/generator-slug";

/** Relative repo paths patched by the resource generator (shared files). */
export function listSharedPatchRelativePaths(ir: ResourceIR, modulesManifest: GeneratorModulesManifest): string[] {
	const patchPaths: string[] = [];

	if (ir.scope.api) {
		patchPaths.push("apps/api/prisma/schema.prisma");
		patchPaths.push("apps/api/prisma/rls.sql");
		patchPaths.push("apps/api/src/app.module.ts");
	}

	if (ir.scope.shared) {
		patchPaths.push("packages/shared/src/schemas/domain/enums.ts");
		patchPaths.push("packages/shared/src/api-routes.ts");
		patchPaths.push("packages/shared/src/contracts/index.ts");
		patchPaths.push("packages/shared/src/schemas/index.ts");
		patchPaths.push("packages/shared/src/contracts/versioning.ts");
	}

	if (ir.scope.client) {
		patchPaths.push("packages/client/src/lib/api/endpoints.ts");
	}

	for (const moduleId of ir.scope.ui) {
		const module = modulesManifest.modules.find((entry) => entry.id === moduleId);
		if (module !== undefined) {
			patchPaths.push(module.sidebarMenuPath);
		}
	}

	return patchPaths.map(normalizeRepoRelativePath);
}

export function definitionRelativePath(config: AppProjectConfig, slug: string): string {
	return normalizeRepoRelativePath(path.relative(config.rootDir, path.join(config.definitionsDir, `${slug}.resource.ts`)));
}

export function resourceModuleRelativeDir(slug: string): string {
	return normalizeRepoRelativePath(`apps/api/src/modules/${slug}`);
}

export function resourceUiRelativeDirs(ir: ResourceIR, modulesManifest: GeneratorModulesManifest): string[] {
	const dirs: string[] = [];
	for (const moduleId of ir.scope.ui) {
		const module = modulesManifest.modules.find((entry) => entry.id === moduleId);
		if (module !== undefined) {
			dirs.push(normalizeRepoRelativePath(module.resourceRouteTemplate.replace("{slug}", ir.resource.slug)));
		}
	}
	return dirs;
}

export function rollbackRecordRelativePath(slug: string): string {
	return normalizeRepoRelativePath(path.join(".app", "rollback", `${slug}.json`));
}

export function initialSharedPatchesSnapshotRelativePath(slug: string): string {
	return normalizeRepoRelativePath(path.join(".app", "snapshots", slug, "initial-shared-patches.json"));
}

export function normalizeRepoRelativePath(relativePath: string): string {
	return relativePath.split(path.sep).join("/");
}

/** Ensures a resolved absolute path stays within the repository root. */
export function assertPathWithinRepoRoot(rootDir: string, absolutePath: string): void {
	const normalizedRoot = path.resolve(rootDir);
	const normalizedTarget = path.resolve(absolutePath);
	const relative = path.relative(normalizedRoot, normalizedTarget);
	if (relative.startsWith("..") || path.isAbsolute(relative)) {
		throw new Error(`Path escapes repository root: ${normalizedTarget}`);
	}
}

/** Resolves a repo-relative path and validates it stays within rootDir. */
export function resolveRepoPath(rootDir: string, relativePath: string): string {
	const absolutePath = path.join(rootDir, relativePath);
	assertPathWithinRepoRoot(rootDir, absolutePath);
	return absolutePath;
}

/** Validates and normalizes a resource slug used in generator paths. */
export function validateResourceSlug(slug: string): string {
	return parseGeneratorSlug(slug.trim());
}

export function buildGitStashMessage(slug: string): string {
	return `app:generate:${slug}:${new Date().toISOString()}`;
}
