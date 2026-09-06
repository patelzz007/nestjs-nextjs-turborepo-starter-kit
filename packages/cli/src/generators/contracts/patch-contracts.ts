import { readFile, writeFile } from "node:fs/promises";

import { insertBeforeAnchor } from "../../core/patch-insert.js";
import type { ResourceIR } from "../../ir/types.js";

const BEGIN = "// @app-generated:begin";
const END = "// @app-generated:end";

function buildContractBlock(ir: ResourceIR): string {
	const key = ir.resource.contractKey;
	const model = ir.resource.modelName;
	const transitionContract = ir.workflow
		? `\n\t\ttransition: defineContract({ method: "POST", path: apiRoutes.${key}.transition.path, input: z.intersection(${model}TransitionParamSchema, ${model}TransitionBodySchema) }),`
		: "";
	return `\t${key}: {\n\t\tlist: defineContract({ method: "GET", path: apiRoutes.${key}.list, input: ${model}ListQuerySchema }),\n\t\tdetail: defineContract({ method: "GET", path: apiRoutes.${key}.detail.path, input: ${model}IdParamSchema }),\n\t\tcreate: defineContract({ method: "POST", path: apiRoutes.${key}.create, input: Create${model}Schema }),\n\t\tupdate: defineContract({ method: "PATCH", path: apiRoutes.${key}.update.path, input: z.intersection(${model}IdParamSchema, Update${model}Schema) }),\n\t\tdelete: defineContract({ method: "DELETE", path: apiRoutes.${key}.delete.path, input: ${model}IdParamSchema }),\n\t\trestore: defineContract({ method: "POST", path: apiRoutes.${key}.restore.path, input: ${model}IdParamSchema }),${transitionContract}\n\t},`;
}

export async function patchContractsIndex(contractsPath: string, ir: ResourceIR): Promise<void> {
	const current = await readFile(contractsPath, "utf8");
	const key = ir.resource.contractKey;
	const slug = ir.resource.slug;
	const marker = `${BEGIN} ${key}`;
	const endMarker = `${END} ${key}`;
	const model = ir.resource.modelName;
	const importLine = `import { Create${model}Schema, ${model}IdParamSchema, ${model}ListQuerySchema, Update${model}Schema${ir.workflow ? `, ${model}TransitionBodySchema, ${model}TransitionParamSchema` : ""} } from "../schemas/domain/${slug}.generated";`;

	const importSuffix = `} from "../schemas/domain/${slug}.generated";`;
	if (!current.includes(importSuffix)) {
		const importAnchor = 'import type { ApiVersion } from "./versioning";';
		const withImport = current.replace(importAnchor, `${importLine}\n${importAnchor}`);
		await writeFile(contractsPath, withImport, "utf8");
	}

	const refreshed = await readFile(contractsPath, "utf8");
	const block = buildContractBlock(ir);
	const wrapped = `${marker}\n${block}\n\t${endMarker}`;

	if (refreshed.includes(marker)) {
		const start = refreshed.indexOf(marker);
		const end = refreshed.indexOf(endMarker);
		const next = `${refreshed.slice(0, start)}${wrapped}${refreshed.slice(end + endMarker.length)}`;
		await writeFile(contractsPath, next, "utf8");
		return;
	}

	const next = insertBeforeAnchor(refreshed, "\n};\n\n/** The full contract tree", wrapped);
	await writeFile(contractsPath, next, "utf8");
}
