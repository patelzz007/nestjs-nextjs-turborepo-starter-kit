import { readFile, writeFile } from "node:fs/promises";

import type { ResourceIR } from "../../ir/types";

export async function patchAppModule(appModulePath: string, ir: ResourceIR): Promise<void> {
	const current = await readFile(appModulePath, "utf8");
	const moduleClass = `${ir.resource.modelName}Module`;
	const slug = ir.resource.slug;
	const importLine = `import { ${moduleClass} } from "./modules/${slug}/${slug}.module";`;

	let next = current;
	if (!next.includes(importLine)) {
		const anchor = 'import { RewardsModule } from "./modules/rewards/rewards.module";';
		next = next.replace(anchor, `${anchor}\n${importLine}`);
	}

	const importsMarker = "\t\tRewardsModule,\n";
	const moduleEntry = `\t\t${moduleClass},\n`;
	if (!next.includes(moduleEntry)) {
		next = next.replace(importsMarker, `${importsMarker}${moduleEntry}`);
	}

	await writeFile(appModulePath, next, "utf8");
}
