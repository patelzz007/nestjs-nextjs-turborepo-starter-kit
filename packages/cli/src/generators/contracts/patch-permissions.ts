import { readFile, writeFile } from "node:fs/promises";

import type { ResourceIR } from "../../ir/types.js";

export async function patchPermissionEnum(enumsPath: string, ir: ResourceIR): Promise<void> {
	const current = await readFile(enumsPath, "utf8");
	const resource = ir.resource.permissionResource;
	if (current.includes(`"${resource}"`)) {
		return;
	}
	const updated = current.replace(/export const PermissionResourceSchema = z\.enum\(\[\n([\s\S]*?)\]\);/, (match, inner: string) => {
		if (inner.includes(`"${resource}"`)) {
			return match;
		}
		const trimmed = inner.trimEnd();
		const insertion = `${trimmed}\n\t"${resource}",`;
		return `export const PermissionResourceSchema = z.enum([\n${insertion}\n]);`;
	});
	await writeFile(enumsPath, updated, "utf8");
}
