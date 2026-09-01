import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

export interface RewardInventoryBarProps {
	readonly remaining: number;
	readonly total: number;
	readonly className?: string;
	readonly compact?: boolean;
}

/** Scarcity indicator for consumer rewards. */
export function RewardInventoryBar({ remaining, total, className, compact = false }: RewardInventoryBarProps): React.JSX.Element {
	const percentLeft = total > 0 ? Math.round((remaining / total) * 100) : 0;
	const isLow = percentLeft > 0 && percentLeft <= 20;

	if (compact) {
		return (
			<div className={cn("flex min-w-[4.5rem] items-center gap-2", className)}>
				<div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
					<div
						className={cn("h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none", isLow ? "bg-warning" : "bg-primary")}
						style={{ width: `${percentLeft}%` }}
					/>
				</div>
				<span className="shrink-0 text-xs text-muted-foreground tabular-nums">{remaining}</span>
			</div>
		);
	}

	return (
		<div className={cn("space-y-1.5", className)}>
			<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
				<span>Availability</span>
				<span className="tabular-nums">
					{remaining} of {total} left
				</span>
			</div>
			<div className="h-1.5 overflow-hidden rounded-full bg-muted">
				<div
					className={cn("h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none", isLow ? "bg-warning" : "bg-primary")}
					style={{ width: `${percentLeft}%` }}
				/>
			</div>
		</div>
	);
}
