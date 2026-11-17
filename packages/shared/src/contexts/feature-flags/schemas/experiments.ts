import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { DynamicConfigKeySchema } from "./dynamic-configs";
import { RolloutUnitSchema } from "./registry";
import { ChangeReasonSchema, ConfigValueNameSchema, PercentageSchema } from "./rules";

// ── Experiments (GLOSSARY: experiment, variant, experiment metric) ───────────────────────────────
// An experiment splits the subjects of one dynamic config between variants (each a named value of that
// config) and compares declared metrics between them. Assignment uses the same stable hash as flags,
// salted per experiment, so a subject keeps its variant for the whole experiment.

export const ExperimentMetricKeySchema = z.enum(["reward-claims", "reward-redemptions", "sign-ins"]);
export type ExperimentMetricKey = z.output<typeof ExperimentMetricKeySchema>;

/** The platform events a metric can count. */
export const ExperimentMetricEventTypeSchema = z.enum(["reward.platform", "auth.flow"]);
export type ExperimentMetricEventType = z.output<typeof ExperimentMetricEventTypeSchema>;

export interface ExperimentMetricDefinition {
	readonly title: string;
	readonly description: string;
	/** The platform event type counted. */
	readonly eventType: ExperimentMetricEventType;
	/** The `event` (reward.platform) or `flow` (auth.flow, successful only) value counted. */
	readonly eventName: string;
	readonly higherIsBetter: boolean;
}

/** The metrics an experiment can compare: counts per subject of events the platform already sends. */
export const EXPERIMENT_METRIC_REGISTRY: Readonly<Record<ExperimentMetricKey, ExperimentMetricDefinition>> = {
	"reward-claims": {
		title: "Reward claims",
		description: "Rewards claimed per person while in the experiment.",
		eventType: "reward.platform",
		eventName: "user.claim_reward",
		higherIsBetter: true,
	},
	"reward-redemptions": {
		title: "Reward redemptions",
		description: "Rewards redeemed per person while in the experiment.",
		eventType: "reward.platform",
		eventName: "user.redeem_reward",
		higherIsBetter: true,
	},
	"sign-ins": {
		title: "Sign-ins",
		description: "Successful sign-ins per person while in the experiment.",
		eventType: "auth.flow",
		eventName: "login",
		higherIsBetter: true,
	},
};

/** Most variants one experiment splits between. */
export const EXPERIMENT_MAX_VARIANTS = 5;
const EXPERIMENT_MIN_VARIANTS = 2;
const GUARDRAILS_MAX = 3;
const NAME_MAX_LENGTH = 80;
const HYPOTHESIS_MAX_LENGTH = 1000;
const CONCLUSION_MAX_LENGTH = 2000;
const FULL_SHARE = 100;
const EXPERIMENT_KEY_MAX_LENGTH = 64;
const EXPERIMENT_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const ExperimentStatusSchema = z.enum(["DRAFT", "RUNNING", "STOPPED"]);
export type ExperimentStatus = z.output<typeof ExperimentStatusSchema>;

/** Open: variants come back inside experiment responses (ADR 022). */
export const ExperimentVariantSchema = z.object({ valueName: ConfigValueNameSchema, allocation: PercentageSchema });
export type ExperimentVariant = z.output<typeof ExperimentVariantSchema>;

const ExperimentPlanShape = {
	name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
	hypothesis: z.string().trim().min(1).max(HYPOTHESIS_MAX_LENGTH),
	/** The share of the config's subjects that take part; the rest get the config's rules as usual. */
	trafficPercentage: PercentageSchema.min(1),
	variants: z.array(ExperimentVariantSchema).min(EXPERIMENT_MIN_VARIANTS).max(EXPERIMENT_MAX_VARIANTS),
	/** The variant the others are compared with. */
	controlValueName: ConfigValueNameSchema,
	primaryMetric: ExperimentMetricKeySchema,
	guardrailMetrics: z.array(ExperimentMetricKeySchema).max(GUARDRAILS_MAX),
	plannedEndAt: EpochMsSchema.nullable(),
};

function isValidPlan(plan: {
	readonly variants: readonly ExperimentVariant[];
	readonly controlValueName: string;
	readonly primaryMetric: ExperimentMetricKey;
	readonly guardrailMetrics: readonly ExperimentMetricKey[];
}): boolean {
	const allocated = plan.variants.reduce((total, variant) => total + variant.allocation, 0);
	const names = new Set(plan.variants.map((variant) => variant.valueName));
	return allocated === FULL_SHARE && names.size === plan.variants.length && names.has(plan.controlValueName) && !plan.guardrailMetrics.includes(plan.primaryMetric);
}

