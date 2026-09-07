import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const ManifestFileEntrySchema = z
	.object({
		template: z.string().min(1),
		hash: z.string().min(1),
		ownership: z.enum(["generated", "scaffolded"]),
	})
	.strict();

export type ManifestFileEntry = z.output<typeof ManifestFileEntrySchema>;

export const ResourceManifestSchema = z
	.object({
		resource: z.string().min(1),
		schemaVersion: z.number().int(),
		generatorVersion: z.string().min(1),
		files: z.record(z.string(), ManifestFileEntrySchema),
		manualFollowUps: z.array(z.string()),
	})
	.strict();

export type ResourceManifest = z.output<typeof ResourceManifestSchema>;

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
		const parsed = ResourceManifestSchema.safeParse(JSON.parse(raw));
		if (!parsed.success) {
			throw new Error(`Invalid manifest for ${resourceSlug}: ${parsed.error.message}`);
		}
		return parsed.data;
	} catch (error) {
		if (error instanceof Error && error.message.startsWith("Invalid manifest")) {
			throw error;
		}
		return null;
	}
}

export async function writeManifest(repoRoot: string, manifest: ResourceManifest): Promise<void> {
	const filePath = manifestPath(repoRoot, manifest.resource);
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export function collectManifestPaths(manifest: ResourceManifest | null): ReadonlySet<string> {
	if (manifest === null) {
		return new Set();
	}
	return new Set(Object.keys(manifest.files));
}
