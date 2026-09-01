"use client";

import { readMerchantRewardsViewMode, writeMerchantRewardsViewMode, type MerchantRewardsViewMode } from "@/lib/rewards/view-mode";
import * as React from "react";

export interface MerchantRewardsViewModeState {
	readonly viewMode: MerchantRewardsViewMode;
	readonly setViewMode: (mode: MerchantRewardsViewMode) => void;
}

/** Persists grid vs list preference for the rewards catalog. */
export function useMerchantRewardsViewMode(): MerchantRewardsViewModeState {
	const [viewMode, setViewModeState] = React.useState<MerchantRewardsViewMode>("grid");

	React.useEffect((): void => {
		setViewModeState(readMerchantRewardsViewMode());
	}, []);

	const setViewMode = React.useCallback((mode: MerchantRewardsViewMode): void => {
		setViewModeState(mode);
		writeMerchantRewardsViewMode(mode);
	}, []);

	return { viewMode, setViewMode };
}
