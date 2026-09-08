import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";

import type { GeneratorModulesManifest } from "../schema/generator-modules";
import type { AppProjectConfig } from "../core/project";
import { readManifest } from "../core/manifest";
import type { ResourceIR } from "../ir/types";
import {
	buildGitStashMessage,
	definitionRelativePath,
	initialSharedPatchesSnapshotRelativePath,
	listSharedPatchRelativePaths,
	normalizeRepoRelativePath,
	rollbackRecordRelativePath,
} from "./generator-paths";
import { assertGitRepository, dropGitStash, stashGeneratorPaths } from "./git-stash";
import { RollbackRecordSchema, SharedPatchSnapshotSchema, type RollbackRecord, type SharedPatchSnapshot } from "./rollback-schema";

function rollbackRecordAbsolutePath(config: AppProjectConfig, slug: string): string {
	return path.join(config.rootDir, rollbackRecordRelativePath(slug));
}

function snapshotAbsolutePath(config: AppProjectConfig, slug: string): string {
	return path.join(config.rootDir, initialSharedPatchesSnapshotRelativePath(slug));
}

export async function readRollbackRecord(config: AppProjectConfig, slug: string): Promise<RollbackRecord | null> {
	const filePath = rollbackRecordAbsolutePath(config, slug);
	if (!existsSync(filePath)) {
		return null;
	}
	const raw = await readFile(filePath, "utf8");
	const parsed = RollbackRecordSchema.safeParse(JSON.parse(raw));
	if (!parsed.success) {
		throw new Error(`Invalid rollback record for ${slug}: ${parsed.error.message}`);
	}
	return parsed.data;
}

export async function writeRollbackRecord(config: AppProjectConfig, record: RollbackRecord): Promise<void> {
	const filePath = rollbackRecordAbsolutePath(config, record.resource);
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

export async function readInitialSharedPatchSnapshot(config: AppProjectConfig, slug: string): Promise<SharedPatchSnapshot | null> {
	const filePath = snapshotAbsolutePath(config, slug);
	if (!existsSync(filePath)) {
		return null;
	}
	const raw = await readFile(filePath, "utf8");
	const parsed = SharedPatchSnapshotSchema.safeParse(JSON.parse(raw));
	if (!parsed.success) {
		throw new Error(`Invalid shared patch snapshot for ${slug}: ${parsed.error.message}`);
	}
	return parsed.data;
}

async function captureSharedPatchSnapshot(config: AppProjectConfig, sharedPaths: readonly string[]): Promise<SharedPatchSnapshot> {
	const snapshot: Record<string, string> = {};
	for (const relativePath of sharedPaths) {
		const absolutePath = path.join(config.rootDir, relativePath);
		if (!existsSync(absolutePath)) {
			continue;
		}
		snapshot[relativePath] = await readFile(absolutePath, "utf8");
	}
	return snapshot;
}

async function writeSharedPatchSnapshot(config: AppProjectConfig, slug: string, snapshot: SharedPatchSnapshot): Promise<void> {
	const filePath = snapshotAbsolutePath(config, slug);
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

export async function prepareResourceGeneration(config: AppProjectConfig, ir: ResourceIR, modulesManifest: GeneratorModulesManifest): Promise<void> {
	const slug = ir.resource.slug;
	const existingManifest = await readManifest(config.rootDir, slug);
	const existingRecord = await readRollbackRecord(config, slug);
	const isFirstGenerate = existingManifest === null;
	const sharedPaths = listSharedPatchRelativePaths(ir, modulesManifest);

	if (isFirstGenerate) {
		await assertGitRepository(config.rootDir);
		const snapshot = await captureSharedPatchSnapshot(config, sharedPaths);
		await writeSharedPatchSnapshot(config, slug, snapshot);
		const stashMessage = buildGitStashMessage(slug);
		const stashRef = await stashGeneratorPaths(config.rootDir, stashMessage, sharedPaths);
		const record: RollbackRecord = {
			resource: slug,
			createdAt: new Date().toISOString(),
			definitionRelativePath: definitionRelativePath(config, slug),
			stashedPaths: sharedPaths,
			gitStashRef: stashRef,
			gitStashMessage: stashMessage,
			hasSyncedSinceGenerate: false,
			trackedFiles: [],
		};
		await writeRollbackRecord(config, record);
		return;
	}

	const snapshot = await captureSharedPatchSnapshot(config, sharedPaths);
	await writeSharedPatchSnapshot(config, slug, snapshot);

	if (existingRecord === null) {
		const record: RollbackRecord = {
			resource: slug,
			createdAt: new Date().toISOString(),
			definitionRelativePath: definitionRelativePath(config, slug),
			stashedPaths: sharedPaths,
			gitStashRef: null,
			gitStashMessage: null,
			hasSyncedSinceGenerate: true,
			trackedFiles: [],
		};
		await writeRollbackRecord(config, record);
		return;
	}

	await writeRollbackRecord(config, {
		...existingRecord,
		stashedPaths: sharedPaths,
		hasSyncedSinceGenerate: true,
	});
}

export async function finalizeResourceGeneration(config: AppProjectConfig, slug: string, writtenFiles: readonly string[]): Promise<void> {
	const record = await readRollbackRecord(config, slug);
	if (record === null) {
		return;
	}
	const tracked = new Set(record.trackedFiles);
	for (const filePath of writtenFiles) {
		tracked.add(normalizeRepoRelativePath(filePath));
	}
	await writeRollbackRecord(config, {
		...record,
		trackedFiles: [...tracked].sort((left, right) => left.localeCompare(right)),
	});
}

export async function removeRollbackArtifacts(config: AppProjectConfig, slug: string): Promise<void> {
	const recordPath = rollbackRecordAbsolutePath(config, slug);
	const snapshotPath = snapshotAbsolutePath(config, slug);
	const snapshotDir = path.dirname(snapshotPath);
	if (existsSync(recordPath)) {
		await rm(recordPath, { force: true });
	}
	if (existsSync(snapshotPath)) {
		await rm(snapshotPath, { force: true });
	}
	if (existsSync(snapshotDir)) {
		await rm(snapshotDir, { recursive: true, force: true });
	}
}

export async function dropRollbackGitStash(config: AppProjectConfig, record: RollbackRecord): Promise<void> {
	if (record.gitStashRef === null) {
		return;
	}
	try {
		await dropGitStash(config.rootDir, record.gitStashRef);
	} catch {
		// Non-fatal: stash may already have been dropped manually.
	}
}
