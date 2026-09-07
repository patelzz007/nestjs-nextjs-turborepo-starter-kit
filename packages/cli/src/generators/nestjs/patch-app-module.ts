import { readFile, writeFile } from "node:fs/promises";

import { hasGeneratedBlock, removeGeneratedBlock, upsertGeneratedBlock } from "../../core/generated-marker";
import type { ResourceIR } from "../../ir/types";

function buildAppModuleImportsBlock(ir: ResourceIR): string {
	const moduleClass = `${ir.resource.modelName}Module`;
	return `\t\t${moduleClass},`;
}

export async function patchAppModule(appModulePath: string, ir: ResourceIR): Promise<void> {
	const moduleClass = `${ir.resource.modelName}Module`;
	const slug = ir.resource.slug;
	const markerKey = `module:${slug}`;
	const importLine = `import { ${moduleClass} } from "./modules/${slug}/${slug}.module";`;

	let working = await readFile(appModulePath, "utf8");
	if (!working.includes(importLine)) {
		const importAnchor = 'import { RewardsModule } from "./modules/rewards/rewards.module";';
		if (!working.includes(importAnchor)) {
			throw new Error(`patchAppModule: import anchor not found in ${appModulePath}`);
		}
		working = working.replace(importAnchor, `${importAnchor}\n${importLine}`);
	}

	const block = buildAppModuleImportsBlock(ir);
	const anchor = "\t\tRewardsModule,\n";
	const anchorIndex = working.indexOf(anchor);
	if (anchorIndex === -1 && !hasGeneratedBlock(working, markerKey)) {
		throw new Error(`patchAppModule: RewardsModule anchor not found in ${appModulePath}`);
	}
	const insertIndex = anchorIndex === -1 ? working.length : anchorIndex + anchor.length;
	const next = upsertGeneratedBlock(working, markerKey, block, insertIndex, { linePrefix: "\t\t" });
	await writeFile(appModulePath, next, "utf8");
}

/** Removes app module registration during rollback. */
export async function unpatchAppModule(appModulePath: string, slug: string, modelName: string): Promise<void> {
	const current = await readFile(appModulePath, "utf8");
	const moduleClass = `${modelName}Module`;
	const markerKey = `module:${slug}`;
	let next = current;
	if (hasGeneratedBlock(next, markerKey)) {
		next = removeGeneratedBlock(next, markerKey);
	}
	const importLine = `import { ${moduleClass} } from "./modules/${slug}/${slug}.module";`;
	next = next.replace(`${importLine}\n`, "");
	await writeFile(appModulePath, next, "utf8");
}
