import { z } from "zod";

export const RewardHubViewModeSchema = z.enum(["grid", "list"]);

export type RewardHubViewMode = z.output<typeof RewardHubViewModeSchema>;

const STORAGE_KEY = "rewardhub-view-mode";

export function readRewardHubViewMode(): RewardHubViewMode {
	const raw = window.localStorage.getItem(STORAGE_KEY);
	if (raw === null) {
		return "grid";
	}
	const parsed = RewardHubViewModeSchema.safeParse(raw);
	return parsed.success ? parsed.data : "grid";
}

export function writeRewardHubViewMode(mode: RewardHubViewMode): void {
	window.localStorage.setItem(STORAGE_KEY, mode);
}
