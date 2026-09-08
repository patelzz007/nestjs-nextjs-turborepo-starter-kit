import { readFile, writeFile } from "node:fs/promises";

import { hasGeneratedBlock, removeGeneratedBlock, upsertGeneratedBlock } from "../../core/generated-marker";
import type { ResourceIR } from "../../ir/types";
import type { GenerateOptions } from "../generate-resource";

export async function patchPrismaSchema(schemaPath: string, ir: ResourceIR, block: string, options: GenerateOptions): Promise<void> {
	const current = await readFile(schemaPath, "utf8");
	const markerKey = ir.resource.modelName;
	const next = hasGeneratedBlock(current, markerKey)
		? upsertGeneratedBlock(current, markerKey, block, 0)
		: `${current.trimEnd()}\n\n${upsertGeneratedBlock("", markerKey, block, 0).trim()}\n`;
	if (!options.dryRun) {
		await writeFile(schemaPath, next, "utf8");
	}
}

/** Removes a Prisma model block during rollback. */
export async function unpatchPrismaSchema(schemaPath: string, modelName: string): Promise<void> {
	const current = await readFile(schemaPath, "utf8");
	if (!hasGeneratedBlock(current, modelName)) {
		return;
	}
	await writeFile(schemaPath, removeGeneratedBlock(current, modelName), "utf8");
}
