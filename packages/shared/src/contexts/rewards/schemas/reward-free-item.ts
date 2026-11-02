import { z } from "zod";

import type { RewardType } from "./reward-enums";

// ── The item a Free item or Buy one, get one reward gives (ADR 074) ──
// The till prints its name on the receipt and a POS matches its SKU to a product, so both are
// required for those two reward types and absent for every other type.

/** Longest free-item name (fits a receipt line and the merchant's product catalog). */
export const REWARD_FREE_ITEM_NAME_MAX_LENGTH = 200;

/** Longest SKU (the merchant's own product code, as their POS knows it). */
export const REWARD_FREE_ITEM_SKU_MAX_LENGTH = 64;

/** The reward types that give an item, and so name it. */
export const REWARD_TYPES_WITH_FREE_ITEM: readonly RewardType[] = ["FREE_ITEM", "BOGO"];

/** Whether a reward of this type gives an item (and must name it). */
export function rewardTypeGivesFreeItem(rewardType: RewardType): boolean {
	return REWARD_TYPES_WITH_FREE_ITEM.includes(rewardType);
}

const RewardFreeItemNameSchema = z.string().trim().min(1, "Name the free item").max(REWARD_FREE_ITEM_NAME_MAX_LENGTH);

/** Letters and digits, with `.`, `_`, `-` and `/` between them — the shapes POS product codes take. */
const RewardFreeItemSkuSchema = z
	.string()
	.trim()
	.min(1, "Enter the item's SKU")
	.max(REWARD_FREE_ITEM_SKU_MAX_LENGTH)
	.regex(/^[A-Za-z0-9](?:[A-Za-z0-9._/-]*[A-Za-z0-9])?$/u, "Use letters, digits, '.', '_', '-' and '/' (starting and ending with a letter or digit)");

/** The free item as a merchant SENDS it — closed: unknown keys are rejected. */
export const RewardFreeItemSchema = z
	.object({
		name: RewardFreeItemNameSchema,
		sku: RewardFreeItemSkuSchema,
	})
	.strict();

export type RewardFreeItem = z.output<typeof RewardFreeItemSchema>;

/** The free item as the API RETURNS it — open, so additive fields never break a client (ADR 022). */
export const RewardFreeItemResponseSchema = z.object({
	name: z.string(),
	sku: z.string(),
});

export type RewardFreeItemResponse = z.output<typeof RewardFreeItemResponseSchema>;

/** The fields the free-item rule reads from a payload or the reward form. */
export interface RewardFreeItemValue {
	readonly rewardType?: RewardType | undefined;
	readonly freeItem?: RewardFreeItem | null | undefined;
}

const FREE_ITEM_REQUIRED = "Name the item this reward gives, with its SKU";
const FREE_ITEM_NOT_ALLOWED = "Only a free item or buy one, get one reward names an item";

/**
 * A payload's free item matches its reward type: required for a type that gives an item, absent for any
 * other. Checked only when the payload carries the type (an update without one is checked by the API
 * against the stored type).
 */
export function refineRewardFreeItem(value: RewardFreeItemValue, ctx: z.RefinementCtx): void {
	if (value.rewardType === undefined) {
		return;
	}
	const hasItem = value.freeItem !== undefined && value.freeItem !== null;
	if (rewardTypeGivesFreeItem(value.rewardType) && !hasItem) {
		ctx.addIssue({ code: "custom", message: FREE_ITEM_REQUIRED, path: ["freeItem"] });
	}
	if (!rewardTypeGivesFreeItem(value.rewardType) && hasItem) {
		ctx.addIssue({ code: "custom", message: FREE_ITEM_NOT_ALLOWED, path: ["freeItem"] });
	}
}
