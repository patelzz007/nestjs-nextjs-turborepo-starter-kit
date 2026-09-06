import { existsSync } from "node:fs";
import path from "node:path";

export interface AppProjectConfig {
	readonly rootDir: string;
	readonly apiDir: string;
	readonly adminDir: string;
	readonly sharedDir: string;
	readonly clientDir: string;
	readonly prismaSchemaPath: string;
	readonly rlsSqlPath: string;
	readonly definitionsDir: string;
}

const MARKER_FILES: readonly string[] = ["pnpm-workspace.yaml", "turbo.json"];

export function findRepoRoot(startDir: string): string {
	let current = path.resolve(startDir);
	for (;;) {
		const hasMarkers = MARKER_FILES.every((marker) => existsSync(path.join(current, marker)));
		if (hasMarkers) {
			return current;
		}
		const parent = path.dirname(current);
		if (parent === current) {
			throw new Error("Could not locate monorepo root (missing pnpm-workspace.yaml or turbo.json)");
		}
		current = parent;
	}
}

export function loadProjectConfig(startDir: string): AppProjectConfig {
	const rootDir = findRepoRoot(startDir);
	return {
		rootDir,
		apiDir: path.join(rootDir, "apps/api"),
		adminDir: path.join(rootDir, "apps/admin"),
		sharedDir: path.join(rootDir, "packages/shared"),
		clientDir: path.join(rootDir, "packages/client"),
		prismaSchemaPath: path.join(rootDir, "apps/api/prisma/schema.prisma"),
		rlsSqlPath: path.join(rootDir, "apps/api/prisma/rls.sql"),
		definitionsDir: path.join(rootDir, "resources/definitions"),
	};
}
