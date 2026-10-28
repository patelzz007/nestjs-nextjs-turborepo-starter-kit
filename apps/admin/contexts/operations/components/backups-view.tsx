"use client";

// Database backups (ADR 068, SuperAdmin only): back up now, the daily schedule and retention, every
// backup with its size, checksum and versions, pin, download (after a fresh second factor) and delete.

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { OPS_BACKUP_LAST_HOUR, type OpsBackup, type OpsBackupSchedule, type OpsBackupStatus } from "@workspace/shared";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge";
import { type Action, DataTable, type DataTableFeatures, type EmptyStateConfig } from "@workspace/ui/components/data-table";
import { toastMessage } from "@workspace/ui/components/toast";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { DatabaseBackup, Download, Pin, Trash2 } from "lucide-react";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";

import { formatBytes, formatDateTimeShort } from "../lib/ops-format";
import { useNumberField } from "../lib/use-ops-hooks";

const STATUS_PRESENTATION: Readonly<Record<OpsBackupStatus, { readonly label: string; readonly tone: StatusTone }>> = {
	QUEUED: { label: "Queued", tone: "muted" },
	RUNNING: { label: "Running", tone: "info" },
	SUCCEEDED: { label: "Done", tone: "success" },
	FAILED: { label: "Failed", tone: "danger" },
};

/** While a backup is queued or running the list refreshes quickly. */
const ACTIVE_REFRESH_MS = 3_000;
const IDLE_REFRESH_MS = 60_000;

function isActiveBackup(backup: OpsBackup): boolean {
	return backup.status === "QUEUED" || backup.status === "RUNNING";
}

function ScheduleForm({
	schedule,
	timeZone,
	nextScheduledAt,
}: {
	readonly schedule: OpsBackupSchedule;
	readonly timeZone: string;
	readonly nextScheduledAt: number;
}): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [draft, setDraft] = React.useState<OpsBackupSchedule>(schedule);
	const save = api.operations.backupSchedule.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Backup schedule saved" });
			await queryClient.invalidateQueries({ queryKey: apiRouter.operations.backups.queryKey(undefined) });
		},
		onError: (error): void => {
			toastMutationError("Could not save the schedule", error);
		},
	});
	const handleHour = useNumberField(setDraft, "backupHour");
	const handleRetention = useNumberField(setDraft, "retentionDays");
	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			save.mutate(draft);
		},
		[save, draft],
	);
	return (
		<Card>
			<CardHeader>
				<CardTitle>Schedule</CardTitle>
				<CardDescription>
					A backup runs every day at this hour ({timeZone}). Next: {formatDateTimeShort(nextScheduledAt)}. Pinned backups are never removed.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form className="flex flex-wrap items-end gap-4" onSubmit={handleSubmit}>
					<div className="space-y-1">
						<Label htmlFor="backup-hour">Hour</Label>
						<Input id="backup-hour" type="number" min={0} max={OPS_BACKUP_LAST_HOUR} className="w-24" value={draft.backupHour} onChange={handleHour} />
					</div>
					<div className="space-y-1">
						<Label htmlFor="backup-retention">Keep for (days)</Label>
						<Input id="backup-retention" type="number" min={1} className="w-24" value={draft.retentionDays} onChange={handleRetention} />
					</div>
					<Button type="submit" disabled={save.isPending}>
						{save.isPending ? "Saving…" : "Save schedule"}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

const BACKUP_COLUMNS: ColumnDef<DataTableFeatures, OpsBackup>[] = [
	{
		accessorKey: "createdAt",
		header: "Taken",
		cell: ({ row }) => (
			<div>
				<p className="flex items-center gap-1.5 font-medium tabular-nums">
					{formatDateTimeShort(row.original.createdAt)}
					{row.original.pinned ? <Pin aria-label="Pinned" className="size-3.5 text-muted-foreground" /> : null}
				</p>
				<p className="text-xs text-muted-foreground">{row.original.trigger === "SCHEDULED" ? "Daily backup" : `By ${row.original.requestedByName ?? "an operator"}`}</p>
			</div>
		),
	},
	{
		accessorKey: "status",
		header: "Status",
		cell: ({ row }) => (
			<div>
				<StatusBadge tone={STATUS_PRESENTATION[row.original.status].tone}>{STATUS_PRESENTATION[row.original.status].label}</StatusBadge>
				{row.original.error === null ? null : <p className="mt-1 max-w-80 text-xs text-destructive">{row.original.error}</p>}
			</div>
		),
	},
	{ accessorKey: "sizeBytes", header: "Size", cell: ({ row }) => <span className="tabular-nums">{formatBytes(row.original.sizeBytes)}</span> },
	{
		accessorKey: "pgDumpVersion",
		header: "Tool and checksum",
		enableSorting: false,
		cell: ({ row }) => (
			<div className="text-xs text-muted-foreground">
				<p>{row.original.pgDumpVersion ?? "—"}</p>
				<p className="font-mono">{row.original.checksum === null ? "" : `sha256 ${row.original.checksum.slice(0, 12)}…`}</p>
			</div>
		),
	},
];
const BACKUPS_EMPTY: EmptyStateConfig = { title: "No backups yet", description: "Back up now, or wait for tonight's scheduled backup." };

/** The row actions: download (a finished backup), pin or unpin, delete (once it has finished). */
function useBackupActions(): Action<OpsBackup>[] {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const refresh = React.useCallback(async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: apiRouter.operations.backups.queryKey(undefined) });
	}, [queryClient]);
	const pin = api.operations.pinBackup.useMutation({
		onSuccess: refresh,
		onError: (error): void => {
			toastMutationError("Could not change the pin", error);
		},
	});
	const remove = api.operations.deleteBackup.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Backup deleted" });
			await refresh();
		},
		onError: (error): void => {
			toastMutationError("Could not delete the backup", error);
		},
	});
	const download = api.operations.backupDownload.useMutation({
		onSuccess: (result): void => {
			window.location.assign(result.data.url);
		},
		onError: (error): void => {
			toastMutationError("Could not download the backup", error, {
				MFA_STEP_UP_REQUIRED: "Downloading a backup needs a recent sign-in with your authenticator. Sign out, sign back in with it, then download straight away.",
			});
		},
	});
	return React.useMemo(
		(): Action<OpsBackup>[] => [
			{
				key: "download",
				label: "Download",
				icon: <Download className="size-4" />,
				onClick: (backup): void => {
					if (backup.status === "SUCCEEDED") {
						download.mutate({ backupId: backup.id });
					} else {
						toastMessage.error({ title: "Only a finished backup can be downloaded" });
					}
				},
			},
			{
				key: "pin",
				label: "Pin or unpin",
				description: "A pinned backup is kept past the retention.",
				icon: <Pin className="size-4" />,
				onClick: (backup): void => {
					pin.mutate({ backupId: backup.id, pinned: !backup.pinned });
				},
			},
			{
				key: "delete",
				label: "Delete",
				icon: <Trash2 className="size-4" />,
				variant: "destructive",
				isDestructive: true,
				onClick: (backup): void => {
					if (!isFinishedBackup(backup)) {
						toastMessage.error({ title: "A backup can be deleted once it has finished" });
					} else if (window.confirm("Delete this backup and its file? This cannot be undone.")) {
						remove.mutate({ backupId: backup.id });
					}
				},
			},
		],
		[download, pin, remove],
	);
}

