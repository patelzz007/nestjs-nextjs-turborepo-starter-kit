import type { FieldIR, ResourceIR } from "../../ir/types.js";
import { fieldByName, isTextSearchableField, resolveSearchableFieldNames, toSortableCamelNames } from "./list-query.js";

function relationPropertyName(fieldName: string): string {
	if (fieldName.endsWith("Id")) {
		return fieldName.slice(0, -2);
	}
	return fieldName;
}

function defaultBooleanLiteral(field: FieldIR): string {
	if (field.defaultValue === true || field.defaultValue === false) {
		return String(field.defaultValue);
	}
	return "false";
}

function defaultIntLiteral(field: FieldIR): string {
	if (field.defaultValue !== undefined) {
		return String(field.defaultValue);
	}
	return "0";
}

function renderDomainFieldLine(field: FieldIR, ir: ResourceIR, model: string): string {
	const { camelName } = field;
	if (ir.workflow !== undefined && field.name === ir.workflow.field) {
		return `\t\t${camelName}: row.${camelName} === null ? "${ir.workflow.initial}" : ${model}StatusFromPrisma[row.${camelName}],`;
	}
	if (field.type === "datetime") {
		if (field.nullable) {
			return `\t\t${camelName}: row.${camelName} === null ? null : Number(row.${camelName}),`;
		}
		return `\t\t${camelName}: Number(row.${camelName}),`;
	}
	if (field.type === "decimal") {
		if (field.nullable) {
			return `\t\t${camelName}: row.${camelName} === null ? null : Number(row.${camelName}),`;
		}
		return `\t\t${camelName}: Number(row.${camelName}),`;
	}
	if (field.type === "boolean" && field.nullable) {
		return `\t\t${camelName}: row.${camelName} ?? ${defaultBooleanLiteral(field)},`;
	}
	if (field.type === "int") {
		if (field.nullable) {
			return `\t\t${camelName}: row.${camelName},`;
		}
		if (!field.required) {
			return `\t\t${camelName}: row.${camelName} ?? ${defaultIntLiteral(field)},`;
		}
	}
	return `\t\t${camelName}: row.${camelName},`;
}

function renderToDomain(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const scalarFields = ir.fields.filter((item) => item.type !== "relation");
	const fieldLines = scalarFields.map((field) => renderDomainFieldLine(field, ir, model)).join("\n");
	const tailLines: string[] = [];
	if (ir.concurrency) {
		tailLines.push("\t\tversion: row.version,");
	}
	if (ir.softDelete) {
		tailLines.push("\t\tdeletedAt: row.deletedAt === null ? null : Number(row.deletedAt),");
	}
	tailLines.push("\t\tcreatedAt: Number(row.createdAt),");
	tailLines.push("\t\tupdatedAt: Number(row.updatedAt),");

	return `function toDomain(row: Prisma.${model}GetPayload<Record<string, never>>): ${model}Entity {
\treturn {
\t\tid: row.id,
${fieldLines}
${tailLines.join("\n")}
\t};
}`;
}

function needsInputMappers(ir: ResourceIR): boolean {
	return ir.workflow !== undefined || ir.fields.some((field) => field.relation !== undefined);
}

function renderCreateMapper(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const scalarFields = ir.fields.filter((item) => item.type !== "relation");
	const lines: string[] = [];
	for (const field of scalarFields) {
		if (field.relation !== undefined) {
			const propertyName = relationPropertyName(field.name);
			if (field.required) {
				lines.push(`\t\t${propertyName}: { connect: { id: input.${field.camelName} } },`);
			} else {
				lines.push(`\t\t...(input.${field.camelName} != null ? { ${propertyName}: { connect: { id: input.${field.camelName} } } } : {}),`);
			}
			continue;
		}
		if (ir.workflow !== undefined && field.name === ir.workflow.field) {
			lines.push(`\t\t${field.camelName}: input.${field.camelName} === undefined ? undefined : ${model}StatusToPrisma[input.${field.camelName}],`);
			continue;
		}
		lines.push(`\t\t${field.camelName}: input.${field.camelName},`);
	}
	return `function toPrismaCreateInput(input: Create${model}Input): Prisma.${model}CreateInput {
\treturn {
${lines.join("\n")}
\t};
}`;
}

