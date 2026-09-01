"use client";

import { readRewardHubViewMode, writeRewardHubViewMode, type RewardHubViewMode } from "@/lib/rewards/view-mode";
import * as React from "react";

export interface RewardHubViewModeState {
	readonly viewMode: RewardHubViewMode;
	readonly setViewMode: (mode: RewardHubViewMode) => void;
}

/** Persists grid vs list preference for the consumer rewards catalog. */
export function useRewardHubViewMode(): RewardHubViewModeState {
	const [viewMode, setViewModeState] = React.useState<RewardHubViewMode>("grid");

	React.useEffect((): void => {
		setViewModeState(readRewardHubViewMode());
	}, []);

	const setViewMode = React.useCallback((mode: RewardHubViewMode): void => {
		setViewModeState(mode);
		writeRewardHubViewMode(mode);
	}, []);

	return { viewMode, setViewMode };
}
