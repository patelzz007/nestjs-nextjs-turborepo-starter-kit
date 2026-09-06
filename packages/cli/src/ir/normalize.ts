import type { ResourceDefinition } from "../schema/resource-definition.js";
import type { FieldIR, PermissionIR, RelationIR, ResourceIR, WorkflowIR } from "./types.js";

function toCamelCase(value: string): string {
	if (value.length === 0) {
		return value;
	}
	return value.charAt(0).toLowerCase() + value.slice(1);
}

function toSlug(value: string): string {
	return value
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/[\s_]+/g, "-")
		.toLowerCase();
}

function toPlural(singular: string): string {
	if (singular.endsWith("y") && singular.length > 1) {
		return `${singular.slice(0, -1)}ies`;
	}
	if (singular.endsWith("s")) {
		return `${singular}es`;
	}
	return `${singular}s`;
}

function toSnakeCase(value: string): string {
	return value
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/[\s-]+/g, "_")
		.toLowerCase();
}

function toPermissionResourceEnum(modelName: string): string {
	return modelName
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.replace(/[\s-]+/g, "_")
		.toUpperCase();
}

function toContractKey(slug: string): string {
	return slug.replace(/-([a-z])/g, (_match, char: string) => char.toUpperCase());
}

function buildFieldIR(name: string, definition: ResourceDefinition["model"]["fields"][string]): FieldIR {
	const enumValues = definition.type === "enum" ? (definition.values ?? []) : undefined;
	return {
		name,
		camelName: toCamelCase(name),
		prismaName: toSnakeCase(name),
		type: definition.type,
		required: definition.required === true,
		nullable: definition.nullable === true,
		defaultValue: definition.default,
		searchable: definition.searchable === true,
		sortable: definition.sortable === true,
		filterable: definition.filterable === true,
		min: definition.min,
		max: definition.max,
		enumValues,
		relation: definition.relation
			? {
					model: definition.relation.model,
					field: definition.relation.field,
					cardinality: definition.relation.cardinality ?? "one",
				}
			: undefined,
	};
}

function buildRelations(fields: readonly FieldIR[]): RelationIR[] {
	const relations: RelationIR[] = [];
	for (const field of fields) {
		if (field.relation === undefined) {
			continue;
		}
		const joinModelName =
			field.relation.cardinality === "many"
				? `${field.relation.model}${field.relation.model.endsWith("s") ? "" : ""}On${field.name.charAt(0).toUpperCase()}${field.name.slice(1)}`
				: undefined;
		relations.push({
			name: field.name,
			model: field.relation.model,
			field: field.relation.field,
			cardinality: field.relation.cardinality,
			joinModelName,
		});
	}
	return relations;
}

function buildWorkflowIR(definition: ResourceDefinition, modelName: string): WorkflowIR | undefined {
	if (definition.workflow === undefined) {
		return undefined;
	}
	return {
		field: definition.workflow.field,
		initial: definition.workflow.initial,
		transitions: definition.workflow.transitions,
		enumName: `${modelName}Status`,
	};
}

function buildPermissions(definition: ResourceDefinition): PermissionIR[] {
	const defaults = {
		create: true,
		read: true,
		update: true,
		delete: true,
		list: true,
		manage: false,
	};
	const merged = { ...defaults, ...definition.permissions };
	return [
		{ action: "CREATE", enabled: merged.create },
		{ action: "READ", enabled: merged.read },
		{ action: "UPDATE", enabled: merged.update },
		{ action: "DELETE", enabled: merged.delete },
		{ action: "LIST", enabled: merged.list },
		{ action: "MANAGE", enabled: merged.manage },
	];
}

export function normalizeResourceDefinition(definition: ResourceDefinition): ResourceIR {
	const modelName = definition.model.name;
	const singular = definition.name;
	const slug = toSlug(singular);
	const fields = Object.entries(definition.model.fields)
		.map(([name, fieldDef]) => buildFieldIR(name, fieldDef))
		.sort((left, right) => left.name.localeCompare(right.name));

	const listConfig = definition.admin?.list;
	const formConfig = definition.admin?.form;
	const defaultScalarFields = fields.filter((field) => field.type !== "relation").map((field) => field.name);

	return {
		version: definition.version,
		resource: {
			name: singular,
			singular,
			plural: toPlural(singular),
			slug,
			contractKey: toContractKey(slug),
			modelName,
			permissionResource: toPermissionResourceEnum(modelName),
		},
		fields,
		relations: buildRelations(fields),
		workflow: buildWorkflowIR(definition, modelName),
		softDelete: definition.model.softDelete === true,
		concurrency: definition.model.concurrency === true,
		idempotency: definition.model.idempotency === true,
		rls: definition.model.rls,
		permissions: buildPermissions(definition),
		admin: definition.admin
			? {
					navigation: definition.admin.navigation
						? {
								label: definition.admin.navigation.label,
								icon: definition.admin.navigation.icon ?? "Package",
								group: definition.admin.navigation.group ?? "Generated",
								order: definition.admin.navigation.order ?? 100,
								hiddenInProduction: definition.admin.navigation.hiddenInProduction === true,
							}
						: undefined,
					list: {
						searchable: listConfig?.searchable ?? fields.filter((f) => f.searchable).map((f) => f.name),
						filters: listConfig?.filters ?? fields.filter((f) => f.filterable).map((f) => f.name),
						sortable: listConfig?.sortable ?? fields.filter((f) => f.sortable).map((f) => f.name),
						columns: listConfig?.columns ?? defaultScalarFields,
					},
					form: {
						layout: formConfig?.layout ?? "single-column",
						fields: formConfig?.fields ?? defaultScalarFields,
					},
				}
			: undefined,
		events: {
			created: definition.events?.created === true,
			updated: definition.events?.updated === true,
			deleted: definition.events?.deleted === true,
		},
		audit: definition.audit === true,
	};
}
