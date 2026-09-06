import { readFile, writeFile } from "node:fs/promises";

import type { ResourceIR } from "../../ir/types.js";

const BEGIN = "-- @app-generated:begin";
const END = "-- @app-generated:end";

export async function patchRlsSql(rlsPath: string, ir: ResourceIR, block: string): Promise<void> {
	const current = await readFile(rlsPath, "utf8");
	const marker = `${BEGIN} ${ir.resource.modelName}`;
	const endMarker = `${END} ${ir.resource.modelName}`;
	const wrapped = `${marker}\n${block}\n${endMarker}`;

	if (current.includes(marker)) {
		const start = current.indexOf(marker);
		const end = current.indexOf(endMarker);
		if (start === -1 || end === -1) {
			throw new Error(`Malformed generated RLS block for ${ir.resource.modelName}`);
		}
		const next = `${current.slice(0, start)}${wrapped}${current.slice(end + endMarker.length)}`;
		await writeFile(rlsPath, next, "utf8");
		return;
	}

	await writeFile(rlsPath, `${current.trimEnd()}\n\n${wrapped}\n`, "utf8");
}
