import type { ResourceDefinition, ResourceFieldDefinition } from "../schema/resource-definition.js";
import type { WizardFieldInput, WizardResourceInput } from "./types.js";

function buildFieldDefinition(field: WizardFieldInput): ResourceFieldDefinition {
	const definition: ResourceFieldDefinition = {
		type: field.type,
	};

	if (field.required) {
		definition.required = true;
	}
	if (field.nullable) {
		definition.nullable = true;
	}
	if (field.searchable) {
		definition.searchable = true;
	}
	if (field.sortable) {
		definition.sortable = true;
	}
	if (field.filterable) {
		definition.filterable = true;
	}
	if (field.defaultValue !== undefined) {
		definition.default = field.defaultValue;
	}
	if (field.enumValues !== undefined && field.enumValues.length > 0) {
		definition.values = [...field.enumValues];
	}
	if (field.relation !== undefined) {
		definition.relation = {
			model: field.relation.model,
			field: field.relation.field,
			cardinality: field.relation.cardinality,
		};
	}

	return definition;
}

export function buildResourceDefinition(input: WizardResourceInput): ResourceDefinition {
	const fields: Record<string, ResourceFieldDefinition> = {};
	for (const field of input.fields) {
		fields[field.name] = buildFieldDefinition(field);
	}

	const searchableFields = input.fields.filter((field) => field.searchable).map((field) => field.name);
	const sortableFields = input.fields.filter((field) => field.sortable).map((field) => field.name);
	const filterableFields = input.fields.filter((field) => field.filterable).map((field) => field.name);
	const columnFields = input.fields.map((field) => field.name);

	const definition: ResourceDefinition = {
		version: 1,
		name: input.name,
		model: {
			name: input.name,
			softDelete: input.softDelete,
			concurrency: input.concurrency,
			idempotency: input.idempotency,
			rls: input.rls,
			fields,
		},
		permissions: {
			create: true,
			read: true,
			update: true,
			delete: true,
			list: true,
		},
		admin: {
			navigation: {
				label: input.navigationLabel,
			},
			list: {
				searchable: searchableFields,
				sortable: sortableFields.includes("createdAt") ? sortableFields : [...sortableFields, "createdAt"],
				filters: filterableFields,
				columns: columnFields,
			},
			form: {
				layout: columnFields.length > 4 ? "two-column" : "single-column",
				fields: columnFields,
			},
		},
	};

	return definition;
}
