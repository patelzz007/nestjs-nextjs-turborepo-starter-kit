import {
	fieldKindToScalarType,
	fieldSupportsFilterable,
	fieldSupportsSearchable,
	fieldSupportsSortable,
	isValidFieldName,
	suggestForeignKeyFieldName,
	toNavigationLabel,
	toPascalCase,
	type FieldKind,
	type RlsPolicy,
	type WizardFieldInput,
	type WizardResourceInput,
} from "@workspace/cli/generator";
import { z } from "zod";

export type ListBehavior = "search-sort" | "sort-only" | "none";

export interface GeneratorFieldDraft {
	readonly id: string;
	readonly entryType: "scalar" | "foreign-key";
	readonly kind: FieldKind;
	readonly name: string;
	readonly required: boolean;
	readonly nullable: boolean;
	readonly listBehavior: ListBehavior;
	readonly filterable: boolean;
	readonly enumValues: readonly string[];
	readonly hasDefault: boolean;
	readonly defaultValue: string | number | boolean | null;
	readonly relationModel: string | null;
	readonly relationOptional: boolean;
}

export interface GeneratorWizardDraft {
	readonly name: string;
	readonly navigationLabel: string;
	readonly navigationLabelTouched: boolean;
	readonly generateUi: boolean;
	readonly uiModules: readonly string[];
	readonly rls: RlsPolicy;
	readonly softDelete: boolean;
	readonly concurrency: boolean;
	readonly idempotency: boolean;
	readonly showAdvanced: boolean;
	readonly fields: readonly GeneratorFieldDraft[];
}

export function createEmptyWizardDraft(): GeneratorWizardDraft {
	return {
		name: "",
		navigationLabel: "",
		navigationLabelTouched: false,
		generateUi: true,
		uiModules: ["admin"],
		rls: "admin-only",
		softDelete: true,
		concurrency: false,
		idempotency: false,
		showAdvanced: false,
		fields: [],
	};
}

