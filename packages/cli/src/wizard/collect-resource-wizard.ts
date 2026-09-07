import type { ResourceScalarType, RlsPolicy } from "../schema/resource-definition";
import { ResourceScalarTypeSchema, RlsPolicySchema } from "../schema/resource-definition";
import { discoverExistingModels } from "./discover-models";
import { SCALAR_FIELD_KIND_CHOICES, type FieldKind, fieldKindToScalarType } from "./field-kinds";
import type { WizardPrompter } from "./prompter";
import { printFieldSummary, printNote, printSection, printSuccess, printWarning, printWizardIntro } from "./terminal-ui";
import type { DiscoveredModel, WizardFieldInput, WizardResourceInput } from "./types";
import {
	fieldSupportsFilterable,
	fieldSupportsSearchable,
	fieldSupportsSortable,
	isValidFieldName,
	suggestForeignKeyFieldName,
	toNavigationLabel,
	toPascalCase,
} from "./validation";

const RLS_CHOICES = [
	{ value: "admin-only", label: "Admin only", hint: "SuperAdmin / staff panels" },
	{ value: "organization-scoped", label: "Organization scoped", hint: "tenant / merchant isolation" },
	{ value: "user-owned", label: "User owned", hint: "each user sees their own rows" },
	{ value: "public-read", label: "Public read", hint: "anyone can read, restricted writes" },
] as const;

const LIST_BEHAVIOR_CHOICES = [
	{ value: "search-sort", label: "Searchable and sortable", hint: "recommended for names" },
	{ value: "sort-only", label: "Sortable only" },
	{ value: "none", label: "Neither" },
] as const;

function resolveFieldKind(value: string): FieldKind {
	const allowed: FieldKind[] = ["short-text", "long-text", "number", "decimal", "boolean", "enum", "datetime", "foreign-key"];
	if (!allowed.includes(value as FieldKind)) {
		throw new Error(`Invalid field kind: ${value}`);
	}
	return value as FieldKind;
}

function resolveRlsPolicy(value: string): RlsPolicy {
	const parsed = RlsPolicySchema.safeParse(value);
	if (!parsed.success) {
		throw new Error(`Invalid RLS policy: ${value}`);
	}
	return parsed.data;
}

function resolveScalarType(value: string): ResourceScalarType {
	const parsed = ResourceScalarTypeSchema.safeParse(value);
	if (!parsed.success) {
		throw new Error(`Invalid field type: ${value}`);
	}
	return parsed.data;
}

async function collectForeignKeyField(
	prompter: WizardPrompter,
	existingFieldNames: ReadonlySet<string>,
	existingModels: readonly DiscoveredModel[],
): Promise<WizardFieldInput | null> {
	if (existingModels.length === 0) {
		printWarning("No parent tables found yet.");
		printNote("Create the parent resource first, then run this wizard again for the child.");
		printNote("Example: generate Category today, then Product with a link to Category tomorrow.");
		return null;
	}

	printNote("This adds a column on YOUR table that points to one row in the parent table.");
	printNote("Example: Product.categoryId → SampleCategory.id");

	const selectedModel = await prompter.select(
		"Which parent table does this belong to?",
		existingModels.map((model) => ({
			value: model.modelName,
			label: model.modelName,
			hint: `API slug: ${model.slug}`,
		})),
	);

	const defaultFieldName = suggestForeignKeyFieldName(selectedModel);
	const name = await prompter.text("Column name on this table", {
		defaultValue: defaultFieldName,
		hint: "Use camelCase, usually parentName + Id",
		validate: (value) => {
			if (!isValidFieldName(value)) {
				return "Use camelCase starting with a lowercase letter (e.g. categoryId).";
			}
			if (existingFieldNames.has(value)) {
				return `Column "${value}" already exists on this resource.`;
			}
			return undefined;
		},
	});

	const optionalLink = await prompter.confirm("Can rows exist without a parent?", {
		defaultValue: true,
		hint: "Yes = nullable foreign key (most common)",
	});

	return {
		name,
		type: "uuid",
		required: !optionalLink,
		nullable: optionalLink,
		searchable: false,
		sortable: false,
		filterable: false,
		relation: {
			model: selectedModel,
			field: name,
			cardinality: "one",
		},
	};
}

