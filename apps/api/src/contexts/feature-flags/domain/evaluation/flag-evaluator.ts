import {
	DYNAMIC_CONFIG_REGISTRY,
	FEATURE_FLAG_REGISTRY,
	nextRolloutChangeAt,
	PERCENTAGE_MAX,
	PERCENTAGE_MIN,
	rolloutPercentageAt,
	type Condition,
	type ConditionAttribute,
	type ConfigResult,
	type DecisionTraceStep,
	type DynamicConfigKey,
	type FeatureFlagKey,
	type FlagResult,
	type JsonObject,
	type Rollout,
	type RolloutUnit,
} from "@workspace/shared";

import type { CatalogIndex } from "../catalog/catalog-index";
import { bucketOf, experimentTrafficSeed, experimentVariantSeed, isWithinPercentage, rolloutSeed, variantAt } from "./bucketing";
import { matchesCondition } from "./condition-matcher";
import { unitIdOf, withoutSubject, type EvaluationSubject } from "./evaluation-subject";

// ── The flag engine (ADR 087) ────────────────────────────────────────────────────────────────────
// Pure: the catalogue's index and the subject in, the value and every step that led to it out.
// A flag: kill switch → flag override (user → location → tenant) → rules (the first a subject matches
// decides, with its share) → the code default. A config: a running experiment → rules → the code default.

export interface FlagDecision {
	readonly result: FlagResult;
	readonly trace: readonly DecisionTraceStep[];
}

export interface ConfigDecision {
	readonly result: ConfigResult;
	readonly trace: readonly DecisionTraceStep[];
}

/** How a matched rule's share treats one subject. */
type ShareOutcome = { readonly kind: "IN" } | { readonly kind: "OUT" } | { readonly kind: "NO_UNIT" };

interface RuleLike {
	readonly id: string;
	readonly name: string;
	readonly conditions: readonly Condition[];
	readonly rollout: Rollout;
}

function step(kind: DecisionTraceStep["step"], label: string, matched: boolean, failedAttribute: ConditionAttribute | null, detail: string | null): DecisionTraceStep {
	return { step: kind, label, matched, failedAttribute, detail };
}

function firstFailedCondition(rule: RuleLike, subject: EvaluationSubject, index: CatalogIndex): Condition | null {
	return rule.conditions.find((condition) => !matchesCondition(condition, subject, index)) ?? null;
}

/** A matched rule's share: everyone at 100%, no one at 0%, otherwise the subject's bucket (which needs its unit id). */
function shareOutcome(key: string, rule: RuleLike, unit: RolloutUnit, subject: EvaluationSubject): ShareOutcome {
	const percentage = rolloutPercentageAt(rule.rollout, subject.now);
	if (percentage >= PERCENTAGE_MAX) {
		return { kind: "IN" };
	}
	if (percentage <= PERCENTAGE_MIN) {
		return { kind: "OUT" };
	}
	const unitId = unitIdOf(subject, unit);
	if (unitId === null) {
		return { kind: "NO_UNIT" };
	}
	return isWithinPercentage(rolloutSeed(key), unitId, percentage) ? { kind: "IN" } : { kind: "OUT" };
}

function overrideFor(
	key: FeatureFlagKey,
	subject: EvaluationSubject,
	index: CatalogIndex,
): { readonly on: boolean; readonly source: FlagResult["source"]; readonly label: string } | null {
	const user = index.override(key, "USER", subject.userId);
	if (user !== null) {
		return { on: user, source: "OVERRIDE_USER", label: "User override" };
	}
	const location = index.override(key, "LOCATION", subject.locationId);
	if (location !== null) {
		return { on: location, source: "OVERRIDE_LOCATION", label: "Location override" };
	}
	const tenant = index.override(key, "TENANT", subject.tenantId);
	if (tenant !== null) {
		return { on: tenant, source: "OVERRIDE_TENANT", label: "Tenant override" };
	}
	return null;
}

/** Whether a feature flag is on for the subject (for no one in particular, when it is deployment-wide), and why. */
export function evaluateFlag(key: FeatureFlagKey, index: CatalogIndex, asked: EvaluationSubject): FlagDecision {
	const definition = FEATURE_FLAG_REGISTRY[key];
	const subject = definition.deploymentWide ? withoutSubject(asked) : asked;
	const trace: DecisionTraceStep[] = [];
	if (index.isKilled(key)) {
		trace.push(step("KILL_SWITCH", "Kill switch", true, null, "Thrown: off for everyone"));
		return { result: { key, on: false, source: "KILL_SWITCH", revision: null, ruleId: null }, trace };
	}
	trace.push(step("KILL_SWITCH", "Kill switch", false, null, null));

	const override = overrideFor(key, subject, index);
	if (override !== null) {
		trace.push(step("OVERRIDE", override.label, true, null, override.on ? "Forced on" : "Forced off"));
		return { result: { key, on: override.on, source: override.source, revision: null, ruleId: null }, trace };
	}
	trace.push(step("OVERRIDE", "Flag overrides", false, null, null));

	const revision = index.flagRevision(key);
	for (const rule of revision?.rules ?? []) {
		const failed = firstFailedCondition(rule, subject, index);
		if (failed !== null) {
			trace.push(step("RULE", rule.name, false, failed.attribute, null));
			continue;
		}
		const share = shareOutcome(key, rule, definition.rolloutUnit, subject);
		if (share.kind === "NO_UNIT") {
			trace.push(step("RULE", rule.name, false, null, `A share needs the subject's ${definition.rolloutUnit.toLowerCase()}`));
			continue;
		}
		const on = share.kind === "IN";
		trace.push(step("RULE", rule.name, true, null, on ? "Inside the share" : "Outside the share"));
		return { result: { key, on, source: "RULE", revision: revision?.number ?? null, ruleId: rule.id }, trace };
	}

	trace.push(step("DEFAULT", "Code default", true, null, definition.defaultOn ? "On" : "Off"));
	return { result: { key, on: definition.defaultOn, source: "DEFAULT", revision: revision?.number ?? null, ruleId: null }, trace };
}