function renderUpdateMapper(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const scalarFields = ir.fields.filter((item) => item.type !== "relation");
	const lines = scalarFields.map((field) => {
		if (field.relation !== undefined) {
			const propertyName = relationPropertyName(field.name);
			if (field.nullable) {
				return `\tif (input.${field.camelName} !== undefined) {\n\t\tdata.${propertyName} = input.${field.camelName} === null ? { disconnect: true } : { connect: { id: input.${field.camelName} } };\n\t}`;
			}
			return `\tif (input.${field.camelName} !== undefined) {\n\t\tdata.${propertyName} = { connect: { id: input.${field.camelName} } };\n\t}`;
		}
		if (ir.workflow !== undefined && field.name === ir.workflow.field) {
			return `\tif (input.${field.camelName} !== undefined) {\n\t\tdata.${field.camelName} = input.${field.camelName} === null ? null : ${model}StatusToPrisma[input.${field.camelName}];\n\t}`;
		}
		return `\tif (input.${field.camelName} !== undefined) {\n\t\tdata.${field.camelName} = input.${field.camelName};\n\t}`;
	});
	return `function toPrismaUpdateInput(input: Update${model}Input): Prisma.${model}UpdateInput {
\tconst data: Prisma.${model}UpdateInput = {};
${lines.join("\n")}
	return data;
}`;
}

function renderListQueryHelpers(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const sortableFields = toSortableCamelNames(ir);
	const searchableFields = resolveSearchableFieldNames(ir);
	const searchLines: string[] = [];
	for (const fieldName of searchableFields) {
		const field = fieldByName(ir, fieldName);
		if (field === undefined || !isTextSearchableField(field)) {
			continue;
		}
		searchLines.push(`\t\t{ ${field.camelName}: { contains: trimmedSearch, mode: "insensitive" } },`);
	}

	const softDeleteLine = ir.softDelete ? "\t\tdeletedAt: null," : "";

	return `const SORTABLE_FIELDS: ReadonlySet<string> = new Set([${sortableFields.map((field) => `"${field}"`).join(", ")}]);

function buildSearchConditions(trimmedSearch: string): Prisma.${model}WhereInput[] {
\treturn [
${searchLines.join("\n")}
\t];
}

function resolveOrderBy(query: ${model}ListQuery): Prisma.${model}OrderByWithRelationInput {
\tconst sortBy = query.sortBy ?? "createdAt";
\tconst sortDirection = query.sortDirection ?? "desc";
\tif (!SORTABLE_FIELDS.has(sortBy)) {
\t\treturn { createdAt: "desc" };
\t}
\treturn { [sortBy]: sortDirection };
}

function buildListWhere(query: ${model}ListQuery): Prisma.${model}WhereInput {
\tconst where: Prisma.${model}WhereInput = {
${softDeleteLine}
\t};
\tconst trimmedSearch = query.search?.trim();
\tif (trimmedSearch !== undefined && trimmedSearch.length > 0) {
\t\tconst searchConditions = buildSearchConditions(trimmedSearch);
\t\tif (searchConditions.length > 0) {
\t\t\twhere.OR = searchConditions;
\t\t}
\t}
\treturn where;
}`;
}

