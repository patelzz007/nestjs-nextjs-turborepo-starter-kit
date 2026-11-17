import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** Injection tokens of the tiers context (ADR 085). */
export const TIERS_UNIT_OF_WORK = Symbol("TIERS_UNIT_OF_WORK");
export const TIER_READS = Symbol("TIER_READS");
export const TIER_SETTINGS_STORE = Symbol("TIER_SETTINGS_STORE");
export const TIER_REVIEW_CANDIDATES = Symbol("TIER_REVIEW_CANDIDATES");
export const TIERS_AVAILABILITY = Symbol("TIERS_AVAILABILITY");
export const TIER_EVALUATOR = Symbol("TIER_EVALUATOR");
export const TIER_READ_SERVICE = Symbol("TIER_READ_SERVICE");
export const TIER_SETTINGS_SERVICE = Symbol("TIER_SETTINGS_SERVICE");

/** Reading standings, history, rules and the counted redemptions behind them. */
export const TIER_STANDING_READ_OPERATION: SystemOperationName = "tiers.standing.read";
/** Re-evaluating a customer's tier and recording what changed. */
export const TIER_STANDING_EVALUATE_OPERATION: SystemOperationName = "tiers.standing.evaluate";
/** Platform staff changing the tier rules. */
export const TIER_SETTINGS_WRITE_OPERATION: SystemOperationName = "tiers.settings.write";
