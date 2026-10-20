import { z } from "zod";

// ── Reward enums (mirror Prisma — packages/shared cannot import @prisma/client) ───

export const RewardTypeSchema = z.enum(["DISCOUNT", "FREE_ITEM", "CASHBACK", "POINTS", "BOGO"]);
export type RewardType = z.output<typeof RewardTypeSchema>;

export const RewardStatusSchema = z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "EXPIRED", "DISABLED"]);
export type RewardStatus = z.output<typeof RewardStatusSchema>;

export const RewardKindSchema = z.enum(["CONSUMER", "REFERRER"]);
export type RewardKind = z.output<typeof RewardKindSchema>;

/** Stock placeholder image keys by category (Phase 1). */
export const RewardCategorySchema = z.enum(["cafe", "restaurant", "retail", "wellness", "entertainment", "food", "beverage"]);
export type RewardCategory = z.output<typeof RewardCategorySchema>;

const rewardRulesShape = {
	minSpendMyr: z.number().nonnegative().optional(),
	maxUsePerUser: z.number().int().positive().optional(),
};

/** Reward rules as a merchant SENDS them (request input) — closed: unknown keys are rejected. */
export const RewardRulesSchema = z.object(rewardRulesShape).strict();

export type RewardRules = z.output<typeof RewardRulesSchema>;

/** Reward rules as the API RETURNS them (inside `RewardResponseSchema`) — open, so additive fields never break a client (ADR 022). */
export const RewardRulesResponseSchema = z.object(rewardRulesShape);
