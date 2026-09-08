import { readFile, writeFile } from "node:fs/promises";

import { hasGeneratedBlock, removeGeneratedBlock, upsertGeneratedBlock } from "../../core/generated-marker";
import type { ResourceIR } from "../../ir/types";

function buildPermissionEnumBlock(resource: string): string {
	return `\t"${resource}",`;
}

export async function patchPermissionEnum(enumsPath: string, ir: ResourceIR): Promise<void> {
	const current = await readFile(enumsPath, "utf8");
	const resource = ir.resource.permissionResource;
	const markerKey = `permission:${resource}`;
	if (hasGeneratedBlock(current, markerKey) || current.includes(`"${resource}"`)) {
		return;
	}
	const anchor = "export const PermissionResourceSchema = z.enum([";
	const anchorIndex = current.indexOf(anchor);
	if (anchorIndex === -1) {
		throw new Error(`patchPermissionEnum: PermissionResourceSchema anchor not found in ${enumsPath}`);
	}
	const block = buildPermissionEnumBlock(resource);
	const insertIndex = current.indexOf("]);", anchorIndex);
	if (insertIndex === -1) {
		throw new Error(`patchPermissionEnum: enum closing not found in ${enumsPath}`);
	}
	const next = upsertGeneratedBlock(current, markerKey, block, insertIndex, { linePrefix: "\t" });
	await writeFile(enumsPath, next, "utf8");
}

/** Removes a permission enum entry during rollback. */
export async function unpatchPermissionEnum(enumsPath: string, permissionResource: string): Promise<void> {
	const current = await readFile(enumsPath, "utf8");
	const markerKey = `permission:${permissionResource}`;
	if (!hasGeneratedBlock(current, markerKey)) {
		return;
	}
	await writeFile(enumsPath, removeGeneratedBlock(current, markerKey), "utf8");
}
