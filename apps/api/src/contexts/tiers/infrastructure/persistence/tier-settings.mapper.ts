import type { Prisma } from "@prisma/client";
import { DEFAULT_TIER_RULES, TierRulesSchema, type TierRules } from "@workspace/shared";

/** The one settings row's key. */
export const TIER_SETTINGS_KEY = "default";

/** The settings columns the rules are read from. */
export const TIER_RULES_SELECT = {
	silverThreshold: true,
	goldThreshold: true,
	diamondThreshold: true,
	windowDays: true,
	perMerchantCap: true,
	holdDays: true,
	warningDays: true,
} satisfies Prisma.CustomerTierSettingsSelect;

type TierRulesRow = Prisma.CustomerTierSettingsGetPayload<{ select: typeof TIER_RULES_SELECT }>;

/**
 * The stored rules, validated (a row the rules cannot accept is corrupt and fails loudly); the defaults without a row.
 * Only the rule columns are read, so a row selected with more (who changed it, why) passes the strict schema too.
 */
export function tierRulesOf(row: TierRulesRow | null): TierRules {
	if (row === null) {
		return DEFAULT_TIER_RULES;
	}
	const { silverThreshold, goldThreshold, diamondThreshold, windowDays, perMerchantCap, holdDays, warningDays } = row;
	return TierRulesSchema.parse({ silverThreshold, goldThreshold, diamondThreshold, windowDays, perMerchantCap, holdDays, warningDays });
}

/** The rules in force, read inside the caller's transaction. */
export async function readTierRules(db: Prisma.TransactionClient): Promise<TierRules> {
	return tierRulesOf(await db.customerTierSettings.findFirst({ where: { key: TIER_SETTINGS_KEY, isDeleted: false }, select: TIER_RULES_SELECT }));
}
