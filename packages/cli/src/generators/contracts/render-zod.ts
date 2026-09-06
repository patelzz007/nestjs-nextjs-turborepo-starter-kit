import type { ResourceIR } from "../../ir/types.js";
import { toSortableCamelNames } from "../nestjs/list-query.js";

function zodField(field: ResourceIR["fields"][number]): string {
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

function prismaEnumValues(ir: ResourceIR): string[] {
	if (ir.workflow === undefined) {
		return [];
	}
	const values = new Set<string>([ir.workflow.initial]);
	for (const targets of Object.values(ir.workflow.transitions)) {
		for (const target of targets) {
			values.add(target);
		}
	}
	return [...values].sort();
}

export function renderZodSchemas(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const lines: string[] = [];
	lines.push('import { z } from "zod";');
	lines.push("");
	lines.push('import type { PaginatedServiceResult } from "../api/api-response";');
	lines.push("");
	lines.push(`/** Generated Zod contracts for ${model}. */`);

	if (ir.workflow !== undefined) {
		const workflowField = ir.fields.find((field) => field.name === ir.workflow?.field);
		const enumSchemaName = workflowField ? `${workflowField.camelName}Schema` : `${ir.workflow.field}Schema`;
		const values = prismaEnumValues(ir);
		lines.push(`export const ${enumSchemaName} = z.enum([${values.map((v) => `"${v}"`).join(", ")}]);`);
		lines.push(`export type ${model}Status = z.output<typeof ${enumSchemaName}>;`);
		const prismaUnion = values.map((value) => `"${value.toUpperCase()}"`).join(" | ");
		lines.push(`export type ${model}PrismaStatus = ${prismaUnion};`);
		lines.push(`export const ${model}StatusToPrisma: Record<${model}Status, ${model}PrismaStatus> = {`);
		for (const value of values) {
			lines.push(`\t${value}: "${value.toUpperCase()}",`);
		}
		lines.push("};");
		lines.push(`export const ${model}StatusFromPrisma: Record<${model}PrismaStatus, ${model}Status> = {`);
		for (const value of values) {
			lines.push(`\t${value.toUpperCase()}: "${value}",`);
		}
		lines.push("};");
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
	lines.push(`export const Update${model}Schema = Create${model}Schema.partial();`);
	lines.push(`export type Update${model}Input = z.output<typeof Update${model}Schema>;`);
	lines.push("");
	lines.push(`export const ${model}IdParamSchema = z.object({ id: z.uuid() }).strict();`);
	const sortableFields = toSortableCamelNames(ir);
	lines.push(`export const ${model}ListSortBySchema = z.enum([${sortableFields.map((field) => `"${field}"`).join(", ")}]);`);
	lines.push(`export type ${model}ListSortBy = z.output<typeof ${model}ListSortBySchema>;`);
	lines.push(`export const ${model}ListQuerySchema = z`);
	lines.push("\t.object({");
	lines.push("\t\tpage: z.coerce.number().int().positive().default(1),");
	lines.push("\t\tlimit: z.coerce.number().int().positive().max(100).default(20),");
	lines.push(`\t\tsortBy: ${model}ListSortBySchema.optional(),`);
	lines.push('\t\tsortDirection: z.enum(["asc", "desc"]).optional(),');
	lines.push("\t\tsearch: z.string().trim().min(1).optional(),");
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
	lines.push("\t\ttotal: z.number().int().nonnegative(),");
	lines.push("\t\tpage: z.number().int().positive(),");
	lines.push("\t\tlimit: z.number().int().positive(),");
	lines.push("\t\ttotalPages: z.number().int().nonnegative().optional(),");
	lines.push("\t\thasNext: z.boolean().optional(),");
	lines.push("\t\thasPrevious: z.boolean().optional(),");
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
		lines.push("");
		lines.push(`export const ${model}TransitionParamSchema = z`);
		lines.push("\t.object({");
		lines.push("\t\tid: z.uuid(),");
		lines.push(`\t\ttransition: z.enum([${transitionValues.map((value) => `"${value}"`).join(", ")}]),`);
		lines.push("\t})");
		lines.push("\t.strict();");
		lines.push(`export const ${model}TransitionBodySchema = z`);
		lines.push("\t.object({");
		lines.push("\t\texpectedVersion: z.number().int().nonnegative(),");
		lines.push("\t\tidempotencyKey: z.string().min(8).max(128),");
		lines.push("\t})");
		lines.push("\t.strict();");
	}

	lines.push("");
	return lines.join("\n");
}
