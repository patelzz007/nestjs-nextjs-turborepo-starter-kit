"use client";

import {
	getMerchantRewardsViewModeServerSnapshot,
	readMerchantRewardsViewMode,
	subscribeMerchantRewardsViewMode,
	writeMerchantRewardsViewMode,
	type MerchantRewardsViewMode,
} from "@/lib/rewards/view-mode";
import * as React from "react";

export interface MerchantRewardsViewModeState {
	readonly viewMode: MerchantRewardsViewMode;
	readonly setViewMode: (mode: MerchantRewardsViewMode) => void;
}

/** Persists grid vs list preference for the rewards catalog. */
export function useMerchantRewardsViewMode(): MerchantRewardsViewModeState {
	const viewMode = React.useSyncExternalStore(subscribeMerchantRewardsViewMode, readMerchantRewardsViewMode, getMerchantRewardsViewModeServerSnapshot);

	const setViewMode = React.useCallback((mode: MerchantRewardsViewMode): void => {
		writeMerchantRewardsViewMode(mode);
	}, []);

	return { viewMode, setViewMode };
}
