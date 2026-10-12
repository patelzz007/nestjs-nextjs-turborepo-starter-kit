import { describeRewardStock, type RewardStockLevel } from "@/lib/rewards/presentation";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

const BAR_CLASS: Readonly<Record<RewardStockLevel, string>> = {
	plenty: "bg-primary",
	low: "bg-warning",
	out: "bg-muted-foreground/40",
};

const LABEL_CLASS: Readonly<Record<RewardStockLevel, string>> = {
	plenty: "text-foreground",
	low: "text-warning-foreground dark:text-warning",
	out: "text-muted-foreground",
};

export interface RewardStockMeterProps {
	readonly remaining: number;
	readonly total: number;
	/** An ended reward's stock no longer matters: the bar is drawn quiet whatever is left. */
	readonly ended: boolean;
}

/** "28 of 35 left" over a thin bar; running low turns it amber. The label carries the meaning, the bar is decoration. */
export function RewardStockMeter({ remaining, total, ended }: RewardStockMeterProps): React.JSX.Element {
	const stock = describeRewardStock(remaining, total);
	return (
		<div data-slot="reward-stock" data-level={stock.level} className="flex flex-col gap-1.5">
			<p className={cn("text-xs font-medium tabular-nums", LABEL_CLASS[stock.level])}>{stock.label}</p>
			<div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
				<div className={cn("h-full rounded-full", ended ? BAR_CLASS.out : BAR_CLASS[stock.level])} style={{ width: `${String(stock.percentLeft)}%` }} />
			</div>
		</div>
	);
}
