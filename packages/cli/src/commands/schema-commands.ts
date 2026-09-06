import { readFile } from "node:fs/promises";
import path from "node:path";

import * as p from "@clack/prompts";
import pc from "picocolors";

import { loadProjectConfig } from "../core/project.js";
import { normalizeResourceDefinition } from "../ir/normalize.js";
import { parseResourceDefinitionFile } from "../parser/parse-resource-definition.js";

export interface ValidateDefinitionOptions {
	readonly verbose?: boolean;
}

export async function inspectResourceDefinition(definitionPath: string): Promise<void> {
	const source = await readFile(definitionPath, "utf8");
	const definition = parseResourceDefinitionFile(source, definitionPath);
	const ir = normalizeResourceDefinition(definition);
	process.stdout.write(`${JSON.stringify(ir, null, 2)}\n`);
}

export async function validateResourceDefinition(definitionPath: string, options: ValidateDefinitionOptions = {}): Promise<boolean> {
	try {
		const source = await readFile(definitionPath, "utf8");
		parseResourceDefinitionFile(source, definitionPath);
		if (options.verbose === true) {
			p.log.success(`Valid resource definition: ${pc.dim(definitionPath)}`);
		} else {
			process.stdout.write(pc.green(`Valid resource definition: ${definitionPath}\n`));
		}
		return true;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (options.verbose === true) {
			p.log.error(`Invalid resource definition: ${message}`);
		} else {
			process.stdout.write(pc.red(`Invalid resource definition: ${message}\n`));
		}
		return false;
	}
}

export function resolveDefinitionPath(cwd: string, resourceName: string): string {
	const config = loadProjectConfig(cwd);
	const candidates = [
		path.join(config.definitionsDir, `${resourceName}.resource.ts`),
		path.join(config.definitionsDir, `${resourceName.replace(/-/g, "")}.resource.ts`),
		path.isAbsolute(resourceName) ? resourceName : path.join(cwd, resourceName),
	];
	for (const candidate of candidates) {
		if (candidate.endsWith(".resource.ts")) {
			return candidate;
		}
	}
	return candidates[0] ?? path.join(config.definitionsDir, `${resourceName}.resource.ts`);
}
