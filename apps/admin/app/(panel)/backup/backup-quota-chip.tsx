"use client";

import { Hourglass } from "lucide-react";
import { useEffect, useState } from "react";

/** Rolling-hour creation quota for the signed-in admin — shows what's left. */
export function BackupQuotaChip({ limit, used, resetsAt }: { readonly limit: number; readonly used: number; readonly resetsAt: number }): React.JSX.Element {
	const remaining: number = Math.max(0, limit - used);
	const percent: number = Math.min(100, Math.round((used / limit) * 100));
	const exhausted: boolean = remaining === 0;
	const [minutesLeft, setMinutesLeft] = useState<number>(() => Math.max(1, Math.ceil((resetsAt - Date.now()) / 60000)));
	useEffect(() => {
		const tick = (): void => {
			setMinutesLeft(() => Math.max(1, Math.ceil((resetsAt - Date.now()) / 60000)));
		};
		const timer = window.setInterval(tick, 30_000);
		return (): void => {
			window.clearInterval(timer);
		};
	}, [resetsAt]);

	const label: string = exhausted
		? `Quota exhausted — next backup available in ~${String(minutesLeft)}m`
		: used === 0
			? `${String(remaining)} of ${String(limit)} backups left this hour`
			: `${String(remaining)} of ${String(limit)} backups left this hour · resets in ~${String(minutesLeft)}m`;
	return (
		<div
			className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${exhausted ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border bg-muted/40 text-muted-foreground"}`}
			title={`${String(used)} used in the current rolling hour`}>
			<Hourglass className="size-3.5 shrink-0" />
			<span className="tabular-nums">{label}</span>
			<span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-foreground/10">
				<span className={`block h-full rounded-full ${exhausted ? "bg-destructive" : "bg-primary"}`} style={{ width: `${String(percent)}%` }} />
			</span>
		</div>
	);
}
