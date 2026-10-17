import type { RewardStatus } from "@workspace/shared";
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

const STATUS_LABELS: Record<RewardStatus, string> = {
	DRAFT: "Draft",
	PENDING_REVIEW: "In review",
	PUBLISHED: "Live",
	EXPIRED: "Expired",
	DISABLED: "Disabled",
};

/** What each reward status means: live is good news, a review is waiting, disabled is blocked; drafts and ended rewards recede. */
const STATUS_TONE: Record<RewardStatus, StatusTone> = {
	DRAFT: "muted",
	PENDING_REVIEW: "warning",
	PUBLISHED: "success",
	EXPIRED: "muted",
	DISABLED: "danger",
};

export interface MerchantRewardStatusBadgeProps {
	readonly status: RewardStatus;
	readonly className?: string;
}

export function MerchantRewardStatusBadge({ status, className }: MerchantRewardStatusBadgeProps): React.JSX.Element {
	return (
		<StatusBadge tone={STATUS_TONE[status]} className={cn("font-medium", className)}>
			{STATUS_LABELS[status]}
		</StatusBadge>
	);
}
