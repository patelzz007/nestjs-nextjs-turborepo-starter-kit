import type { RewardStatus } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

const STATUS_LABELS: Record<RewardStatus, string> = {
	DRAFT: "Draft",
	PENDING_REVIEW: "In review",
	PUBLISHED: "Live",
	EXPIRED: "Expired",
	DISABLED: "Disabled",
};

const STATUS_CLASS: Record<RewardStatus, string> = {
	DRAFT: "border-border bg-muted text-muted-foreground",
	PENDING_REVIEW: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
	PUBLISHED: "border-primary/40 bg-primary/10 text-primary",
	EXPIRED: "border-border bg-muted text-muted-foreground",
	DISABLED: "border-destructive/30 bg-destructive/10 text-destructive",
};

export interface MerchantRewardStatusBadgeProps {
	readonly status: RewardStatus;
	readonly className?: string;
}

export function MerchantRewardStatusBadge({ status, className }: MerchantRewardStatusBadgeProps): React.JSX.Element {
	return (
		<Badge variant="outline" className={cn("font-medium", STATUS_CLASS[status], className)}>
			{STATUS_LABELS[status]}
		</Badge>
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
				<div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
			</div>
		</div>
	);
}
