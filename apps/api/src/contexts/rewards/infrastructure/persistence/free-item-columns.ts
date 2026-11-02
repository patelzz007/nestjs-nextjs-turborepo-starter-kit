import type { RewardFreeItem } from "@workspace/shared";

/** The two Reward columns that hold an offer's free item (ADR 074). */
export interface FreeItemColumns {
	readonly freeItemName: string | null;
	readonly freeItemSku: string | null;
}

/** The free item as its columns store it: both set, or both null. */
export function freeItemColumns(freeItem: RewardFreeItem | null): FreeItemColumns {
	return { freeItemName: freeItem?.name ?? null, freeItemSku: freeItem?.sku ?? null };
}

/** The free item a row holds: only a row with both columns set names one. */
export function freeItemOfColumns(columns: FreeItemColumns): RewardFreeItem | null {
	return columns.freeItemName === null || columns.freeItemSku === null ? null : { name: columns.freeItemName, sku: columns.freeItemSku };
}
