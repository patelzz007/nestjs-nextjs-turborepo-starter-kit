import { z } from "zod";

export const MerchantRewardsViewModeSchema = z.enum(["grid", "list"]);

export type MerchantRewardsViewMode = z.output<typeof MerchantRewardsViewModeSchema>;

const STORAGE_KEY = "merchant-rewards-view-mode";

export function readMerchantRewardsViewMode(): MerchantRewardsViewMode {
	const raw = window.localStorage.getItem(STORAGE_KEY);
	if (raw === null) {
		return "grid";
	}
	const parsed = MerchantRewardsViewModeSchema.safeParse(raw);
	return parsed.success ? parsed.data : "grid";
}

export function writeMerchantRewardsViewMode(mode: MerchantRewardsViewMode): void {
	window.localStorage.setItem(STORAGE_KEY, mode);
}
