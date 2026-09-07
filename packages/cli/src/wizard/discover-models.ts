import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { normalizeResourceDefinition } from "../ir/normalize";
import { parseResourceDefinitionFile } from "../parser/parse-resource-definition";
import type { DiscoveredModel } from "./types";

export async function discoverExistingModels(definitionsDir: string): Promise<DiscoveredModel[]> {
	let entries: string[] = [];
	try {
		entries = await readdir(definitionsDir);
	} catch {
		return [];
	}

	const models: DiscoveredModel[] = [];
	for (const entry of entries.filter((file) => file.endsWith(".resource.ts"))) {
		const filePath = path.join(definitionsDir, entry);
		const source = await readFile(filePath, "utf8");
		const definition = parseResourceDefinitionFile(source, filePath);
		const ir = normalizeResourceDefinition(definition);
		models.push({
			modelName: ir.resource.modelName,
			slug: ir.resource.slug,
		});
	}

	return models.sort((left, right) => left.modelName.localeCompare(right.modelName));
}
