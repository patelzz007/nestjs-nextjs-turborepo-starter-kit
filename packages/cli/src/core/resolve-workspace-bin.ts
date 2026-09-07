import { existsSync } from "node:fs";
import path from "node:path";

/** Resolves a package binary from the monorepo workspace. */
export function resolveWorkspaceBin(repoRoot: string, binaryName: string, packageRelativeDir?: string): string {
	const candidates: string[] = [];
	if (packageRelativeDir !== undefined) {
		candidates.push(path.join(repoRoot, packageRelativeDir, "node_modules", ".bin", binaryName));
	}
	candidates.push(path.join(repoRoot, "node_modules", ".bin", binaryName));
	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}
	return binaryName;
}
