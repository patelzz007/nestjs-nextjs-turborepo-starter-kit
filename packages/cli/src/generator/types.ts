import type { PlanAction } from "../core/planner";
import type { RollbackPlan } from "../rollback/rollback-schema";

export type { PlanAction };

export interface ResourceGeneratorActionCounts {
	readonly create: number;
	readonly modify: number;
	readonly skip: number;
	readonly conflict: number;
}

export interface ResourceGeneratorSummary {
	readonly name: string;
	readonly slug: string;
	readonly modelName: string;
	readonly navigationLabel: string;
	readonly rls: string;
	readonly fieldCount: number;
	readonly relationCount: number;
	readonly softDelete: boolean;
}

export interface ResourceGeneratorPreview {
	readonly summary: ResourceGeneratorSummary;
	readonly definitionSource: string;
	readonly definitionPath: string;
	readonly definitionExists: boolean;
	readonly actions: readonly PlanAction[];
	readonly actionCounts: ResourceGeneratorActionCounts;
}

export interface ResourceGeneratorValidationStep {
	readonly label: string;
	readonly success: boolean;
	readonly output: string;
}

export interface ResourceGeneratorApplyResult {
	readonly success: boolean;
	readonly slug: string;
	readonly definitionPath: string;
	readonly writtenFiles: readonly string[];
	readonly skippedFiles: readonly string[];
	readonly validationSteps: readonly ResourceGeneratorValidationStep[];
	readonly error: string | null;
}

export interface ResourceGeneratorListItem {
	readonly slug: string;
	readonly contractKey: string;
	readonly label: string;
	readonly fieldCount: number;
}

export interface GenerationPlanFileDiff {
	readonly path: string;
	readonly before: string;
	readonly after: string;
}

export interface GeneratorUiModuleListItem {
	readonly id: string;
	readonly resourceRouteTemplate: string;
}

export interface GeneratorDoctorCheck {
	readonly label: string;
	readonly ok: boolean;
	readonly detail: string;
}

export interface GeneratorDoctorResult {
	readonly success: boolean;
	readonly checks: readonly GeneratorDoctorCheck[];
}

export interface InitGeneratorModulesResult {
	readonly success: boolean;
	readonly modules: readonly GeneratorUiModuleListItem[];
	readonly manifestPath: string;
	readonly error: string | null;
}

export type { RollbackAction, RollbackPlan, RollbackPlanStep } from "../rollback/rollback-schema";

export interface RollbackApplyResult {
	readonly plan: RollbackPlan;
	readonly applied: boolean;
}
