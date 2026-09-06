"use client";

import { readRewardHubViewMode, writeRewardHubViewMode, type RewardHubViewMode } from "@/lib/rewards/view-mode";
import * as React from "react";

export interface RewardHubViewModeState {
	readonly viewMode: RewardHubViewMode;
	readonly setViewMode: (mode: RewardHubViewMode) => void;
}

function readInitialRewardHubViewMode(): RewardHubViewMode {
	try {
		return readRewardHubViewMode();
	} catch {
		return "grid";
	}
}

/** Persists grid vs list preference for the consumer rewards catalog. */
export function useRewardHubViewMode(): RewardHubViewModeState {
	const [viewMode, setViewModeState] = React.useState<RewardHubViewMode>(readInitialRewardHubViewMode);

	const setViewMode = React.useCallback((mode: RewardHubViewMode): void => {
		setViewModeState(mode);
		writeRewardHubViewMode(mode);
	}, []);

	return { viewMode, setViewMode };
}
