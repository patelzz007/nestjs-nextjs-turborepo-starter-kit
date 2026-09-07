import { readFile, writeFile } from "node:fs/promises";

import { hasGeneratedBlock, removeGeneratedBlock, SQL_MARKER_PREFIXES, upsertGeneratedBlock } from "../../core/generated-marker";
import type { ResourceIR } from "../../ir/types";

export async function patchRlsSql(rlsPath: string, ir: ResourceIR, block: string): Promise<void> {
	const current = await readFile(rlsPath, "utf8");
	const markerKey = ir.resource.modelName;
	const next = hasGeneratedBlock(current, markerKey, SQL_MARKER_PREFIXES)
		? upsertGeneratedBlock(current, markerKey, block, 0, { prefixes: SQL_MARKER_PREFIXES })
		: `${current.trimEnd()}\n\n${upsertGeneratedBlock("", markerKey, block, 0, { prefixes: SQL_MARKER_PREFIXES }).trim()}\n`;
	await writeFile(rlsPath, next, "utf8");
}

/** Removes an RLS block during rollback. */
export async function unpatchRlsSql(rlsPath: string, modelName: string): Promise<void> {
	const current = await readFile(rlsPath, "utf8");
	if (!hasGeneratedBlock(current, modelName, SQL_MARKER_PREFIXES)) {
		return;
	}
	await writeFile(rlsPath, removeGeneratedBlock(current, modelName, SQL_MARKER_PREFIXES), "utf8");
}


