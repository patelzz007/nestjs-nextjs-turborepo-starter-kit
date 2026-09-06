import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export interface ManifestFileEntry {
	readonly template: string;
	readonly hash: string;
	readonly ownership: "generated" | "scaffolded";
}

export interface ResourceManifest {
	readonly resource: string;
	readonly schemaVersion: number;
	readonly generatorVersion: string;
	readonly files: Record<string, ManifestFileEntry>;
	readonly manualFollowUps: readonly string[];
}

export const GENERATOR_VERSION = "0.1.0";

export function hashContent(content: string): string {
	return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function manifestPath(repoRoot: string, resourceSlug: string): string {
	return path.join(repoRoot, ".app", "manifests", `${resourceSlug}.json`);
}

export async function readManifest(repoRoot: string, resourceSlug: string): Promise<ResourceManifest | null> {
	const filePath = manifestPath(repoRoot, resourceSlug);
	try {
		const raw = await readFile(filePath, "utf8");
		return JSON.parse(raw) as ResourceManifest;
	} catch {
		return null;
	}
}

export async function writeManifest(repoRoot: string, manifest: ResourceManifest): Promise<void> {
	const filePath = manifestPath(repoRoot, manifest.resource);
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
