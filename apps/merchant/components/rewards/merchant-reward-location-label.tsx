"use client";

import type { RewardResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { MapPin } from "lucide-react";
import * as React from "react";

export function formatRewardLocationScopeLabel(reward: Pick<RewardResponse, "locationScopeType" | "locationNames" | "locationIds">): string {
	if (reward.locationScopeType === "ALL_LOCATIONS") {
		return "All stores";
	}

	if (reward.locationNames !== undefined && reward.locationNames.length > 0) {
		return reward.locationNames.join(", ");
	}

	if (reward.locationIds.length === 1) {
		return "1 store";
	}

	return `${String(reward.locationIds.length)} stores`;
}

export interface MerchantRewardLocationLabelProps {
	readonly reward: Pick<RewardResponse, "locationScopeType" | "locationNames" | "locationIds">;
}

export function MerchantRewardLocationLabel({ reward }: MerchantRewardLocationLabelProps): React.JSX.Element {
	return (
		<Badge variant="outline" className="gap-1 font-normal">
			<MapPin className="size-3" aria-hidden="true" />
			{formatRewardLocationScopeLabel(reward)}
		</Badge>
	);
}
