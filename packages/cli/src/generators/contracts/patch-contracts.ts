import { readFile, writeFile } from "node:fs/promises";

import { hasGeneratedBlock, removeGeneratedBlock, upsertGeneratedBlock } from "../../core/generated-marker";
import type { ResourceIR } from "../../ir/types";

function buildContractBlock(ir: ResourceIR): string {
	const key = ir.resource.contractKey;
	const model = ir.resource.modelName;
	const transitionContract = ir.workflow
		? `\n\t\ttransition: defineContract({ method: "POST", path: apiRoutes.${key}.transition.path, input: z.intersection(${model}TransitionParamSchema, ${model}TransitionBodySchema) }),`
		: "";
	const restoreContract = ir.softDelete
		? `\n\t\trestore: defineContract({ method: "POST", path: apiRoutes.${key}.restore.path, input: ${model}IdParamSchema }),`
		: "";
	return `\t${key}: {\n\t\tlist: defineContract({ method: "GET", path: apiRoutes.${key}.list, input: ${model}ListQuerySchema }),\n\t\tdetail: defineContract({ method: "GET", path: apiRoutes.${key}.detail.path, input: ${model}IdParamSchema }),\n\t\tcreate: defineContract({ method: "POST", path: apiRoutes.${key}.create, input: Create${model}Schema }),\n\t\tbulkCreate: defineContract({ method: "POST", path: apiRoutes.${key}.bulkCreate, input: BulkCreate${model}Schema }),\n\t\tbulkDelete: defineContract({ method: "POST", path: apiRoutes.${key}.bulkDelete, input: BulkDeleteIdsSchema }),\n\t\tupdate: defineContract({ method: "PATCH", path: apiRoutes.${key}.update.path, input: z.intersection(${model}IdParamSchema, Update${model}Schema) }),\n\t\tdelete: defineContract({ method: "DELETE", path: apiRoutes.${key}.delete.path, input: ${model}IdParamSchema }),${restoreContract}${transitionContract}\n\t},`;
}

export async function patchContractsIndex(contractsPath: string, ir: ResourceIR): Promise<void> {
	const current = await readFile(contractsPath, "utf8");
	const key = ir.resource.contractKey;
	const slug = ir.resource.slug;
	const model = ir.resource.modelName;
	const importLine = `import { BulkCreate${model}Schema, Create${model}Schema, ${model}IdParamSchema, ${model}ListQuerySchema, Update${model}Schema${ir.workflow ? `, ${model}TransitionBodySchema, ${model}TransitionParamSchema` : ""} } from "../schemas/domain/${slug}.generated";\nimport { BulkDeleteIdsSchema } from "../schemas/api/bulk-mutation";`;

	const importSuffix = `} from "../schemas/domain/${slug}.generated";`;
	let working = current;
	if (!working.includes(importSuffix)) {
		const importAnchor = 'import type { ApiVersion } from "./versioning";';
		if (!working.includes(importAnchor)) {
			throw new Error(`patchContractsIndex: import anchor not found in ${contractsPath}`);
		}
		working = working.replace(importAnchor, `${importLine}\n${importAnchor}`);
		await writeFile(contractsPath, working, "utf8");
	}

	const refreshed = await readFile(contractsPath, "utf8");
	const block = buildContractBlock(ir);
	const anchor = "\n};\n\n/** The full contract tree";
	const anchorIndex = refreshed.indexOf(anchor);
	if (anchorIndex === -1 && !hasGeneratedBlock(refreshed, key)) {
		throw new Error(`patchContractsIndex: block anchor not found in ${contractsPath}`);
	}
	const insertIndex = anchorIndex === -1 ? refreshed.length : anchorIndex;
	const next = upsertGeneratedBlock(refreshed, key, block, insertIndex, { linePrefix: "\t" });
	await writeFile(contractsPath, next, "utf8");
}

/** Removes a resource contract block during rollback. */
export async function unpatchContractsIndex(contractsPath: string, contractKey: string): Promise<void> {
	const current = await readFile(contractsPath, "utf8");
	if (!hasGeneratedBlock(current, contractKey)) {
		return;
	}
	await writeFile(contractsPath, removeGeneratedBlock(current, contractKey), "utf8");
}
