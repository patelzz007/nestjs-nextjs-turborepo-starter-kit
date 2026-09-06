const FIELD_NAME_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

export function isValidFieldName(value: string): boolean {
	return FIELD_NAME_PATTERN.test(value);
}

export function toPascalCase(value: string): string {
	const normalized = value
		.trim()
		.replace(/[_\s]+/g, "-")
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.toLowerCase();
	const parts = normalized.split("-").filter((part) => part.length > 0);
	if (parts.length === 0) {
		return "";
	}
	return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
}

export function toNavigationLabel(modelName: string): string {
	const spaced = modelName
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/^Sample\s+/i, "")
		.trim();
	return spaced.length > 0 ? spaced : modelName;
}

export function suggestForeignKeyFieldName(modelName: string): string {
	const withoutPrefix = modelName.replace(/^Sample/, "");
	const base = withoutPrefix.charAt(0).toLowerCase() + withoutPrefix.slice(1);
	return `${base}Id`;
}

export function fieldSupportsSortable(type: string): boolean {
	return type === "string" || type === "text" || type === "int" || type === "decimal" || type === "datetime";
}

export function fieldSupportsSearchable(type: string): boolean {
	return type === "string" || type === "text";
}

export function fieldSupportsFilterable(type: string): boolean {
	return type === "boolean" || type === "enum";
}
