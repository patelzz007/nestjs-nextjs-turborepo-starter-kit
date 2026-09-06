import type { ResourceScalarType } from "../schema/resource-definition.js";
import type { PromptChoice } from "./prompter.js";

export type FieldKind = "short-text" | "long-text" | "number" | "decimal" | "boolean" | "enum" | "datetime" | "foreign-key";

export const SCALAR_FIELD_KIND_CHOICES: readonly PromptChoice<string>[] = [
	{ value: "short-text", label: "Short text", hint: "name, title, slug" },
	{ value: "long-text", label: "Long text", hint: "description, notes" },
	{ value: "number", label: "Whole number", hint: "quantity, stock" },
	{ value: "decimal", label: "Decimal number", hint: "price, rating" },
	{ value: "boolean", label: "Yes / No", hint: "isActive, featured" },
	{ value: "enum", label: "Pick list", hint: "status: draft, published" },
	{ value: "datetime", label: "Date / time", hint: "stored as epoch ms" },
];

/** @deprecated Use SCALAR_FIELD_KIND_CHOICES + top-level link menu in the wizard. */
export const FIELD_KIND_CHOICES: readonly PromptChoice<string>[] = [
	...SCALAR_FIELD_KIND_CHOICES,
	{ value: "foreign-key", label: "Link to another table", hint: "belongs to Category, User, etc." },
];

export function fieldKindToScalarType(kind: FieldKind): ResourceScalarType {
	switch (kind) {
		case "short-text":
			return "string";
		case "long-text":
			return "text";
		case "number":
			return "int";
		case "decimal":
			return "decimal";
		case "boolean":
			return "boolean";
		case "enum":
			return "enum";
		case "datetime":
			return "datetime";
		case "foreign-key":
			return "uuid";
	}
}

export function fieldKindLabel(kind: FieldKind): string {
	const match = SCALAR_FIELD_KIND_CHOICES.find((choice) => choice.value === kind);
	if (match !== undefined) {
		return match.label;
	}
	if (kind === "foreign-key") {
		return "Link to another table";
	}
	return kind;
}
