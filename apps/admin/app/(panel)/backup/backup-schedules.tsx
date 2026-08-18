"use client";

import type { BackupSchedule } from "@workspace/shared";
import { formatDateTime } from "@/lib/dates";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Clock } from "lucide-react";
import { useCallback } from "react";

function ScheduleRow({
	schedule,
	disabled,
	onToggle,
}: {
	readonly schedule: BackupSchedule;
	readonly disabled: boolean;
	readonly onToggle: (schedule: BackupSchedule) => void;
}): React.JSX.Element {
	const handleToggle = useCallback((): void => {
		onToggle(schedule);
	}, [onToggle, schedule]);
	return (
		<div className="flex items-center justify-between rounded-md border border-border p-3">
			<div className="flex items-center gap-3">
				<div className={`size-2 rounded-full ${schedule.enabled ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
				<div>
					<p className="text-sm font-medium">{schedule.name}</p>
					<p className="text-xs text-muted-foreground">
						<Clock className="mr-1 inline size-3" />
						{schedule.cron} · Next run: {formatDateTime(schedule.nextRun)}
					</p>
				</div>
			</div>
			<Button variant="outline" size="sm" disabled={disabled} onClick={handleToggle}>
				{schedule.enabled ? "Disable" : "Enable"}
			</Button>
		</div>
	);
}

export function BackupSchedulesCard({
	schedules,
	disabled,
	onToggle,
}: {
	readonly schedules: readonly BackupSchedule[];
	readonly disabled: boolean;
	readonly onToggle: (schedule: BackupSchedule) => void;
}): React.JSX.Element | null {
	if (schedules.length === 0) return null;
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Scheduled backups</CardTitle>
				<CardDescription>Automated backups that run on a cron schedule. These run as system jobs with superadmin privileges.</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{schedules.map((schedule) => (
						<ScheduleRow key={schedule.id} schedule={schedule} disabled={disabled} onToggle={onToggle} />
					))}
				</div>
			</CardContent>
		</Card>
	);
}