const PLAN_MESSAGE = "Variants must be different values sharing 100%, the control must be one of them, and the primary metric can't also be a guardrail";

export const ExperimentKeySchema = z.string().min(1).max(EXPERIMENT_KEY_MAX_LENGTH).regex(EXPERIMENT_KEY_PATTERN, "lowercase words joined by hyphens");

export const CreateExperimentSchema = z
	.object({ key: ExperimentKeySchema, configKey: DynamicConfigKeySchema, ...ExperimentPlanShape, reason: ChangeReasonSchema })
	.strict()
	.refine(isValidPlan, { message: PLAN_MESSAGE, path: ["variants"] });
export type CreateExperimentInput = z.output<typeof CreateExperimentSchema>;

/** A draft's plan can change; a running or stopped experiment's can't. */
export const UpdateExperimentSchema = z
	.object({ ...ExperimentPlanShape, reason: ChangeReasonSchema })
	.strict()
	.refine(isValidPlan, { message: PLAN_MESSAGE, path: ["variants"] });
export type UpdateExperimentInput = z.output<typeof UpdateExperimentSchema>;

export const ExperimentPathSchema = z.object({ experimentId: z.uuid() }).strict();
export type ExperimentPath = z.output<typeof ExperimentPathSchema>;
export const UpdateExperimentInputSchema = ExperimentPathSchema.extend(UpdateExperimentSchema.shape);

export const StartExperimentSchema = z.object({ reason: ChangeReasonSchema }).strict();
export type StartExperimentInput = z.output<typeof StartExperimentSchema>;
export const StartExperimentInputSchema = ExperimentPathSchema.extend(StartExperimentSchema.shape);

export const StopExperimentSchema = z.object({ reason: ChangeReasonSchema, conclusion: z.string().trim().min(1).max(CONCLUSION_MAX_LENGTH) }).strict();
export type StopExperimentInput = z.output<typeof StopExperimentSchema>;
export const StopExperimentInputSchema = ExperimentPathSchema.extend(StopExperimentSchema.shape);

export const ExperimentSchema = z.object({
	id: z.uuid(),
	key: ExperimentKeySchema,
	configKey: DynamicConfigKeySchema,
	rolloutUnit: RolloutUnitSchema,
	status: ExperimentStatusSchema,
	...ExperimentPlanShape,
	startedAt: EpochMsSchema.nullable(),
	stoppedAt: EpochMsSchema.nullable(),
	conclusion: z.string().nullable(),
	createdByName: z.string().nullable(),
	updatedAt: EpochMsSchema,
});
export type Experiment = z.output<typeof ExperimentSchema>;

export const ExperimentListSchema = z.object({ experiments: z.array(ExperimentSchema) });
export type ExperimentList = z.output<typeof ExperimentListSchema>;

/** One variant's figures for one metric, compared with the control (the control's own row has no comparison). */
export const ExperimentMetricResultSchema = z.object({
	metric: ExperimentMetricKeySchema,
	valueName: ConfigValueNameSchema,
	subjects: z.number().int().nonnegative(),
	mean: z.number(),
	/** Difference from the control's mean, and its 95% confidence interval (null for the control or too few subjects). */
	delta: z.number().nullable(),
	ciLow: z.number().nullable(),
	ciHigh: z.number().nullable(),
	/** The interval excludes zero. */
	significant: z.boolean(),
});
export type ExperimentMetricResult = z.output<typeof ExperimentMetricResultSchema>;

export const ExperimentResultsSchema = z.object({
	experimentId: z.uuid(),
	computedAt: EpochMsSchema.nullable(),
	results: z.array(ExperimentMetricResultSchema),
});
export type ExperimentResults = z.output<typeof ExperimentResultsSchema>;

export const ExperimentDetailSchema = ExperimentSchema.extend({ results: ExperimentResultsSchema });
export type ExperimentDetail = z.output<typeof ExperimentDetailSchema>;

export const ExperimentMetricOptionSchema = z.object({ key: ExperimentMetricKeySchema, title: z.string(), description: z.string(), higherIsBetter: z.boolean() });
export const ExperimentMetricOptionListSchema = z.object({ metrics: z.array(ExperimentMetricOptionSchema) });
export type ExperimentMetricOptionList = z.output<typeof ExperimentMetricOptionListSchema>;