async function collectScalarField(prompter: WizardPrompter, existingFieldNames: ReadonlySet<string>, kind: FieldKind): Promise<WizardFieldInput> {
	const type = fieldKindToScalarType(kind);

	const name = await prompter.text("Column name", {
		hint: "camelCase, e.g. name, description, stock",
		validate: (value) => {
			if (!isValidFieldName(value)) {
				return "Use camelCase starting with a lowercase letter (e.g. name).";
			}
			if (existingFieldNames.has(value)) {
				return `Column "${value}" already exists on this resource.`;
			}
			return undefined;
		},
	});

	let enumValues: string[] | undefined;
	if (type === "enum") {
		const rawValues = await prompter.text("Pick-list values (comma-separated)", {
			hint: "e.g. draft, published, archived",
			validate: (value) => {
				const values = value
					.split(",")
					.map((item) => item.trim())
					.filter((item) => item.length > 0);
				if (values.length < 2) {
					return "Provide at least two values, separated by commas.";
				}
				return undefined;
			},
		});
		enumValues = rawValues
			.split(",")
			.map((item) => item.trim())
			.filter((item) => item.length > 0);
	}

	const required = await prompter.confirm("Required when creating a row?", {
		defaultValue: type !== "text",
	});
	const nullable = required
		? false
		: await prompter.confirm("Allow empty / null values?", {
				defaultValue: true,
			});

	let searchable = false;
	let sortable = false;
	if (fieldSupportsSearchable(type) || fieldSupportsSortable(type)) {
		const behavior = await prompter.select("List page behavior", LIST_BEHAVIOR_CHOICES, {
			hint: "Controls admin search and column sorting",
		});
		searchable = behavior === "search-sort" && fieldSupportsSearchable(type);
		sortable = (behavior === "search-sort" || behavior === "sort-only") && fieldSupportsSortable(type);
	}

	let filterable = false;
	if (fieldSupportsFilterable(type)) {
		filterable = await prompter.confirm("Show as a list filter in admin?", { defaultValue: true });
	}

	let defaultValue: string | number | boolean | undefined;
	if (type === "boolean") {
		const hasDefault = await prompter.confirm("Set a default value?", { defaultValue: false });
		if (hasDefault) {
			defaultValue = await prompter.confirm("Default to true?", { defaultValue: false });
		}
	} else if (type === "enum" && enumValues !== undefined && enumValues.length > 0) {
		const hasDefault = await prompter.confirm("Set a default pick-list value?", { defaultValue: true });
		if (hasDefault) {
			defaultValue = await prompter.select(
				"Default value",
				enumValues.map((value) => ({ value, label: value })),
			);
		}
	} else if (type === "int" || type === "decimal") {
		const hasDefault = await prompter.confirm("Set a default number?", { defaultValue: false });
		if (hasDefault) {
			const raw = await prompter.text("Default number", {
				validate: (value) => {
					const parsed = type === "int" ? Number.parseInt(value, 10) : Number.parseFloat(value);
					if (Number.isNaN(parsed)) {
						return "Enter a valid number.";
					}
					return undefined;
				},
			});
			defaultValue = type === "int" ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
		}
	} else if (type === "string") {
		const hasDefault = await prompter.confirm("Set a default string?", { defaultValue: false });
		if (hasDefault) {
			defaultValue = await prompter.text("Default string");
		}
	}

	return {
		name,
		type: resolveScalarType(type),
		required,
		nullable,
		searchable,
		sortable,
		filterable,
		defaultValue,
		enumValues,
	};
}

async function collectField(
	prompter: WizardPrompter,
	existingFieldNames: ReadonlySet<string>,
	existingModels: readonly DiscoveredModel[],
	fieldIndex: number,
	currentResourceName: string,
): Promise<WizardFieldInput | null> {
	printSection(`Column ${String(fieldIndex)}`, undefined);

	const linkableParents = existingModels.filter((model) => model.modelName !== currentResourceName);
	const parentSummary = linkableParents.length > 0 ? linkableParents.map((model) => model.modelName).join(", ") : "none yet — create the parent resource first";

	const columnEntryChoices: { value: string; label: string; hint?: string }[] = [
		{ value: "regular", label: "Regular column", hint: "text, number, boolean, pick list, date" },
	];
	if (linkableParents.length > 0) {
		columnEntryChoices.push({
			value: "foreign-key",
			label: "Link to another table",
			hint: `foreign key → ${parentSummary}`,
		});
	} else {
		printNote(`Table links: ${parentSummary}`);
	}

	const entry = await prompter.select("What would you like to add?", columnEntryChoices, {
		hint: linkableParents.length > 0 ? "Option 2 creates a column like categoryId pointing at another table" : undefined,
	});

	if (entry === "foreign-key") {
		return collectForeignKeyField(prompter, existingFieldNames, linkableParents);
	}

	const kind = resolveFieldKind(await prompter.select("Column type", SCALAR_FIELD_KIND_CHOICES));
	return collectScalarField(prompter, existingFieldNames, kind);
}

