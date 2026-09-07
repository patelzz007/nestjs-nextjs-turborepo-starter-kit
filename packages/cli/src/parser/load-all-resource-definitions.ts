import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { ResourceDefinition } from "../schema/resource-definition";
import { parseResourceDefinitionFile } from "../parser/parse-resource-definition";

/** Loads every `.resource.ts` definition from the project definitions directory. */
export async function loadAllResourceDefinitions(definitionsDir: string): Promise<ResourceDefinition[]> {
	let entries: string[] = [];
	try {
		entries = await readdir(definitionsDir);
	} catch {
		return [];
	}

	const definitions: ResourceDefinition[] = [];
	for (const entry of entries.filter((file) => file.endsWith(".resource.ts"))) {
		const filePath = path.join(definitionsDir, entry);
		const source = await readFile(filePath, "utf8");
		definitions.push(parseResourceDefinitionFile(source, filePath));
	}

	return definitions.sort((left, right) => left.model.name.localeCompare(right.model.name));
}
