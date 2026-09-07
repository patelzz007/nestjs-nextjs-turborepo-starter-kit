export { defineResource, ResourceDefinitionSchema, RlsPolicySchema, type RlsPolicy } from "./schema/resource-definition";
export { normalizeResourceDefinition } from "./ir/normalize";
export { parseResourceDefinitionFile } from "./parser/parse-resource-definition";
export type { ResourceIR, GenerationPlan } from "./ir/types";
export { WizardFieldInputSchema, WizardResourceInputSchema, type WizardFieldInput, type WizardResourceInput } from "./schema/wizard-input";
export { applyResourceGenerator, listResourceDefinitions, listResourceGeneratorModels, parseWizardResourceInput, previewResourceGenerator } from "./generator/programmatic";
export type {
	ResourceGeneratorActionCounts,
	ResourceGeneratorApplyResult,
	ResourceGeneratorListItem,
	ResourceGeneratorPreview,
	ResourceGeneratorSummary,
	ResourceGeneratorValidationStep,
} from "./generator/types";
export { buildResourceDefinition } from "./wizard/build-definition";
export { renderResourceDefinitionSource } from "./wizard/render-definition-source";
export { discoverExistingModels } from "./wizard/discover-models";
export { fieldKindToScalarType, fieldKindLabel, SCALAR_FIELD_KIND_CHOICES, type FieldKind } from "./wizard/field-kinds";
export {
	fieldSupportsFilterable,
	fieldSupportsSearchable,
	fieldSupportsSortable,
	isValidFieldName,
	suggestForeignKeyFieldName,
	toNavigationLabel,
	toPascalCase,
} from "./wizard/validation";
export type { PlanAction } from "./core/planner";
export type { DiscoveredModel } from "./wizard/types";
export type { RollbackPlan, RollbackPlanStep, RollbackAction, RollbackApplyResult } from "./generator/types";