export async function collectResourceWizardInput(prompter: WizardPrompter, definitionsDir: string): Promise<WizardResourceInput> {
	printWizardIntro();

	printSection("Basics", { current: 1, total: 4 });
	const rawName = await prompter.text("Resource name", {
		hint: "PascalCase or kebab-case, e.g. Product or product-category",
		validate: (value) => {
			const modelName = toPascalCase(value);
			if (modelName.length === 0) {
				return "Enter a resource name.";
			}
			return undefined;
		},
	});
	const name = toPascalCase(rawName);
	const navigationLabel = await prompter.text("Admin menu label", {
		defaultValue: toNavigationLabel(name),
		hint: "Shown in the admin sidebar",
	});

	printSection("Access & lifecycle", { current: 2, total: 4 });
	const rls = resolveRlsPolicy(await prompter.select("Who can access this data?", RLS_CHOICES));
	const softDelete = await prompter.confirm("Enable soft delete?", {
		defaultValue: true,
		hint: "Rows get deletedAt instead of being removed",
	});

	let concurrency = false;
	let idempotency = false;
	const showAdvanced = await prompter.confirm("Configure advanced options?", { defaultValue: false });
	if (showAdvanced) {
		concurrency = await prompter.confirm("Optimistic concurrency (version column)?", { defaultValue: false });
		idempotency = await prompter.confirm("Idempotency hooks for writes?", { defaultValue: false });
	}

	const existingModels = await discoverExistingModels(definitionsDir);

	printSection("Columns", { current: 3, total: 4 });
	printNote("Each resource becomes one database table.");
	printNote("id, createdAt, and updatedAt are automatic — do not add them.");
	const linkableParents = existingModels.filter((model) => model.modelName !== name);
	if (linkableParents.length > 0) {
		printNote('To link tables: choose "Link to another table" when adding a column (option 2).');
		printNote(`Available parent tables: ${linkableParents.map((model) => model.modelName).join(", ")}`);
	} else {
		printNote("To link tables later: create the parent resource first, then re-run this wizard for the child.");
	}

	const fields: WizardFieldInput[] = [];
	const fieldNames = new Set<string>();
	let fieldIndex = 1;
	let addAnother = true;

	while (addAnother) {
		const field = await collectField(prompter, fieldNames, existingModels, fieldIndex, name);
		if (field === null) {
			const retry = await prompter.confirm("Try a different field type instead?", { defaultValue: true });
			if (!retry) {
				break;
			}
			continue;
		}

		fields.push(field);
		fieldNames.add(field.name);
		const typeLabel = field.relation !== undefined ? `link → ${field.relation.model}` : field.type;
		printSuccess(`Added ${field.name} (${typeLabel})`);
		fieldIndex += 1;
		addAnother = await prompter.confirm("Add another column?", { defaultValue: fields.length < 1 });
	}

	if (fields.length === 0) {
		throw new Error("At least one column is required.");
	}

	printSection("Review", { current: 4, total: 4 });
	process.stdout.write(`${pcResourceSummary(name, navigationLabel, rls, softDelete, fields)}\n`);
	printFieldSummary(
		fields.map((field) => ({
			name: field.name,
			type: field.relation !== undefined ? `link to ${field.relation.model}` : field.type,
			relation: field.relation?.model,
		})),
	);

	return {
		name,
		rls,
		softDelete,
		concurrency,
		idempotency,
		fields,
		navigationLabel,
	};
}

function pcResourceSummary(name: string, navigationLabel: string, rls: RlsPolicy, softDelete: boolean, fields: readonly WizardFieldInput[]): string {
	const lines = [`Resource: ${name}`, `Admin label: ${navigationLabel}`, `Access: ${rls}`, `Soft delete: ${softDelete ? "yes" : "no"}`, `Columns: ${String(fields.length)}`];
	return lines.join("\n");
}
