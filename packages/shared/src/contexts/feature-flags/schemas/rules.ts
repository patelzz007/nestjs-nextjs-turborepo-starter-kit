import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { JsonObjectSchema } from "../../../schemas/runtime/json";
import { ConditionSchema } from "./conditions";

// ── Rules and flag revisions (GLOSSARY: rule, scheduled rollout, flag revision; ADR 086) ──────────

/** Most conditions one rule holds (they all must match). */
export const RULE_MAX_CONDITIONS = 10;
/** Most rules one flag or dynamic config holds. */
export const RULES_MAX = 50;
/** Most steps one scheduled rollout holds. */
export const SCHEDULE_MAX_STEPS = 10;
const SCHEDULE_MIN_STEPS = 2;
const RULE_NAME_MAX_LENGTH = 80;
export const PERCENTAGE_MIN = 0;
export const PERCENTAGE_MAX = 100;
const REASON_MIN_LENGTH = 10;
const REASON_MAX_LENGTH = 500;

/** Why a change was made: every change to a flag, override, group, config or experiment carries one. */
export const ChangeReasonSchema = z.string().trim().min(REASON_MIN_LENGTH).max(REASON_MAX_LENGTH);

export const PercentageSchema = z.number().int().min(PERCENTAGE_MIN).max(PERCENTAGE_MAX);

// Open objects, like the conditions (conditions.ts): they come back inside responses.
export const RolloutStepSchema = z.object({ at: EpochMsSchema, percentage: PercentageSchema });
export type RolloutStep = z.output<typeof RolloutStepSchema>;

/**
 * A rule's share of matching subjects. FIXED: one percentage. SCHEDULED: steps at set times; before the
 * first step the share is 0, then each step's share holds until the next (worked out from the clock).
 */
export const RolloutSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("FIXED"), percentage: PercentageSchema }),
	z
		.object({ kind: z.literal("SCHEDULED"), steps: z.array(RolloutStepSchema).min(SCHEDULE_MIN_STEPS).max(SCHEDULE_MAX_STEPS) })
		.refine((rollout) => rollout.steps.every((step, index, steps) => index === 0 || (steps.at(index - 1)?.at ?? step.at) < step.at), {
			message: "Each step must come after the one before it",
			path: ["steps"],
		}),
]);
export type Rollout = z.output<typeof RolloutSchema>;
/** A rollout as a form holds it before parsing. */
export type RolloutInput = z.input<typeof RolloutSchema>;

const RuleBaseShape = {
	/** Stable across revisions, so an exposure names the rule that decided it. */
	id: z.uuid(),
	name: z.string().trim().min(1).max(RULE_NAME_MAX_LENGTH),
	conditions: z.array(ConditionSchema).max(RULE_MAX_CONDITIONS),
	rollout: RolloutSchema,
};

export const FlagRuleSchema = z.object(RuleBaseShape);
export type FlagRule = z.output<typeof FlagRuleSchema>;
/** A flag rule as a form holds it before parsing (its times are plain numbers until checked). */
export type FlagRuleInput = z.input<typeof FlagRuleSchema>;

function hasUniqueIds(rules: readonly { readonly id: string }[]): boolean {
	return new Set(rules.map((rule) => rule.id)).size === rules.length;
}

export const FlagRulesSchema = z.array(FlagRuleSchema).max(RULES_MAX).refine(hasUniqueIds, { message: "Every rule needs its own id" });

/** A feature flag revision's content: its ordered rules (the first one a subject matches decides). */
export const FlagRevisionContentSchema = z.object({ kind: z.literal("FLAG"), rules: FlagRulesSchema });
export type FlagRevisionContent = z.output<typeof FlagRevisionContentSchema>;

const VALUE_NAME_MAX_LENGTH = 40;
const VALUE_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONFIG_VALUES_MAX = 20;

/** A dynamic config value's name, which rules and experiment variants refer to: `compact`, `bold-cta`. */
export const ConfigValueNameSchema = z.string().min(1).max(VALUE_NAME_MAX_LENGTH).regex(VALUE_NAME_PATTERN, "lowercase words joined by hyphens");
export type ConfigValueName = z.output<typeof ConfigValueNameSchema>;

export const ConfigNamedValueSchema = z.object({ name: ConfigValueNameSchema, value: JsonObjectSchema });
export type ConfigNamedValue = z.output<typeof ConfigNamedValueSchema>;

/** A dynamic config rule picks one of the revision's named values for the subjects it lets in. */
export const ConfigRuleSchema = z.object({ ...RuleBaseShape, valueName: ConfigValueNameSchema });
export type ConfigRule = z.output<typeof ConfigRuleSchema>;
/** A config rule as a form holds it before parsing (its times are plain numbers until checked). */
export type ConfigRuleInput = z.input<typeof ConfigRuleSchema>;

/**
 * A dynamic config revision's content: its named values (each checked against the config's declared schema
 * by the API) and its ordered rules, each naming one of those values.
 */
export const ConfigRevisionContentSchema = z
	.object({
		kind: z.literal("CONFIG"),
		values: z.array(ConfigNamedValueSchema).min(1).max(CONFIG_VALUES_MAX),
		rules: z.array(ConfigRuleSchema).max(RULES_MAX).refine(hasUniqueIds, { message: "Every rule needs its own id" }),
	})
	.refine((content) => new Set(content.values.map((value) => value.name)).size === content.values.length, { message: "Every value needs its own name", path: ["values"] })
	.refine((content) => content.rules.every((rule) => content.values.some((value) => value.name === rule.valueName)), {
		message: "A rule names a value this config doesn't have",
		path: ["rules"],
	});
export type ConfigRevisionContent = z.output<typeof ConfigRevisionContentSchema>;

export const RevisionContentSchema = z.union([FlagRevisionContentSchema, ConfigRevisionContentSchema]);
export type RevisionContent = z.output<typeof RevisionContentSchema>;

/**
 * Where a revision stands. LIVE: the one in force. PENDING: waiting for a second person (production only).
 * SUPERSEDED: an earlier live one. REJECTED / EXPIRED: a pending one that never went live.
 */
export const RevisionStatusSchema = z.enum(["LIVE", "PENDING", "SUPERSEDED", "REJECTED", "EXPIRED"]);
export type RevisionStatus = z.output<typeof RevisionStatusSchema>;

/** Where a revision came from: typed in this console, or carried from another environment. */
export const RevisionSourceSchema = z.enum(["CONSOLE", "PROMOTION", "SEED"]);
export type RevisionSource = z.output<typeof RevisionSourceSchema>;

/** The share a rollout lets in at `now`. */
export function rolloutPercentageAt(rollout: Rollout, now: number): number {
	switch (rollout.kind) {
		case "FIXED":
			return rollout.percentage;
		case "SCHEDULED":
			return rollout.steps.reduce((share, step) => (step.at <= now ? step.percentage : share), PERCENTAGE_MIN);
	}
}

/** The next time a rollout's share changes after `now`, or null when it no longer will. */
export function nextRolloutChangeAt(rollout: Rollout, now: number): number | null {
	if (rollout.kind === "FIXED") {
		return null;
	}
	return rollout.steps.find((step) => step.at > now)?.at ?? null;
}
