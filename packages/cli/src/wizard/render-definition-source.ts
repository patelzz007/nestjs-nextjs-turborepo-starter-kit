import type { ResourceDefinition, ResourceFieldDefinition } from "../schema/resource-definition";

function renderPrimitive(value: string | number | boolean): string {
	if (typeof value === "string") {
		return JSON.stringify(value);
	}
	return String(value);
}

function renderFieldDefinition(field: ResourceFieldDefinition): string {
	const lines: string[] = [`type: "${field.type}"`];

	if (field.required === true) {
		lines.push("required: true");
	}
	if (field.nullable === true) {
		lines.push("nullable: true");
	}
	if (field.searchable === true) {
		lines.push("searchable: true");
	}
	if (field.sortable === true) {
		lines.push("sortable: true");
	}
	if (field.filterable === true) {
		lines.push("filterable: true");
	}
	if (field.default !== undefined) {
		lines.push(`default: ${renderPrimitive(field.default)}`);
	}
	if (field.values !== undefined && field.values.length > 0) {
		lines.push(`values: [${field.values.map((item) => JSON.stringify(item)).join(", ")}]`);
	}
	if (field.relation !== undefined) {
		const cardinality = field.relation.cardinality ?? "one";
		lines.push(
			`relation: {\n\t\t\t\tmodel: ${JSON.stringify(field.relation.model)},\n\t\t\t\tfield: ${JSON.stringify(field.relation.field)},\n\t\t\t\tcardinality: ${JSON.stringify(cardinality)},\n\t\t\t}`,
		);
	}

	return lines.map((line) => `\t\t\t\t${line}`).join(",\n");
}

export function renderResourceDefinitionSource(definition: ResourceDefinition): string {
	const fieldBlocks = Object.entries(definition.model.fields)
		.map(([name, field]) => `\t\t\t${name}: {\n${renderFieldDefinition(field)}\n\t\t\t}`)
		.join(",\n");

	const adminList = definition.admin?.list;
	const adminNavigation = definition.admin?.navigation;
	const adminForm = definition.admin?.form;

	return `import { defineResource } from "@workspace/cli";

export default defineResource({
\tversion: 1,
\tname: ${JSON.stringify(definition.name)},
\tmodel: {
\t\tname: ${JSON.stringify(definition.model.name)},
\t\tsoftDelete: ${String(definition.model.softDelete === true)},
\t\tconcurrency: ${String(definition.model.concurrency === true)},
\t\tidempotency: ${String(definition.model.idempotency === true)},
\t\trls: ${JSON.stringify(definition.model.rls)},
\t\tfields: {
${fieldBlocks}
\t\t},
\t},
\tpermissions: {
\t\tcreate: true,
\t\tread: true,
\t\tupdate: true,
\t\tdelete: true,
\t\tlist: true,
\t},
\tadmin: {
\t\tnavigation: {
\t\t\tlabel: ${JSON.stringify(adminNavigation?.label ?? definition.name)},
\t\t},
\t\tlist: {
\t\t\tsearchable: [${(adminList?.searchable ?? []).map((item) => JSON.stringify(item)).join(", ")}],
\t\t\tsortable: [${(adminList?.sortable ?? []).map((item) => JSON.stringify(item)).join(", ")}],
\t\t\tfilters: [${(adminList?.filters ?? []).map((item) => JSON.stringify(item)).join(", ")}],
\t\t\tcolumns: [${(adminList?.columns ?? []).map((item) => JSON.stringify(item)).join(", ")}],
\t\t},
\t\tform: {
\t\t\tlayout: ${JSON.stringify(adminForm?.layout ?? "single-column")},
\t\t\tfields: [${(adminForm?.fields ?? []).map((item) => JSON.stringify(item)).join(", ")}],
\t\t},
\t},
});
`;
}
