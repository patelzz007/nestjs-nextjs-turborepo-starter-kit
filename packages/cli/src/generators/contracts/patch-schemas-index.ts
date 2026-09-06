import { readFile, writeFile } from "node:fs/promises";

import type { ResourceIR } from "../../ir/types.js";

const BEGIN = "// @app-generated:begin";
const END = "// @app-generated:end";

function buildExportBlock(ir: ResourceIR): string {
	const slug = ir.resource.slug;
	const model = ir.resource.modelName;
	const workflowSchemaExports = ir.workflow ? `,\n\t${model}TransitionBodySchema,\n\t${model}TransitionParamSchema` : "";
	const enumSchema = ir.workflow ? `,\n\t${ir.fields.find((field) => field.name === ir.workflow?.field)?.camelName ?? "status"}Schema` : "";
	const workflowValueExports = ir.workflow ? `,\n\t${model}StatusFromPrisma,\n\t${model}StatusToPrisma` : "";
	const workflowTypeExports = ir.workflow ? `,\n\t${model}PrismaStatus,\n\t${model}Status` : "";
	return `${BEGIN} ${ir.resource.contractKey}\nexport {\n\tCreate${model}Schema,\n\t${model}IdParamSchema,\n\t${model}ListQuerySchema,\n\t${model}ListResponseSchema,\n\t${model}Schema,\n\tUpdate${model}Schema${workflowSchemaExports}${enumSchema}${workflowValueExports},\n} from "./domain/${slug}.generated";\nexport type {\n\tCreate${model}Input,\n\t${model},\n\t${model}ListQuery,\n\t${model}ListResponse,\n\tUpdate${model}Input${workflowTypeExports},\n} from "./domain/${slug}.generated";\n${END} ${ir.resource.contractKey}`;
}

export async function patchSchemasIndex(schemasIndexPath: string, ir: ResourceIR): Promise<void> {
	const current = await readFile(schemasIndexPath, "utf8");
	const marker = `${BEGIN} ${ir.resource.contractKey}`;
	const endMarker = `${END} ${ir.resource.contractKey}`;
	const block = buildExportBlock(ir);
	if (current.includes(marker)) {
		const start = current.indexOf(marker);
		const end = current.indexOf(endMarker);
		const next = `${current.slice(0, start)}${block}${current.slice(end + endMarker.length)}`;
		await writeFile(schemasIndexPath, next, "utf8");
		return;
	}

	const anchor = "export {\n\tPlatformResourceAuditInputSchema,";
	const next = current.replace(anchor, `${block}\n${anchor}`);
	await writeFile(schemasIndexPath, next, "utf8");
}
