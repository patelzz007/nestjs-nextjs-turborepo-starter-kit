import {
	DYNAMIC_CONFIG_REGISTRY,
	isValidDynamicConfigValue,
	type Condition,
	type ConfigRevisionContent,
	type DeploymentEnvironment,
	type DynamicConfigKey,
	type FeatureFlagKey,
	type FlagRule,
} from "@workspace/shared";

import { FlagRulesInvalidError } from "../errors/feature-flag.errors";

// ── What a set of rules may say, beyond its shape (zod checks the shape) ─────────────────────────

/**
 * The flag the tiers context asks about decides whether a customer even has a tier: a rule of it that read the
 * customer's tier would ask itself (an endless loop), so its rules can't name one.
 */
const TIER_DECIDING_FLAG: FeatureFlagKey = "customer-tiers";

function namedGroups(conditions: readonly Condition[]): readonly string[] {
	return conditions.flatMap((condition) => (condition.attribute === "FLAG_GROUP" ? [condition.groupKey] : []));
}

/** The flag group keys a list of rules names. */
export function groupKeysOf(rules: readonly { readonly conditions: readonly Condition[] }[]): readonly string[] {
	return [...new Set(rules.flatMap((rule) => namedGroups(rule.conditions)))];
}

function assertGroupsExist(key: string, rules: readonly { readonly conditions: readonly Condition[] }[], existingGroups: ReadonlySet<string>): void {
	const missing = groupKeysOf(rules).filter((group) => !existingGroups.has(group));
	if (missing.length > 0) {
		throw new FlagRulesInvalidError(key, `These flag groups don't exist: ${missing.join(", ")}.`);
	}
}

/** Checks a feature flag's new rules against what exists: their groups, and the tier rule. */
export function assertValidFlagRules(key: FeatureFlagKey, rules: readonly FlagRule[], existingGroups: ReadonlySet<string>): void {
	assertGroupsExist(key, rules, existingGroups);
	if (key === TIER_DECIDING_FLAG && rules.some((rule) => rule.conditions.some((condition) => condition.attribute === "CUSTOMER_TIER"))) {
		throw new FlagRulesInvalidError(key, "Customer tiers can't depend on a customer's tier.");
	}
}

/** Checks a dynamic config's new values (against its declared shape) and rules (their groups). */
export function assertValidConfigContent(key: DynamicConfigKey, content: ConfigRevisionContent, existingGroups: ReadonlySet<string>): void {
	const invalid = content.values.filter((value) => !isValidDynamicConfigValue(key, value.value)).map((value) => value.name);
	if (invalid.length > 0) {
		throw new FlagRulesInvalidError(key, `These values don't fit "${DYNAMIC_CONFIG_REGISTRY[key].title}": ${invalid.join(", ")}.`);
	}
	assertGroupsExist(key, content.rules, existingGroups);
}

/** A rule change waits for a second person only in production (kill switches and overrides never wait). */
export function approvalsRequired(environment: DeploymentEnvironment): boolean {
	return environment === "production";
}
