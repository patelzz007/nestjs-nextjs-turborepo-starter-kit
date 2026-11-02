import { rewardTypeGivesFreeItem, type RewardFreeItem, type RewardType } from "@workspace/shared";

import { RewardFreeItemInvalidError } from "../errors/reward.errors";

/**
 * The item a free item or buy one, get one reward gives (ADR 074): its name, as the receipt prints it,
 * and the merchant's SKU, as their POS knows the product. Exactly those two reward types name one.
 */
export function assertFreeItemFitsType(rewardType: RewardType, freeItem: RewardFreeItem | null): void {
	if (rewardTypeGivesFreeItem(rewardType) !== (freeItem !== null)) {
		throw new RewardFreeItemInvalidError(rewardType);
	}
}

/**
 * The item an offer gives after a merchant's edit: the one sent; otherwise the current one while the
 * (possibly new) type still gives an item, and none once it gives none.
 */
export function revisedFreeItem(rewardType: RewardType, current: RewardFreeItem | null, sent: RewardFreeItem | null | undefined): RewardFreeItem | null {
	if (sent !== undefined) {
		return sent;
	}
	return rewardTypeGivesFreeItem(rewardType) ? current : null;
}
