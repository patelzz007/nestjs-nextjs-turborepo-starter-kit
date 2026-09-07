import { pluralizeLabel } from "../core/humanize";
import type { ResourceDefinition, UiModuleConfig } from "../schema/resource-definition";
import type { GeneratorModule } from "../schema/generator-modules";
import { buildCascadeSoftDeleteChildren } from "./cascade-soft-delete";
import { buildUiTargetIR } from "./ui-context";
import type { FieldIR, PermissionIR, RelationIR, ResourceIR, UiTargetIR, WorkflowIR } from "./types";

function toCamelCase(value: string): string {
	if (value.length === 0) {
		return value;
	}
	return value.charAt(0).toLowerCase() + value.slice(1);
}

function toSlug(value: string): string {
	return value
		.replace(/[/\\.:]+/g, "")
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/[\s_]+/g, "-")
		.toLowerCase();
}

function toPlural(singular: string): string {
	return pluralizeLabel(singular);
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
					cascadeSoftDelete: definition.relation.cascadeSoftDelete === true,
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

function buildUiTargetFromConfig(moduleId: string, config: UiModuleConfig, defaultScalarFields: readonly string[], fields: readonly FieldIR[]): UiTargetIR {
	const listConfig = config.list;
	const formConfig = config.form;
	return buildUiTargetIR(moduleId, {
		navigation: config.navigation
			? {
					label: config.navigation.label,
					icon: config.navigation.icon ?? "Package",
					group: config.navigation.group ?? "Generated",
					order: config.navigation.order ?? 100,
					hiddenInProduction: config.navigation.hiddenInProduction === true,
				}
			: undefined,
		list: {
			searchable: listConfig?.searchable ?? fields.filter((field) => field.searchable).map((field) => field.name),
			filters: listConfig?.filters ?? fields.filter((field) => field.filterable).map((field) => field.name),
			sortable: listConfig?.sortable ?? fields.filter((field) => field.sortable).map((field) => field.name),
			columns: listConfig?.columns ?? defaultScalarFields,
		},
		form: {
			layout: formConfig?.layout ?? "single-column",
			fields: formConfig?.fields ?? defaultScalarFields,
		},
	});
}

function validateScopeModules(scopeUi: readonly string[], modules: readonly GeneratorModule[]): void {
	for (const moduleId of scopeUi) {
		const found = modules.some((module) => module.id === moduleId);
		if (!found) {
			throw new Error(`scope.ui references unknown module "${moduleId}". Run "app init modules" to refresh the manifest.`);
		}
	}
}

export function normalizeResourceDefinition(
	definition: ResourceDefinition,
	context?: {
		readonly allDefinitions?: readonly ResourceDefinition[];
		readonly modules?: readonly GeneratorModule[];
	},
): ResourceIR {
	const modelName = definition.model.name;
	const singular = definition.name;
	const slug = toSlug(singular);
	const fields = Object.entries(definition.model.fields)
		.map(([name, fieldDef]) => buildFieldIR(name, fieldDef))
		.sort((left, right) => left.name.localeCompare(right.name));

	const defaultScalarFields = fields.filter((field) => field.type !== "relation").map((field) => field.name);
	const cascadeSoftDeleteChildren =
		context?.allDefinitions !== undefined ? buildCascadeSoftDeleteChildren(modelName, context.allDefinitions) : [];

	const scopeUi = definition.scope.ui;
	if (context?.modules !== undefined) {
		validateScopeModules(scopeUi, context.modules);
	}

	const uiTargets: Record<string, UiTargetIR> = {};
	for (const moduleId of scopeUi) {
		const moduleConfig = definition.ui?.[moduleId];
		if (moduleConfig === undefined) {
			throw new Error(`Missing ui.${moduleId} block for scope.ui entry.`);
		}
		uiTargets[moduleId] = buildUiTargetFromConfig(moduleId, moduleConfig, defaultScalarFields, fields);
	}

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
		scope: {
			api: definition.scope.api,
			shared: definition.scope.shared,
			client: definition.scope.client,
			ui: scopeUi,
		},
		fields,
		relations: buildRelations(fields),
		workflow: buildWorkflowIR(definition, modelName),
		softDelete: definition.model.softDelete === true,
		concurrency: definition.model.concurrency === true,
		idempotency: definition.model.idempotency === true,
		rls: definition.model.rls,
		cascadeSoftDeleteChildren,
		permissions: buildPermissions(definition),
		uiTargets,
		admin: undefined,
		activeUi: undefined,
		events: {
			created: definition.events?.created === true,
			updated: definition.events?.updated === true,
			deleted: definition.events?.deleted === true,
		},
		audit: definition.audit === true,
	};
}
