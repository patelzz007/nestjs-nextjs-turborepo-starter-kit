import { readFile, writeFile } from "node:fs/promises";

import { hasGeneratedBlock, removeGeneratedBlock, upsertGeneratedBlock } from "../../core/generated-marker";
import type { ResourceIR } from "../../ir/types";

function buildExportBlockContent(ir: ResourceIR): string {
	const slug = ir.resource.slug;
	const model = ir.resource.modelName;
	const workflowSchemaExports = ir.workflow ? `,\n\t${model}TransitionBodySchema,\n\t${model}TransitionParamSchema` : "";
	const enumFields = ir.fields.filter((field) => field.type === "enum" && field.name !== ir.workflow?.field);
	const enumSchemaExports = enumFields.length > 0 ? `,\n\t${enumFields.map((field) => `${field.camelName}Schema`).join(",\n\t")}` : "";
	const workflowEnumSchema = ir.workflow
		? `,\n\t${ir.fields.find((field) => field.name === ir.workflow?.field)?.camelName ?? "status"}Schema`
		: "";
	const workflowValueExports = ir.workflow ? `,\n\t${model}StatusFromPrisma,\n\t${model}StatusToPrisma` : "";
	const workflowTypeExports = ir.workflow ? `,\n\t${model}PrismaStatus,\n\t${model}Status` : "";
	const enumTypeExports =
		enumFields.length > 0 ? `,\n\t${enumFields.map((field) => `${field.camelName.charAt(0).toUpperCase()}${field.camelName.slice(1)}`).join(",\n\t")}` : "";
	return `export {\n\tBulkCreate${model}Schema,\n\tCreate${model}Schema,\n\t${model}IdParamSchema,\n\t${model}ListQuerySchema,\n\t${model}ListResponseSchema,\n\t${model}Schema,\n\tUpdate${model}Schema${workflowSchemaExports}${workflowEnumSchema}${enumSchemaExports}${workflowValueExports},\n} from "./domain/${slug}.generated";\nexport type {\n\tBulkCreate${model}Input,\n\tCreate${model}Input,\n\t${model},\n\t${model}ListQuery,\n\t${model}ListResponse,\n\tUpdate${model}Input${workflowTypeExports}${enumTypeExports},\n} from "./domain/${slug}.generated";`;
}

export async function patchSchemasIndex(schemasIndexPath: string, ir: ResourceIR): Promise<void> {
	const current = await readFile(schemasIndexPath, "utf8");
	const key = ir.resource.contractKey;
	const block = buildExportBlockContent(ir);
	const anchor = "export {\n\tPlatformResourceAuditInputSchema,";
	const anchorIndex = current.indexOf(anchor);
	if (anchorIndex === -1 && !hasGeneratedBlock(current, key)) {
		throw new Error(`patchSchemasIndex: anchor not found in ${schemasIndexPath}`);
	}
	const insertIndex = anchorIndex === -1 ? current.length : anchorIndex;
	const next = upsertGeneratedBlock(current, key, block, insertIndex);
	await writeFile(schemasIndexPath, next, "utf8");
}

/** Removes a resource schemas index block during rollback. */
export async function unpatchSchemasIndex(schemasIndexPath: string, contractKey: string): Promise<void> {
	const current = await readFile(schemasIndexPath, "utf8");
	if (!hasGeneratedBlock(current, contractKey)) {
		return;
	}
	await writeFile(schemasIndexPath, removeGeneratedBlock(current, contractKey), "utf8");
}
