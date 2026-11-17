import {
	rolloutPercentageAt,
	type Condition,
	type ConditionAttribute,
	type DecisionSource,
	type ExperimentStatus,
	type FlagOverrideUnit,
	type ReadyToRemoveReason,
	type RevisionStatus,
	type Rollout,
	type RolloutUnit,
} from "@workspace/shared";
import type { StatusTone } from "@workspace/ui/components/status-badge";

// ── How the Releases pages name things (ADR 087) ─────────────────────────────────────────────────

export const ROLLOUT_UNIT_LABELS: Readonly<Record<RolloutUnit, string>> = { USER: "Person", TENANT: "Merchant", LOCATION: "Branch", DEVICE: "Device" };

export const OVERRIDE_UNIT_LABELS: Readonly<Record<FlagOverrideUnit, string>> = { USER: "Person", LOCATION: "Branch", TENANT: "Merchant" };

export const DECISION_SOURCE_LABELS: Readonly<Record<DecisionSource, string>> = {
	KILL_SWITCH: "Kill switch",
	OVERRIDE_USER: "Person override",
	OVERRIDE_LOCATION: "Branch override",
	OVERRIDE_TENANT: "Merchant override",
	RULE: "Rule",
	EXPERIMENT: "Experiment",
	DEFAULT: "Code default",
};

export const REVISION_STATUS_LABELS: Readonly<Record<RevisionStatus, string>> = {
	LIVE: "Live",
	PENDING: "Waiting for approval",
	SUPERSEDED: "Replaced",
	REJECTED: "Rejected",
	EXPIRED: "Expired",
};

export const REVISION_STATUS_TONES: Readonly<Record<RevisionStatus, StatusTone>> = {
	LIVE: "success",
	PENDING: "warning",
	SUPERSEDED: "muted",
	REJECTED: "danger",
	EXPIRED: "muted",
};

export const READY_TO_REMOVE_LABELS: Readonly<Record<ReadyToRemoveReason, string>> = {
	ALWAYS_ON: "On for everyone for 30 days",
	ALWAYS_OFF: "Off for everyone for 30 days",
	KILLED: "Killed for 30 days",
	NEVER_CHECKED: "Not checked in 30 days",
};

export const EXPERIMENT_STATUS_LABELS: Readonly<Record<ExperimentStatus, string>> = { DRAFT: "Draft", RUNNING: "Running", STOPPED: "Stopped" };

export const EXPERIMENT_STATUS_TONES: Readonly<Record<ExperimentStatus, StatusTone>> = { DRAFT: "muted", RUNNING: "info", STOPPED: "neutral" };

export const CONDITION_ATTRIBUTE_LABELS: Readonly<Record<ConditionAttribute, string>> = {
	USER_ID: "Person",
	EMAIL_DOMAIN: "Email domain",
	PLATFORM_STAFF: "Platform staff",
	PERMISSION: "Permission",
	TENANT_ID: "Merchant",
	LOCATION_ID: "Branch",
	CUSTOMER_TIER: "Customer tier",
	APP: "App",
	PLATFORM: "Platform",
	APP_VERSION: "App version",
	LOCALE: "Language",
	FLAG_GROUP: "Flag group",
	TIME: "Time window",
	ENVIRONMENT: "Environment",
};

const DATE_TIME = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** A time for the Releases pages, or a dash. */
export function formatWhen(at: number | null): string {
	return at === null ? "—" : DATE_TIME.format(at);
}

function listOf(values: readonly string[]): string {
	return values.join(", ");
}

/** One condition in a sentence: "Email domain is one of example.com", "App version at least 2.0.0". */
export function describeCondition(condition: Condition): string {
	const label = CONDITION_ATTRIBUTE_LABELS[condition.attribute];
	switch (condition.attribute) {
		case "PLATFORM_STAFF":
			return condition.is ? "Is platform staff" : "Isn't platform staff";
		case "PERMISSION":
			return `${condition.operator === "HAS" ? "Has" : "Lacks"} ${condition.permission.action}:${condition.permission.resource}`;
		case "APP_VERSION":
			return `${label} ${condition.operator === "AT_LEAST" ? "at least" : "below"} ${condition.version}`;
		case "FLAG_GROUP":
			return `${condition.operator === "IN_GROUP" ? "In" : "Not in"} the group ${condition.groupKey}`;
		case "TIME":
			return `Between ${formatWhen(condition.from)} and ${formatWhen(condition.until)}`;
		default:
			return `${label} ${condition.operator === "IN" ? "is one of" : "is none of"} ${listOf(condition.values)}`;
	}
}

/** A rollout in a few words, with its share now. */
export function describeRollout(rollout: Rollout, now: number): string {
	if (rollout.kind === "FIXED") {
		return `${String(rollout.percentage)}% of them`;
	}
	const steps = rollout.steps.map((step) => `${String(step.percentage)}% from ${formatWhen(step.at)}`).join(", then ");
	return `${String(rolloutPercentageAt(rollout, now))}% now (${steps})`;
}