function valueOf(named: readonly { readonly name: string; readonly value: JsonObject }[], name: string): JsonObject | null {
	return named.find((entry) => entry.name === name)?.value ?? null;
}

/** The value a dynamic config gives the subject, and why. */
export function evaluateConfig(key: DynamicConfigKey, index: CatalogIndex, subject: EvaluationSubject): ConfigDecision {
	const definition = DYNAMIC_CONFIG_REGISTRY[key];
	const revision = index.configRevision(key);
	const trace: DecisionTraceStep[] = [];
	const base = { key, revision: revision?.number ?? null, experimentId: null, variant: null };

	const experiment = index.runningExperiment(key);
	const unitId = unitIdOf(subject, definition.rolloutUnit);
	if (experiment !== null && revision !== null && unitId !== null) {
		if (isWithinPercentage(experimentTrafficSeed(experiment.salt), unitId, experiment.trafficPercentage)) {
			const variant = variantAt(experiment.variants, bucketOf(experimentVariantSeed(experiment.salt), unitId));
			const value = variant === null ? null : valueOf(revision.content.values, variant.valueName);
			if (variant !== null && value !== null) {
				trace.push(step("EXPERIMENT", "Running experiment", true, null, `Variant ${variant.valueName}`));
				return {
					result: { ...base, valueName: variant.valueName, value, source: "EXPERIMENT", ruleId: null, experimentId: experiment.id, variant: variant.valueName },
					trace,
				};
			}
		}
		trace.push(step("EXPERIMENT", "Running experiment", false, null, "Not taking part"));
	}

	for (const rule of revision?.content.rules ?? []) {
		const failed = firstFailedCondition(rule, subject, index);
		if (failed !== null) {
			trace.push(step("RULE", rule.name, false, failed.attribute, null));
			continue;
		}
		const share = shareOutcome(key, rule, definition.rolloutUnit, subject);
		if (share.kind === "NO_UNIT") {
			trace.push(step("RULE", rule.name, false, null, `A share needs the subject's ${definition.rolloutUnit.toLowerCase()}`));
			continue;
		}
		const value = share.kind === "IN" ? valueOf(revision?.content.values ?? [], rule.valueName) : null;
		trace.push(step("RULE", rule.name, true, null, value === null ? "Outside the share: the code default" : `Value ${rule.valueName}`));
		return {
			result: { ...base, valueName: value === null ? null : rule.valueName, value: value ?? definition.defaultValue, source: "RULE", ruleId: rule.id },
			trace,
		};
	}

	trace.push(step("DEFAULT", "Code default", true, null, null));
	return { result: { ...base, valueName: null, value: definition.defaultValue, source: "DEFAULT", ruleId: null }, trace };
}

/** The facts the rules of these flags and configs read (so only those are looked up). */
export function requiredAttributes(index: CatalogIndex, flags: readonly FeatureFlagKey[], configs: readonly DynamicConfigKey[]): ReadonlySet<ConditionAttribute> {
	const attributes = new Set<ConditionAttribute>();
	const visit = (conditions: readonly Condition[]): void => {
		for (const condition of conditions) {
			attributes.add(condition.attribute);
			if (condition.attribute === "FLAG_GROUP") {
				const group = index.group(condition.groupKey);
				if (group?.kind === "CONDITIONS") {
					visit(group.conditions);
				}
			}
		}
	};
	for (const key of flags) {
		for (const rule of index.flagRevision(key)?.rules ?? []) {
			visit(rule.conditions);
		}
	}
	for (const key of configs) {
		for (const rule of index.configRevision(key)?.content.rules ?? []) {
			visit(rule.conditions);
		}
	}
	return attributes;
}

/** The earliest time after `now` a scheduled rollout of these flags or configs changes its share, or null. */
export function nextChangeAt(index: CatalogIndex, flags: readonly FeatureFlagKey[], configs: readonly DynamicConfigKey[], now: number): number | null {
	const rollouts: Rollout[] = [
		...flags.flatMap((key) => (index.flagRevision(key)?.rules ?? []).map((rule) => rule.rollout)),
		...configs.flatMap((key) => (index.configRevision(key)?.content.rules ?? []).map((rule) => rule.rollout)),
	];
	return rollouts.reduce<number | null>((earliest, rollout) => {
		const next = nextRolloutChangeAt(rollout, now);
		return next === null ? earliest : earliest === null ? next : Math.min(earliest, next);
	}, null);
}