function isFinishedBackup(backup: OpsBackup): boolean {
	return backup.status === "SUCCEEDED" || backup.status === "FAILED";
}

export function BackupsView(): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const list = api.operations.backups.useQuery(undefined, {
		staleTime: ACTIVE_REFRESH_MS,
		refetchInterval: (query): number => (query.state.data?.data.backups.some(isActiveBackup) === true ? ACTIVE_REFRESH_MS : IDLE_REFRESH_MS),
	});
	const data = list.data?.data;
	const active: boolean = data?.backups.some(isActiveBackup) ?? false;
	const create = api.operations.createBackup.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Backup started" });
			await queryClient.invalidateQueries({ queryKey: apiRouter.operations.backups.queryKey(undefined) });
		},
		onError: (error): void => {
			toastMutationError("Could not start a backup", error);
		},
	});
	const handleCreate = React.useCallback((): void => {
		create.mutate(undefined);
	}, [create]);
	const actions = useBackupActions();
	return (
		<div className="space-y-6">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Backups</h1>
					<p className="text-sm text-muted-foreground">
						A complete copy of the database (pg_dump, custom format) in private, encrypted storage. Restore with the runbook, never from here.
					</p>
				</div>
				<Button type="button" disabled={create.isPending || active || data?.storageConfigured === false} onClick={handleCreate}>
					<DatabaseBackup className="size-4" />
					{active ? "Backup in progress…" : "Back up now"}
				</Button>
			</header>
			{data?.storageConfigured === false ? (
				<Alert>
					<AlertTitle>Backups are not set up here</AlertTitle>
					<AlertDescription>Set BACKUP_DATABASE_URL to the backup&apos;s own login (pnpm --filter @workspace/api db:provision-backup-login creates it).</AlertDescription>
				</Alert>
			) : null}
			{data === undefined ? null : (
				<ScheduleForm key={JSON.stringify(data.schedule)} schedule={data.schedule} timeZone={data.timeZone} nextScheduledAt={data.nextScheduledAt} />
			)}
			<DataTable columns={BACKUP_COLUMNS} data={data?.backups ?? []} actions={actions} isLoading={list.isLoading} emptyState={BACKUPS_EMPTY} persistKey="ops-backups" />
		</div>
	);
}
