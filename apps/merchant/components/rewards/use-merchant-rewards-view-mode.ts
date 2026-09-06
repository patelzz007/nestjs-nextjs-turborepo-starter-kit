"use client";

import { readMerchantRewardsViewMode, writeMerchantRewardsViewMode, type MerchantRewardsViewMode } from "@/lib/rewards/view-mode";
import * as React from "react";

export interface MerchantRewardsViewModeState {
	readonly viewMode: MerchantRewardsViewMode;
	readonly setViewMode: (mode: MerchantRewardsViewMode) => void;
}

function readInitialMerchantRewardsViewMode(): MerchantRewardsViewMode {
	try {
		return readMerchantRewardsViewMode();
	} catch {
		return "grid";
	}
}

/** Persists grid vs list preference for the rewards catalog. */
export function useMerchantRewardsViewMode(): MerchantRewardsViewModeState {
	const [viewMode, setViewModeState] = React.useState<MerchantRewardsViewMode>(readInitialMerchantRewardsViewMode);

	const setViewMode = React.useCallback((mode: MerchantRewardsViewMode): void => {
		setViewModeState(mode);
		writeMerchantRewardsViewMode(mode);
	}, []);

	return { viewMode, setViewMode };
}
