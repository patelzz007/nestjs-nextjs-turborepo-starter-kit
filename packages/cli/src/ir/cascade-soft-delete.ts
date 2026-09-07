import type { ResourceDefinition } from "../schema/resource-definition";
import type { CascadeSoftDeleteChildIR } from "./types";

function toSlug(value: string): string {
	return value
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/[\s_]+/g, "-")
		.toLowerCase();
}

function toDelegateName(modelName: string): string {
	return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

/** Finds child resources that declare `relation.cascadeSoftDelete` pointing at `parentModelName`. */
export function buildCascadeSoftDeleteChildren(parentModelName: string, allDefinitions: readonly ResourceDefinition[]): CascadeSoftDeleteChildIR[] {
	const children: CascadeSoftDeleteChildIR[] = [];

	for (const definition of allDefinitions) {
		if (definition.model.softDelete !== true) {
			continue;
		}
		for (const [fieldName, field] of Object.entries(definition.model.fields)) {
			if (field.relation?.model === parentModelName && field.relation.cascadeSoftDelete === true) {
				children.push({
					childModelName: definition.model.name,
					childDelegate: toDelegateName(definition.model.name),
					childSlug: toSlug(definition.name),
					foreignKey: fieldName,
				});
			}
		}
	}

	return children.sort((left, right) => left.childModelName.localeCompare(right.childModelName));
}
