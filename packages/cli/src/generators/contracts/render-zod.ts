import { tsStringLiteral } from "../../core/ts-literal";
import type { FieldIR, ResourceIR } from "../../ir/types";
import { renderZodListQueryFilterField, resolveListFilterFields } from "../admin/list-filters";
import { toSortableCamelNames } from "../nestjs/list-query";

function hasBooleanListFilters(ir: ResourceIR): boolean {
	return resolveListFilterFields(ir).some((field) => field.type === "boolean");
}

function zodField(field: FieldIR): string {
	switch (field.type) {
		case "string":
			return "z.string()";
		case "text":
			return "z.string()";
		case "boolean":
			return "z.boolean()";
		case "int":
			return "z.number().int()";
		case "decimal":
			return "z.coerce.number()";
		case "uuid":
			return "z.uuid()";
		case "datetime":
			return "z.number().int().nonnegative()";
		case "enum":
			return `${field.camelName}Schema`;
		default:
			return "z.string()";
	}
}

function enumFields(ir: ResourceIR): FieldIR[] {
	return ir.fields.filter((field) => field.type === "enum");
}

function renderEnumSchemaLines(field: FieldIR, ir: ResourceIR): string[] {
	const values = field.enumValues ?? [];
	if (values.length === 0) {
		return [];
	}
	const lines: string[] = [];
	const schemaName = `${field.camelName}Schema`;
	const enumLiteral = values.map((value) => tsStringLiteral(value)).join(", ");
	lines.push(`export const ${schemaName} = z.enum([${enumLiteral}]);`);
	const model = ir.resource.modelName;
	const typeName = `${model}${field.name.charAt(0).toUpperCase()}${field.name.slice(1)}`;
	lines.push(`export type ${typeName} = z.output<typeof ${schemaName}>;`);

	if (ir.workflow !== undefined && field.name === ir.workflow.field) {
		const prismaUnion = values.map((value) => `"${value.toUpperCase()}"`).join(" | ");
		lines.push(`export type ${model}PrismaStatus = ${prismaUnion};`);
		lines.push(`export const ${model}StatusToPrisma: Record<${typeName}, ${model}PrismaStatus> = {`);
		for (const value of values) {
			lines.push(`\t${value}: "${value.toUpperCase()}",`);
		}
		lines.push("};");
		lines.push(`export const ${model}StatusFromPrisma: Record<${model}PrismaStatus, ${typeName}> = {`);
		for (const value of values) {
			lines.push(`\t${value.toUpperCase()}: ${tsStringLiteral(value)},`);
		}
		lines.push("};");
		lines.push(`export type ${model}Status = ${typeName};`);
	} else {
		const prismaTypeName = `${model}${field.name.charAt(0).toUpperCase()}${field.name.slice(1)}Prisma`;
		const prismaUnion = values.map((value) => `"${value.toUpperCase()}"`).join(" | ");
		lines.push(`export type ${prismaTypeName} = ${prismaUnion};`);
		lines.push(`export const ${field.camelName}ToPrisma: Record<${typeName}, ${prismaTypeName}> = {`);
		for (const value of values) {
			lines.push(`\t${value}: "${value.toUpperCase()}",`);
		}
		lines.push("};");
		lines.push(`export const ${field.camelName}FromPrisma: Record<${prismaTypeName}, ${typeName}> = {`);
		for (const value of values) {
			lines.push(`\t${value.toUpperCase()}: ${tsStringLiteral(value)},`);
		}
		lines.push("};");
	}

	return lines;
}

