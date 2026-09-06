import { readFile, writeFile } from "node:fs/promises";

import type { ResourceIR } from "../../ir/types.js";

export async function patchVersionedRoutes(versioningPath: string, ir: ResourceIR): Promise<void> {
	const current = await readFile(versioningPath, "utf8");
	const prefix = `"/${ir.resource.slug}"`;
	if (current.includes(prefix)) {
		return;
	}
	const updated = current
		.replace('"/capabilities/catalog",\n] = [', `"/capabilities/catalog",\n\t${prefix},\n] = [`)
		.replace('"/capabilities/catalog",\n\t"/capabilities/catalog",', `"/capabilities/catalog",\n\t${prefix},\n\t"/capabilities/catalog",`);
	if (updated === current) {
		const marker = '"/capabilities/catalog",';
		const withArray = updated.replace(`${marker}\n] = [`, `${marker}\n\t${prefix},\n] = [`);
		const withUnion = withArray.replace(`${marker}\n] = [`, `${marker}\n\t${prefix},\n] = [`);
		await writeFile(
			versioningPath,
			withUnion.replace(`${marker}\n] = [`, `${marker}\n\t${prefix},\n] = [`).replace(`readonly [\n${marker}`, `readonly [\n\t${prefix},\n${marker}`),
			"utf8",
		);
		return;
	}
	await writeFile(versioningPath, updated.replace(`readonly [\n\t"/auth",`, `readonly [\n\t${prefix},\n\t"/auth",`), "utf8");
}
