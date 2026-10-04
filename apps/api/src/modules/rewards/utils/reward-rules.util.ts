import { Prisma } from "@prisma/client";
import { MINOR_UNITS_PER_MAJOR, RewardRulesSchema, type RewardRules } from "@workspace/shared";

/** A reward's stored `rules` JSON does not match `RewardRulesSchema` — an integrity fault, never read as "no rules". */
export class RewardRulesInvalidError extends Error {
	public constructor(public readonly issues: string) {
		super(`Stored reward rules are invalid: ${issues}`);
		this.name = "RewardRulesInvalidError";
	}
}

/** Ringgit (possibly fractional) → whole sen. */
export function minSpendMyrToMinor(minSpendMyr: number): number {
	return Math.round(minSpendMyr * MINOR_UNITS_PER_MAJOR);
}

/** The columns a reward's API `rules` are stored in. */
export interface StoredRewardRules {
	/** Every rule except the minimum spend; `Prisma.DbNull` when nothing is left. */
	readonly rules: Prisma.InputJsonObject | typeof Prisma.DbNull;
	/** `rewards.min_spend_minor` — the single source of truth for the minimum spend. */
	readonly minSpendMinor: number | null;
}

/**
 * Splits validated API rules into their columns: the minimum spend goes to the
 * integer `minSpendMinor` column, the rest stays JSON. Writing it twice (JSON
 * float + column) would leave two sources that can disagree.
 */
export function toStoredRewardRules(rules: RewardRules): StoredRewardRules {
	const { minSpendMyr, ...rest } = rules;
	// Every other rule, as-is (absent optional rules are dropped, never stored as null).
	const remaining: Prisma.InputJsonObject = Object.fromEntries(Object.entries(rest).filter((entry): entry is [string, number] => entry[1] !== undefined));
	return {
		rules: Object.keys(remaining).length === 0 ? Prisma.DbNull : remaining,
		minSpendMinor: minSpendMyr === undefined ? null : minSpendMyrToMinor(minSpendMyr),
	};
}

/**
 * The API view of a stored reward's rules: the JSON rules plus `minSpendMyr`
 * derived from the integer column. Stored JSON that fails the schema THROWS —
 * silently returning "no rules" would hide (and, for redemption, skip) them.
 */
export function rewardRulesFromStorage(rules: Prisma.JsonValue | null, minSpendMinor: number | null): RewardRules | null {
	const parsed = rules === null ? null : RewardRulesSchema.safeParse(rules);
	if (parsed !== null && !parsed.success) {
		throw new RewardRulesInvalidError(parsed.error.message);
	}
	const stored: RewardRules = parsed?.data ?? {};
	const combined: RewardRules = minSpendMinor === null ? stored : { ...stored, minSpendMyr: minSpendMinor / MINOR_UNITS_PER_MAJOR };
	return Object.keys(combined).length === 0 ? null : combined;
}
