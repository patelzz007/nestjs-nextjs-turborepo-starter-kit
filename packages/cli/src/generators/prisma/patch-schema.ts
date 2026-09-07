import { readFile, writeFile } from "node:fs/promises";

import type { ResourceIR } from "../../ir/types";
import type { GenerateOptions } from "../generate-resource";

const BEGIN = "// @app-generated:begin";
const END = "// @app-generated:end";

export async function patchPrismaSchema(schemaPath: string, ir: ResourceIR, block: string, options: GenerateOptions): Promise<void> {
	const current = await readFile(schemaPath, "utf8");
	const marker = `${BEGIN} ${ir.resource.modelName}`;
	const endMarker = `${END} ${ir.resource.modelName}`;
	const wrapped = `${marker}\n${block}\n${endMarker}`;

	if (current.includes(marker)) {
		const start = current.indexOf(marker);
		const end = current.indexOf(endMarker);
		if (start === -1 || end === -1) {
			throw new Error(`Malformed generated Prisma block for ${ir.resource.modelName}`);
		}
		const next = `${current.slice(0, start)}${wrapped}${current.slice(end + endMarker.length)}`;
		if (!options.dryRun) {
			await writeFile(schemaPath, next, "utf8");
		}
		return;
	}

	if (!options.dryRun) {
		await writeFile(schemaPath, `${current.trimEnd()}\n\n${wrapped}\n`, "utf8");
	}
}