export function renderZodSchemas(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const lines: string[] = [];
	lines.push('import { BULK_MUTATION_MAX_ITEMS } from "../api/bulk-mutation";');
	lines.push('import { z } from "zod";');
	if (hasBooleanListFilters(ir)) {
		lines.push('import { BooleanQueryParamSchema } from "../api/query-params";');
	}
	lines.push("");
	lines.push('import type { PaginatedServiceResult } from "../api/api-response";');
	lines.push("");
	lines.push(`/** Generated Zod contracts for ${model}. */`);

	const enumSchemaBlocks = enumFields(ir)
		.map((field) => renderEnumSchemaLines(field, ir).join("\n"))
		.filter((block) => block.length > 0);
	if (enumSchemaBlocks.length > 0) {
		lines.push(enumSchemaBlocks.join("\n\n"));
		lines.push("");
	}

	const createFields = ir.fields.filter((field) => field.type !== "relation");
	const createObject = createFields
		.map((field) => {
			const schema = zodField(field);
			const optional = field.required ? "" : ".optional()";
			const nullable = field.nullable ? ".nullable()" : "";
			return `\t\t${field.camelName}: ${schema}${nullable}${optional},`;
		})
		.join("\n");

	lines.push(`export const Create${model}Schema = z`);
	lines.push("\t.object({");
	lines.push(createObject);
	lines.push("\t})");
	lines.push("\t.strict();");
	lines.push(`export type Create${model}Input = z.output<typeof Create${model}Schema>;`);
	lines.push("");
	lines.push(`export const BulkCreate${model}Schema = z`);
	lines.push("\t.object({");
	lines.push(`\t\titems: z.array(Create${model}Schema).min(1).max(BULK_MUTATION_MAX_ITEMS),`);
	lines.push("\t})");
	lines.push("\t.strict();");
	lines.push(`export type BulkCreate${model}Input = z.output<typeof BulkCreate${model}Schema>;`);
	lines.push("");
	lines.push(`export const Update${model}Schema = Create${model}Schema.partial();`);
	lines.push(`export type Update${model}Input = z.output<typeof Update${model}Schema>;`);
	lines.push("");
	lines.push(`export const ${model}IdParamSchema = z.object({ id: z.uuid() }).strict();`);
	const sortableFields = toSortableCamelNames(ir);
	lines.push(`export const ${model}ListSortBySchema = z.enum([${sortableFields.map((field) => tsStringLiteral(field)).join(", ")}]);`);
	lines.push(`export type ${model}ListSortBy = z.output<typeof ${model}ListSortBySchema>;`);
	lines.push(`export const ${model}ListQuerySchema = z`);
	lines.push("\t.object({");
	lines.push("\t\tpage: z.coerce.number().int().min(1).optional().default(1),");
	lines.push("\t\tcursor: z.string().min(1).optional(),");
	lines.push("\t\tlimit: z.coerce.number().int().positive().max(100).default(20),");
	lines.push(`\t\tsortBy: ${model}ListSortBySchema.optional(),`);
	lines.push('\t\tsortDirection: z.enum(["asc", "desc"]).optional(),');
	lines.push("\t\tsearch: z.string().trim().min(1).optional(),");
	for (const field of resolveListFilterFields(ir)) {
		const filterLine = renderZodListQueryFilterField(field);
		if (filterLine.length > 0) {
			lines.push(filterLine);
		}
	}
	lines.push("\t})");
	lines.push("\t.strict();");
	lines.push(`export type ${model}ListQuery = z.output<typeof ${model}ListQuerySchema>;`);
	lines.push("");
	lines.push(`export const ${model}Schema = z`);
	lines.push("\t.object({");
	lines.push("\t\tid: z.uuid(),");
	for (const field of createFields) {
		lines.push(`\t\t${field.camelName}: ${zodField(field)}${field.nullable ? ".nullable()" : ""},`);
	}
	if (ir.concurrency) {
		lines.push("\t\tversion: z.number().int().nonnegative(),");
	}
	if (ir.softDelete) {
		lines.push("\t\tdeletedAt: z.number().int().nonnegative().nullable(),");
	}
	lines.push("\t\tcreatedAt: z.number().int().nonnegative(),");
	lines.push("\t\tupdatedAt: z.number().int().nonnegative(),");
	lines.push("\t})");
	lines.push("\t.strict();");
	lines.push(`export type ${model} = z.output<typeof ${model}Schema>;`);
	lines.push("");
	lines.push(`export const ${model}ListResponseSchema = z`);
	lines.push("\t.object({");
	lines.push(`\t\titems: z.array(${model}Schema),`);
	lines.push("\t\tlimit: z.number().int().positive(),");
	lines.push("\t\tnextCursor: z.string().nullable(),");
	lines.push("\t\thasNext: z.boolean(),");
	lines.push("\t})");
	lines.push("\t.strict();");
	lines.push(`export type ${model}ListResponse = PaginatedServiceResult<${model}>;`);

	if (ir.workflow !== undefined) {
		const targetTransitions = new Set<string>();
		for (const targets of Object.values(ir.workflow.transitions)) {
			for (const target of targets) {
				targetTransitions.add(target);
			}
		}
		const transitionValues = [...targetTransitions].sort();
		const workflowField = ir.fields.find((field) => field.name === ir.workflow?.field);
		const statusTypeName = workflowField !== undefined ? `${model}${workflowField.name.charAt(0).toUpperCase()}${workflowField.name.slice(1)}` : `${model}Status`;
		lines.push("");
		lines.push(`export const ${model}TransitionParamSchema = z`);
		lines.push("\t.object({");
		lines.push("\t\tid: z.uuid(),");
		lines.push(`\t\ttransition: z.enum([${transitionValues.map((value) => tsStringLiteral(value)).join(", ")}]),`);
		lines.push("\t})");
		lines.push("\t.strict();");
		lines.push(`export const ${model}TransitionBodySchema = z`);
		lines.push("\t.object({");
		lines.push("\t\texpectedVersion: z.number().int().nonnegative(),");
		lines.push("\t\tidempotencyKey: z.string().min(8).max(128),");
		lines.push("\t})");
		lines.push("\t.strict();");
		lines.push(`export type ${model}TransitionStatus = ${statusTypeName};`);
	}

	lines.push("");
	return lines.join("\n");
}
