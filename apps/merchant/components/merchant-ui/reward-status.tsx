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

export interface MerchantInventoryBarProps {
	readonly remaining: number;
	readonly total: number;
	readonly className?: string;
}

/** Solid fill inventory bar — no gradients. */
export function MerchantInventoryBar({ remaining, total, className }: MerchantInventoryBarProps): React.JSX.Element {
	const safeTotal = total > 0 ? total : 1;
	const percent = Math.min(100, Math.max(0, Math.round((remaining / safeTotal) * 100)));

	return (
		<div className={cn("space-y-1", className)}>
			<div className="flex items-center justify-between text-xs text-muted-foreground">
				<span>Inventory</span>
				<span className="tabular-nums">
					{remaining} / {total} left
				</span>
			</div>
			<div className="h-2 overflow-hidden rounded-full border border-border bg-muted">
				<div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${String(percent)}%` }} />
			</div>
		</div>
	);
}
