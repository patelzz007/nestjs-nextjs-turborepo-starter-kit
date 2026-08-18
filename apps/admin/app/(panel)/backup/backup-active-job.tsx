"use client";

import type { BackupEntry } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Progress, ProgressLabel, ProgressValue } from "@workspace/ui/components/feedback/progress";
import { CircleStop, DatabaseBackup, Loader2 } from "lucide-react";

function ActiveJobCancelButton({ pending, onCancel }: { readonly pending: boolean; readonly onCancel: () => void }): React.JSX.Element {
	return (
		<Button variant="outline" size="sm" className="gap-1" disabled={pending} onClick={onCancel}>
			{pending ? <Loader2 className="size-3.5 animate-spin" /> : <CircleStop className="size-3.5" />}
			Cancel
		</Button>
	);
}

export function BackupActiveJobCard({
	entry,
	stageLabel,
	easedProgress,
	cancelPending,
	onCancel,
}: {
	readonly entry: BackupEntry;
	readonly stageLabel: string;
	readonly easedProgress: number;
	readonly cancelPending: boolean;
	readonly onCancel: () => void;
}): React.JSX.Element {
	const queueHint: string = entry.position !== null && entry.position > 0 ? ` · queue position ${String(entry.position)}` : "";
	return (
		<Card>
			<CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
				<div className="min-w-0">
					<CardTitle className="flex items-center gap-2 text-base">
						<DatabaseBackup className="size-4 shrink-0 text-primary" />
						<span className="truncate">{entry.name}</span>
					</CardTitle>
					<CardDescription>
						{stageLabel}
						{queueHint} — refreshes every 2s.
					</CardDescription>
				</div>
				<ActiveJobCancelButton pending={cancelPending} onCancel={onCancel} />
			</CardHeader>
			<CardContent className="space-y-2">
				<Progress value={easedProgress}>
					<ProgressLabel>{entry.stage}</ProgressLabel>
					<ProgressValue>{(formattedValue: string | null): React.ReactNode => formattedValue ?? `${String(Math.round(easedProgress))}%`}</ProgressValue>
				</Progress>
			</CardContent>
		</Card>
	);
}