export function createFieldDraftId(): string {
	return `field-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultScalarFieldDraft(kind: FieldKind = "short-text"): GeneratorFieldDraft {
	const type = fieldKindToScalarType(kind);
	return {
		id: createFieldDraftId(),
		entryType: "scalar",
		kind,
		name: "",
		required: type !== "text",
		nullable: type === "text",
		listBehavior: fieldSupportsSearchable(type) ? "search-sort" : fieldSupportsSortable(type) ? "sort-only" : "none",
		filterable: fieldSupportsFilterable(type),
		enumValues: [],
		hasDefault: false,
		defaultValue: null,
		relationModel: null,
		relationOptional: true,
	};
}

export function createDefaultForeignKeyDraft(modelName: string): GeneratorFieldDraft {
	return {
		id: createFieldDraftId(),
		entryType: "foreign-key",
		kind: "foreign-key",
		name: suggestForeignKeyFieldName(modelName),
		required: false,
		nullable: true,
		listBehavior: "none",
		filterable: false,
		enumValues: [],
		hasDefault: false,
		defaultValue: null,
		relationModel: modelName,
		relationOptional: true,
	};
}

export function resolveModelName(rawName: string): string {
	return toPascalCase(rawName);
}

export function suggestNavigationLabel(rawName: string): string {
	const modelName = resolveModelName(rawName);
	return toNavigationLabel(modelName);
}

function fieldDraftToWizardField(draft: GeneratorFieldDraft): WizardFieldInput {
	if (draft.entryType === "foreign-key") {
		if (draft.relationModel === null || draft.relationModel.length === 0) {
			throw new Error("Foreign key fields require a parent model.");
		}
		return {
			name: draft.name,
			type: "uuid",
			required: !draft.relationOptional,
			nullable: draft.relationOptional,
			searchable: false,
			sortable: false,
			filterable: false,
			relation: {
				model: draft.relationModel,
				field: draft.name,
				cardinality: "one",
			},
		};
	}

	const type = fieldKindToScalarType(draft.kind);
	const searchable = draft.listBehavior === "search-sort" && fieldSupportsSearchable(type);
	const sortable = (draft.listBehavior === "search-sort" || draft.listBehavior === "sort-only") && fieldSupportsSortable(type);
	const filterable = draft.filterable && fieldSupportsFilterable(type);

	const field: WizardFieldInput = {
		name: draft.name,
		type,
		required: draft.required,
		nullable: draft.nullable,
		searchable,
		sortable,
		filterable,
	};

	if (type === "enum" && draft.enumValues.length > 0) {
		return {
			...field,
			enumValues: [...draft.enumValues],
			defaultValue: draft.hasDefault && draft.defaultValue !== null ? draft.defaultValue : undefined,
		};
	}

	if (draft.hasDefault && draft.defaultValue !== null) {
		return {
			...field,
			defaultValue: draft.defaultValue,
		};
	}

	return field;
}

export function wizardDraftToInput(draft: GeneratorWizardDraft): WizardResourceInput {
	const modelName = resolveModelName(draft.name);
	if (modelName.length === 0) {
		throw new Error("Resource name is required.");
	}
	if (draft.fields.length === 0) {
		throw new Error("Add at least one column.");
	}

	return {
		name: modelName,
		navigationLabel: draft.navigationLabel.trim().length > 0 ? draft.navigationLabel.trim() : suggestNavigationLabel(draft.name),
		rls: draft.rls,
		softDelete: draft.softDelete,
		concurrency: draft.concurrency,
		idempotency: draft.idempotency,
		generateUi: draft.generateUi,
		uiModules: draft.generateUi ? [...draft.uiModules] : [],
		fields: draft.fields.map((field) => fieldDraftToWizardField(field)),
	};
}

export interface WizardStepId {
	readonly id: "basics" | "scope" | "access" | "fields" | "preview" | "generate";
	readonly label: string;
	readonly description: string;
}

export const GENERATOR_WIZARD_STEPS: readonly WizardStepId[] = [
	{ id: "basics", label: "Basics", description: "Name and navigation label" },
	{ id: "scope", label: "Scope", description: "API-only or multi-panel UI" },
	{ id: "access", label: "Access", description: "RLS and lifecycle options" },
	{ id: "fields", label: "Columns", description: "Database fields and relations" },
	{ id: "preview", label: "Preview", description: "Review the definition file" },
	{ id: "generate", label: "Generate", description: "Dry-run plan and apply" },
];

export const WIZARD_DRAFT_VERSION = 1;

const WIZARD_DRAFT_STORAGE_KEY = "generator-wizard-draft";

export interface PersistedWizardDraft {
	readonly version: number;
	readonly draft: GeneratorWizardDraft;
	readonly currentStepId: WizardStepId["id"];
	readonly savedAt: string;
}

const WizardStepIdSchema = z.enum(["basics", "scope", "access", "fields", "preview", "generate"]);

const PersistedWizardDraftSchema = z
	.object({
		version: z.literal(WIZARD_DRAFT_VERSION),
		currentStepId: WizardStepIdSchema,
		savedAt: z.string(),
		draft: z.custom<GeneratorWizardDraft>((value) => typeof value === "object" && value !== null),
	})
	.strict();

export function validateBasicsStep(draft: GeneratorWizardDraft): string | null {
	const modelName = resolveModelName(draft.name);
	if (modelName.length === 0) {
		return "Enter a resource name.";
	}
	if (draft.navigationLabel.trim().length === 0) {
		return "Enter a sidebar menu label.";
	}
	return null;
}

export function validateScopeStep(draft: GeneratorWizardDraft): string | null {
	if (draft.generateUi && draft.uiModules.length === 0) {
		return "Select at least one UI panel.";
	}
	return null;
}

export function validateFieldsStep(draft: GeneratorWizardDraft): string | null {
	if (draft.fields.length === 0) {
		return "Add at least one column.";
	}
	for (const field of draft.fields) {
		if (!isValidFieldName(field.name)) {
			return `Column "${field.name}" is invalid. Use camelCase starting with a lowercase letter.`;
		}
	}
	const names = new Set<string>();
	for (const field of draft.fields) {
		if (names.has(field.name)) {
			return `Duplicate column name "${field.name}".`;
		}
		names.add(field.name);
	}
	return null;
}

function isBrowserEnvironment(): boolean {
	return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadWizardDraftFromStorage(): PersistedWizardDraft | null {
	if (!isBrowserEnvironment()) {
		return null;
	}
	try {
		const raw = window.localStorage.getItem(WIZARD_DRAFT_STORAGE_KEY);
		if (raw === null || raw.length === 0) {
			return null;
		}
		const parsed = PersistedWizardDraftSchema.safeParse(JSON.parse(raw));
		if (!parsed.success) {
			window.localStorage.removeItem(WIZARD_DRAFT_STORAGE_KEY);
			return null;
		}
		return parsed.data;
	} catch {
		window.localStorage.removeItem(WIZARD_DRAFT_STORAGE_KEY);
		return null;
	}
}

export function saveWizardDraftToStorage(draft: GeneratorWizardDraft, currentStepId: WizardStepId["id"]): void {
	if (!isBrowserEnvironment()) {
		return;
	}
	const payload: PersistedWizardDraft = {
		version: WIZARD_DRAFT_VERSION,
		draft,
		currentStepId,
		savedAt: new Date().toISOString(),
	};
	window.localStorage.setItem(WIZARD_DRAFT_STORAGE_KEY, JSON.stringify(payload));
}

export function clearWizardDraftFromStorage(): void {
	if (!isBrowserEnvironment()) {
		return;
	}
	window.localStorage.removeItem(WIZARD_DRAFT_STORAGE_KEY);
}
