import { RewardRulesSchema, type JsonValue, type RewardRules } from "@workspace/shared";

import { RewardRulesInvalidError } from "../errors/reward.errors";
import { MinorUnits } from "./minor-units.value-object";

/** Every rule except the minimum spend, as stored in the reward's `rules` JSON column. */
export type StoredRewardRuleValues = Readonly<Record<string, number>>;

/**
 * A reward's redemption rules. The minimum spend lives in its own integer column (sen), the single
 * source of truth; the other rules stay JSON. Writing the minimum twice would leave two sources
 * that can disagree.
 */
export class RewardRulesValue {
	private constructor(
		private readonly otherRules: StoredRewardRuleValues,
		public readonly minSpend: MinorUnits | null,
	) {}

	public static none(): RewardRulesValue {
		return new RewardRulesValue({}, null);
	}

	/** Validated API rules (`minSpendMyr` in ringgit). */
	public static fromApi(rules: RewardRules): RewardRulesValue {
		const { minSpendMyr, ...rest } = RewardRulesSchema.parse(rules);
		const others: Record<string, number> = {};
		for (const [name, value] of Object.entries(rest)) {
			if (value !== undefined) {
				others[name] = value;
			}
		}
		return new RewardRulesValue(others, minSpendMyr === undefined ? null : MinorUnits.fromMajor(minSpendMyr));
	}

	/** Stored columns. JSON that does not match the rules schema is an integrity fault, never "no rules". */
	public static fromStorage(storedRules: JsonValue | null, minSpendMinor: number | null): RewardRulesValue {
		const parsed = storedRules === null ? null : RewardRulesSchema.safeParse(storedRules);
		if (parsed !== null && !parsed.success) {
			throw new RewardRulesInvalidError(parsed.error.message);
		}
		const { minSpendMyr: legacyMinSpendMyr, ...rest } = parsed?.data ?? {};
		const others: Record<string, number> = {};
		for (const [name, value] of Object.entries(rest)) {
			if (value !== undefined) {
				others[name] = value;
			}
		}
		// The column wins; a minimum left in the JSON by an older write is read as before.
		const minSpend = minSpendMinor !== null ? MinorUnits.of(minSpendMinor) : legacyMinSpendMyr === undefined ? null : MinorUnits.fromMajor(legacyMinSpendMyr);
		return new RewardRulesValue(others, minSpend);
	}

	/** The `rules` JSON column; `null` when no rule other than the minimum spend is set. */
	public storedRules(): StoredRewardRuleValues | null {
		return Object.keys(this.otherRules).length === 0 ? null : this.otherRules;
	}

	/** `rules.maxUsePerUser`; `null` = unlimited. */
	public maxUsePerUser(): number | null {
		return this.otherRules.maxUsePerUser ?? null;
	}

	/** The API view: the JSON rules plus `minSpendMyr` derived from the integer column; `null` when there are none. */
	public toApi(): RewardRules | null {
		const combined: RewardRules = RewardRulesSchema.parse(this.minSpend === null ? { ...this.otherRules } : { ...this.otherRules, minSpendMyr: this.minSpend.toMajor() });
		return Object.keys(combined).length === 0 ? null : combined;
	}
}
