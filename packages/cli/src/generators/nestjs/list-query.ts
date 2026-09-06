import type { FieldIR, ResourceIR } from "../../ir/types.js";

const DEFAULT_SORT_FIELDS: readonly string[] = ["createdAt"];

export function resolveSortableFieldNames(ir: ResourceIR): string[] {
	const configured = ir.admin?.list.sortable ?? ir.fields.filter((field) => field.sortable).map((field) => field.name);
	const merged = new Set<string>([...configured, ...DEFAULT_SORT_FIELDS]);
	return [...merged];
}

export function resolveSearchableFieldNames(ir: ResourceIR): string[] {
	const configured = ir.admin?.list.searchable ?? ir.fields.filter((field) => field.searchable).map((field) => field.name);
	return [...configured];
}

export function fieldByName(ir: ResourceIR, fieldName: string): FieldIR | undefined {
	return ir.fields.find((field) => field.name === fieldName);
}

export function toSortableCamelNames(ir: ResourceIR): string[] {
	return resolveSortableFieldNames(ir).map((fieldName) => {
		const field = fieldByName(ir, fieldName);
		if (field === undefined) {
			return fieldName;
		}
		return field.camelName;
	});
}

export function isTextSearchableField(field: FieldIR): boolean {
	return field.type === "string" || field.type === "text";
}