function renderRepositoryPorts(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const findByIdWhere = ir.softDelete
		? `\tbuildFindByIdWhere: (id: string): Prisma.${model}WhereInput => ({ id, deletedAt: null }),`
		: `\tbuildFindByIdWhere: (id: string): Prisma.${model}WhereInput => ({ id }),`;
	const updateWhere = ir.concurrency
		? `\tbuildUpdateWhere: (id: string, expectedVersion?: number): Prisma.${model}WhereUniqueInput => ({ id, version: expectedVersion }),`
		: `\tbuildUpdateWhere: (id: string): Prisma.${model}WhereUniqueInput => ({ id }),`;
	const stampUpdate = ir.concurrency
		? `\tstampUpdate: (data: Prisma.${model}UpdateInput): Prisma.${model}UpdateInput => ({ ...data, version: { increment: 1 }, updatedAt: nowEpochMs() }),`
		: `\tstampUpdate: (data: Prisma.${model}UpdateInput): Prisma.${model}UpdateInput => ({ ...data, updatedAt: nowEpochMs() }),`;
	const createInput = needsInputMappers(ir) ? "toPrismaCreateInput" : `(input: Create${model}Input): Prisma.${model}CreateInput => input`;
	const updateInput = needsInputMappers(ir) ? "toPrismaUpdateInput" : `(input: Update${model}Input): Prisma.${model}UpdateInput => input`;

	return `const ${model}RepositoryPorts = {
\ttoDomain,
\ttoCreateInput: ${createInput},
\ttoUpdateInput: ${updateInput},
\tbuildListWhere,
\tbuildListOrderBy: resolveOrderBy,
${findByIdWhere}
${updateWhere}
${stampUpdate}
\tstampSoftDelete: (): Prisma.${model}UpdateInput => ({ deletedAt: nowEpochMs(), updatedAt: nowEpochMs() }),
\tstampRestore: (): Prisma.${model}UpdateInput => ({ deletedAt: null, updatedAt: nowEpochMs() }),
};`;
}

export function renderNestRepository(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const delegate = model.charAt(0).toLowerCase() + model.slice(1);
	const workflowFieldCamel = ir.fields.find((field) => field.name === ir.workflow?.field)?.camelName;
	const usesMappers = needsInputMappers(ir);
	const workflowValueImports = ir.workflow !== undefined ? `,\n\t${model}StatusFromPrisma,\n\t${model}StatusToPrisma` : "";
	const workflowTypeImports = ir.workflow !== undefined ? `, ${model}Status` : "";
	const mapperBlock = `\n${renderToDomain(ir)}${usesMappers ? `\n\n${renderCreateMapper(ir)}\n\n${renderUpdateMapper(ir)}` : ""}\n`;

	return `import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import {
\tnowEpochMs,
\ttype Create${model}Input,
\ttype ${model} as ${model}Entity,
\ttype ${model}ListQuery,
\ttype Update${model}Input${workflowTypeImports}${workflowValueImports},
} from "@workspace/shared";

import { BaseRepository } from "../../platform/persistence/base.repository";
import { PrismaService } from "../../prisma/prisma.service";

${mapperBlock}${renderListQueryHelpers(ir)}

${renderRepositoryPorts(ir)}

@Injectable()
export class Generated${model}Repository extends BaseRepository<
\t${model}Entity,
\tCreate${model}Input,
\tUpdate${model}Input,
\t${model}ListQuery,
\tPrisma.${model}GetPayload<Record<string, never>>,
\tPrisma.${model}WhereInput,
\tPrisma.${model}OrderByWithRelationInput,
\tPrisma.${model}CreateInput,
\tPrisma.${model}UpdateInput,
\tPrisma.${model}WhereUniqueInput
> {
	public constructor(prisma: PrismaService) {
		super(prisma, ${model}RepositoryPorts, prisma.${delegate}, { softDelete: ${ir.softDelete ? "true" : "false"}, concurrency: ${ir.concurrency ? "true" : "false"} });
	}
${
	ir.workflow && workflowFieldCamel
		? `
	public async transition(id: string, expectedVersion: number, nextStatus: ${model}Status): Promise<${model}Entity> {
		const row = await this.prisma.${delegate}.update({
			where: { id, version: expectedVersion },
			data: { ${workflowFieldCamel}: ${model}StatusToPrisma[nextStatus], version: { increment: 1 }, updatedAt: nowEpochMs() },
		});
		return toDomain(row);
	}
`
		: ""
}
}
`;
}
