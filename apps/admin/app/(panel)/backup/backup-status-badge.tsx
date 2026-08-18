"use client";

import type { BackupStatus } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { CircleCheck, CircleDashed, CircleX, Loader2 } from "lucide-react";

export function BackupStatusBadge({ status }: { readonly status: BackupStatus }): React.JSX.Element {
	if (status === "completed") {
		return (
			<Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
				<CircleCheck className="size-3.5" />
				Completed
			</Badge>
		);
	}
	if (status === "processing") {
		return (
			<Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
				<CircleDashed className="size-3.5" />
				Processing
			</Badge>
		);
	}
	if (status === "pending") {
		return (
			<Badge variant="secondary" className="gap-1 bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400">
				<Loader2 className="size-3.5 animate-spin" />
				Queued
			</Badge>
		);
	}
	return (
		<Badge variant="secondary" className="gap-1 bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400">
			<CircleX className="size-3.5" />
			Failed
		</Badge>
	);
}
