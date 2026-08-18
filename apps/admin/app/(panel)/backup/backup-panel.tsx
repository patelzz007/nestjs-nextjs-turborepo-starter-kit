"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import type { BackupEntry, BackupStatus } from "@workspace/shared";
import { formatDateTime, timeAgo } from "@/lib/dates";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Checkbox } from "@workspace/ui/components/form/checkbox";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { Slider } from "@workspace/ui/components/form/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { DataTable, type DataTableFeatures } from "@workspace/ui/components/display/data-table";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { Progress, ProgressLabel, ProgressValue } from "@workspace/ui/components/feedback/progress";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from "@workspace/ui/components/overlay/alert-dialog";
import type { ColumnDef } from "@tanstack/react-table";
import {
	CheckCircle2,
	CheckSquare,
	CircleStop,
	CircleX,
	Clock,
	Copy,
	DatabaseBackup,
	DatabaseZap,
	Download,
	HardDrive,
	Hourglass,
	Loader2,
	RefreshCw,
	Settings2,
	ShieldCheck,
	SquareDashedMousePointer,
	Timer,
	Trash2,
	TriangleAlert,
	Zap,
} from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ── Status presentation ───────────────────────────────────────────────────

const STATUS_META: Readonly<
	Record<BackupStatus, { readonly label: string; readonly variant: "default" | "secondary" | "destructive" | "outline"; readonly icon: React.ReactNode }>
> = {
	pending: { label: "Queued", variant: "outline", icon: <Loader2 className="size-3 animate-spin" /> },
	processing: { label: "Processing", variant: "secondary", icon: <Loader2 className="size-3 animate-spin" /> },
	completed: { label: "Completed", variant: "default", icon: <CheckCircle2 className="size-3" /> },
	failed: { label: "Failed", variant: "destructive", icon: <CircleX className="size-3" /> },
};

const STAGE_LABELS: Readonly<Record<string, string>> = {
	queued: "Waiting for the dump to start…",
	dumping: "Dumping the database…",
	compressing: "Compressing the dump…",
	finalizing: "Verifying checksum…",
	done: "Complete",
	failed: "Failed",
};

function StatusBadge({ status }: { readonly status: BackupStatus }): React.JSX.Element {
	const meta = STATUS_META[status];
	return (
		<Badge variant={meta.variant} className="gap-1">
			{meta.icon}
			{meta.label}
		</Badge>
	);
}

/** Rolling-hour creation quota for the signed-in admin — shows what's left. */
function QuotaChip({ limit, used, resetsAt }: { readonly limit: number; readonly used: number; readonly resetsAt: number }): React.JSX.Element {
	const remaining: number = Math.max(0, limit - used);
	const percent: number = Math.min(100, Math.round((used / limit) * 100));
	const exhausted: boolean = remaining === 0;
	// Server window resets when the oldest entry falls out — display in whole
	// minutes. Seeded once + a 30s tick (never Date.now() in the render body).
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

// ── Formatting helpers ────────────────────────────────────────────────────

/** 1234567 → "1.2 MB" — compact human size for the table. */
function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${String(bytes)} B`;
	const units: readonly string[] = ["KB", "MB", "GB", "TB"];
	let value = bytes / 1024;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	return `${value.toFixed(1)} ${units[unitIndex] ?? "KB"}`;
}

/** Triggers a browser download for a same-origin URL (Content-Disposition drives the filename). */
function triggerDownload(url: string): void {
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.rel = "noopener";
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
}

/**
 * Eases the displayed progress toward the polled value (the API jumps
 * 5 → ~60 → 92 → 100), so the bar glides instead of snapping.
 */
function useEasedProgress(target: number): number {
	const [displayed, setDisplayed] = useState<number>(target);
	useEffect(() => {
		let raf: number | null = null;
		const tick = (): void => {
			setDisplayed((current) => {
				const diff: number = target - current;
				if (Math.abs(diff) < 0.75) return target;
				return current + diff * 0.15;
			});
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return (): void => {
			if (raf !== null) cancelAnimationFrame(raf);
		};
	}, [target]);
	return displayed;
}

/** Friendly copy for machine-readable failure categories (improvement 25). */
const ERROR_CODE_COPY: Readonly<Record<string, string>> = {
	CANCELLED: "Cancelled by an administrator",
	TIMEOUT: "The dump exceeded its time limit and was killed",
	DISK_FULL: "Not enough free disk space",
	PGDUMP_UNAVAILABLE: "pg_dump could not be started — is PostgreSQL installed?",
	DUMP_SIZE_MISMATCH: "The dump was truncated while writing",
	RESTORE_FAILED: "The restore step failed",
};

/** Estimates backup time based on DB size (rough heuristic: ~100MB/min for pg_dump). */
function estimateBackupTime(dbSizeBytes: number | null): string {
	if (dbSizeBytes === null) return "Unknown";
	const sizeGB = dbSizeBytes / (1024 * 1024 * 1024);
	if (sizeGB < 0.1) return "~1 min";
	if (sizeGB < 1) return `~${String(Math.max(1, Math.round(sizeGB * 10)))} min`;
	if (sizeGB < 10) return `~${String(Math.round(sizeGB * 1.5))} min`;
	if (sizeGB < 50) return `~${String(Math.round(sizeGB * 2))} min`;
	return `~${String(Math.round(sizeGB * 3))} min`;
}

/** Warning threshold for large databases (10GB). */
const LARGE_DB_THRESHOLD_BYTES = 10 * 1024 * 1024 * 1024;

// ── Smart page component ──────────────────────────────────────────────────

/**
 * Database Backup — create pg_dump snapshots, watch them complete, and
 * download/delete them. The list polls every 2s while a job is running; the
 * download flow mints a signed token (15 min) and streams the file through
 * the same-origin proxy so auth rides the normal admin cookies.
 */
export default function BackupPanel(): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();

	const listQuery = api.backup.list.useQuery(undefined, {
		// While any job is pending/processing, poll every 2s for progress.
		refetchInterval: (query): number | false => {
			const payload = query.state.data;
			const active: boolean =
				payload?.data.active === true || (payload?.data.backups.some((entry: BackupEntry): boolean => entry.status === "pending" || entry.status === "processing") ?? false);
			return active ? 2000 : false;
		},
	});
	const optionsQuery = api.backup.options.useQuery(undefined);

	const createMutation = api.backup.create.useMutation();
	const downloadMutation = api.backup.download.useMutation();
	const removeMutation = api.backup.remove.useMutation();
	const verifyMutation = api.backup.verify.useMutation();
	const restoreMutation = api.backup.restore.useMutation();
	const cancelMutation = api.backup.cancel.useMutation();

	// ── Form state ────────────────────────────────────────────────────────
	const [backupName, setBackupName] = useState<string>("");
	const [compressLevel, setCompressLevel] = useState<number>(6);
	const [excluded, setExcluded] = useState<readonly string[]>([]);
	const [schemaOnly, setSchemaOnly] = useState<boolean>(false);
	const [deleteTarget, setDeleteTarget] = useState<BackupEntry | null>(null);
	const [restoreTarget, setRestoreTarget] = useState<BackupEntry | null>(null);
	const [restoreName, setRestoreName] = useState<string>("");
	const [restorePassword, setRestorePassword] = useState<string>("");
	const excludedSeeded = useRef<boolean>(false);

	// Seed the excluded-tables checkboxes from the API once (env-driven defaults).
	useEffect(() => {
		if (!excludedSeeded.current && optionsQuery.data !== undefined) {
			excludedSeeded.current = true;
			setExcluded(optionsQuery.data.data.defaultExcluded);
		}
	}, [optionsQuery.data]);

	const rows = useMemo<BackupEntry[]>(() => listQuery.data?.data.backups ?? [], [listQuery.data]);
	const activeBackup = useMemo<BackupEntry | undefined>(() => rows.find((entry: BackupEntry): boolean => entry.status === "pending" || entry.status === "processing"), [rows]);

	// ── Job lifecycle toasts (result only) ────────────────────────────
	// The create request only means "queued"; the actual outcome arrives later
	// via polling. Progress lives on the page (the active-job card below); the
	// toasts here report the RESULT — a green completion or red failure card —
	// for jobs we watched go from active → settled while this page was open.
	// Pre-existing history rows (already done before the page opened) stay silent.
	const seenActiveJobs = useRef<ReadonlySet<string>>(new Set());
	const notifiedJobs = useRef<ReadonlySet<string>>(new Set());
	useEffect(() => {
		for (const entry of rows) {
			if (entry.status === "pending" || entry.status === "processing") {
				seenActiveJobs.current = new Set<string>(seenActiveJobs.current).add(entry.id);
				continue;
			}
			if (notifiedJobs.current.has(entry.id) || !seenActiveJobs.current.has(entry.id)) continue;
			notifiedJobs.current = new Set<string>(notifiedJobs.current).add(entry.id);
			if (entry.status === "completed") {
				toastMessage.success({
					title: "Backup completed",
					description: `${entry.name} · ${formatBytes(entry.sizeBytes ?? 0)} · checksum ${(entry.checksum ?? "").slice(0, 10)}…`,
				});
			} else if (entry.errorCode !== "CANCELLED") {
				const reason: string = ERROR_CODE_COPY[entry.errorCode ?? ""] ?? "The backup failed";
				toastMessage.error({ title: "Backup failed", description: `${entry.name}: ${reason}${entry.error !== null ? ` — ${entry.error}` : ""}` });
			}
		}
	}, [rows]);
	// Eased progress so the bar glides toward the polled value (improvement 27).
	const easedProgress: number = useEasedProgress(activeBackup?.progress ?? 0);

	// Size/duration estimate from the most recent completed backup (improvement 30).
	const lastCompleted = useMemo<BackupEntry | undefined>(() => rows.find((entry: BackupEntry): boolean => entry.status === "completed"), [rows]);
	// Rolling-hour quota from the list payload — the create endpoint enforces it server-side;
	// the chip here shows what's left and the form disables once the window is spent.
	const rateLimit = listQuery.data?.data.rateLimit ?? null;
	const quotaExhausted: boolean = rateLimit !== null && rateLimit.used >= rateLimit.limit;
	const formDisabled: boolean = createMutation.isPending || activeBackup !== undefined || quotaExhausted;

	// True when the current selection already equals the env-driven defaults —
	// order-insensitive set comparison (the state array order doesn't matter).
	const isDefaultSelection: boolean = useMemo<boolean>(() => {
		const defaults: readonly string[] = optionsQuery.data?.data.defaultExcluded ?? [];
		return excluded.length === defaults.length && defaults.every((table: string): boolean => excluded.includes(table));
	}, [excluded, optionsQuery.data]);

	const invalidateList = useCallback((): Promise<void> => queryClient.invalidateQueries({ queryKey: ["backup", "list"] }).then(() => undefined), [queryClient]);

	const handleCreate = useCallback(
		async (event: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
			event.preventDefault();
			try {
				const result = await createMutation.mutateAsync({
					name: backupName.trim().length > 0 ? backupName.trim() : undefined,
					compressLevel,
					schemaOnly,
					tablesToExclude: excluded.length > 0 ? [...excluded] : undefined,
				});
				// The progress bar lives on the page itself (the active-job card);
				// the toast here is just a transient "started" notice. The result
				// (completed/failed) arrives later via the polling watcher.
				toastMessage.info({
					title: "Backup started",
					description: `Job ${result.data.backupId.slice(0, 8)} is queued — progress shows below on this page.`,
				});
				setBackupName("");
				await invalidateList();
			} catch (error) {
				toastMessage.error({ title: "Backup failed to start", description: error instanceof Error ? error.message : "Unknown error" });
			}
		},
		[createMutation, backupName, compressLevel, schemaOnly, excluded, invalidateList],
	);

	const handleDownload = useCallback(
		async (entry: BackupEntry): Promise<void> => {
			try {
				const result = await downloadMutation.mutateAsync({ id: entry.id });
				const url = `/api/backup/download/${encodeURIComponent(entry.id)}?token=${encodeURIComponent(result.data.token)}`;
				triggerDownload(url);
				toastMessage.success({ title: "Download started", description: "Your browser will save the compressed backup file." });
			} catch (error) {
				toastMessage.error({ title: "Download unavailable", description: error instanceof Error ? error.message : "Unknown error" });
			}
		},
		[downloadMutation],
	);

	const handleDelete = useCallback(async (): Promise<void> => {
		if (deleteTarget === null) return;
		try {
			await removeMutation.mutateAsync({ id: deleteTarget.id });
			toastMessage.success({ title: "Backup deleted", description: `"${deleteTarget.name}" and its file were removed.` });
			setDeleteTarget(null);
			await invalidateList();
		} catch (error) {
			toastMessage.error({ title: "Delete failed", description: error instanceof Error ? error.message : "Unknown error" });
		}
	}, [deleteTarget, removeMutation, invalidateList]);

	const handleVerify = useCallback(
		async (entry: BackupEntry): Promise<void> => {
			try {
				const result = await verifyMutation.mutateAsync({ id: entry.id });
				toastMessage.success({
					title: "Backup verified",
					description: `${String(result.data.tableCount)} tables restored cleanly into a scratch database (dropped right after the check).`,
				});
			} catch (error) {
				toastMessage.error({ title: "Verification failed", description: error instanceof Error ? error.message : "Unknown error" });
			}
		},
		[verifyMutation],
	);

	const handleRestoreConfirm = useCallback(async (): Promise<void> => {
		if (restoreTarget === null) return;
		try {
			const result = await restoreMutation.mutateAsync({
				id: restoreTarget.id,
				name: restoreName.trim().length > 0 ? restoreName.trim() : undefined,
				password: restorePassword,
			});
			toastMessage.success({
				title: "Backup restored",
				description: `Restored into database "${result.data.database}" (${String(result.data.tableCount)} tables). Dropping it later is a manual DROP DATABASE.`,
			});
			setRestoreTarget(null);
			setRestoreName("");
			setRestorePassword("");
		} catch (error) {
			toastMessage.error({ title: "Restore failed", description: error instanceof Error ? error.message : "Unknown error" });
		}
	}, [restoreTarget, restoreName, restorePassword, restoreMutation]);

	const handleCancel = useCallback(
		async (entry: BackupEntry): Promise<void> => {
			try {
				await cancelMutation.mutateAsync({ id: entry.id });
				toastMessage.success({ title: "Backup cancelled", description: `"${entry.name}" was stopped and marked as cancelled.` });
				await invalidateList();
			} catch (error) {
				toastMessage.error({ title: "Cancel failed", description: error instanceof Error ? error.message : "Unknown error" });
			}
		},
		[cancelMutation, invalidateList],
	);

	const copyChecksum = useCallback((checksum: string): void => {
		void navigator.clipboard.writeText(checksum);
		toastMessage.success({ title: "Checksum copied", description: "SHA-256 digest copied to your clipboard." });
	}, []);

	const handleRefresh = useCallback((): void => {
		void listQuery.refetch();
	}, [listQuery]);

	const columns = useMemo<ColumnDef<DataTableFeatures, BackupEntry>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Backup",
				enableHiding: false,
				cell: ({ row }): React.JSX.Element => (
					<div className="min-w-0">
						<p className="truncate font-medium">
							{row.original.name}
							{row.original.schemaOnly ? (
								<span className="ml-1.5 rounded border border-border px-1 py-0.5 text-[10px] font-normal tracking-wide text-muted-foreground uppercase">schema</span>
							) : null}
						</p>
						<p className="truncate text-xs text-muted-foreground">
							by {row.original.requestedByName ?? "Admin"} · level {row.original.compressLevel}
						</p>
						{row.original.verifiedAt !== null ? (
							<p className="truncate text-xs text-emerald-600 dark:text-emerald-400">
								✓ verified {row.original.verifiedTableCount ?? 0} tables · {formatDateTime(row.original.verifiedAt)}
							</p>
						) : null}
						{row.original.restoredAt !== null ? <p className="truncate text-xs text-sky-600 dark:text-sky-400">↳ restored to {row.original.restoredDatabase}</p> : null}
					</div>
				),
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }): React.JSX.Element => (
					<div className="flex flex-wrap items-center gap-2">
						<StatusBadge status={row.original.status} />
						{row.original.status === "failed" && row.original.error !== null ? (
							<span title={ERROR_CODE_COPY[row.original.errorCode ?? ""] ?? row.original.error} className="max-w-56 truncate text-xs text-destructive">
								{ERROR_CODE_COPY[row.original.errorCode ?? ""] ?? row.original.error}
							</span>
						) : null}
					</div>
				),
			},
			{
				accessorKey: "sizeBytes",
				header: "Size",
				cell: ({ row }): React.JSX.Element => (
					<span className="text-muted-foreground tabular-nums">{row.original.sizeBytes === null ? "—" : formatBytes(row.original.sizeBytes)}</span>
				),
			},
			{
				accessorKey: "checksum",
				header: "Checksum",
				cell: ({ row }): React.JSX.Element => {
					const checksum: string | null = row.original.checksum;
					if (checksum === null) {
						return <span className="text-muted-foreground">—</span>;
					}
					return (
						<button
							type="button"
							onClick={(): void => {
								copyChecksum(checksum);
							}}
							className="inline-flex max-w-36 items-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
							title="Copy SHA-256 checksum">
							<Copy className="size-3 shrink-0" />
							<span className="truncate">{checksum.slice(0, 10)}…</span>
						</button>
					);
				},
			},
			{
				accessorKey: "createdAt",
				header: "Created",
				cell: ({ row }): React.JSX.Element => (
					<div className="text-muted-foreground tabular-nums">
						<p>{formatDateTime(row.original.createdAt)}</p>
						<p className="text-xs">{timeAgo(row.original.createdAt)}</p>
					</div>
				),
			},
			{
				accessorKey: "expiresAt",
				header: "Retained until",
				cell: ({ row }): React.JSX.Element => (
					<span className="text-muted-foreground tabular-nums">{row.original.expiresAt === null ? "—" : formatDateTime(row.original.expiresAt)}</span>
				),
			},
			{
				id: "actions",
				header: "",
				cell: ({ row }): React.JSX.Element => {
					const entry = row.original;
					return (
						<div className="flex items-center justify-end gap-1.5">
							<Button
								variant="outline"
								size="sm"
								disabled={entry.status !== "completed" || verifyMutation.isPending}
								onClick={(): void => {
									void handleVerify(entry);
								}}
								className="gap-1">
								{verifyMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
								Verify
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={entry.status !== "completed" || restoreMutation.isPending}
								onClick={(): void => {
									setRestoreName("");
									setRestorePassword("");
									setRestoreTarget(entry);
								}}
								className="gap-1">
								<DatabaseZap className="size-3.5" />
								Restore
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={entry.status !== "completed" || downloadMutation.isPending}
								onClick={(): void => {
									void handleDownload(entry);
								}}
								className="gap-1.5">
								<Download className="size-3.5" />
								Download
							</Button>
							<Button
								variant="ghost"
								size="icon"
								aria-label={`Delete backup ${entry.name}`}
								disabled={entry.status === "pending" || entry.status === "processing"}
								onClick={(): void => {
									setDeleteTarget(entry);
								}}>
								<Trash2 className="size-4 text-destructive" />
							</Button>
						</div>
					);
				},
			},
		],
		[downloadMutation.isPending, verifyMutation.isPending, restoreMutation.isPending, copyChecksum, handleDownload, handleVerify],
	);

	const mobileCardRender = useCallback(
		(entry: BackupEntry): React.ReactNode => (
			<div className="rounded-lg border bg-card p-3">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<p className="truncate font-medium">{entry.name}</p>
						<p className="truncate text-xs text-muted-foreground">
							{entry.sizeBytes === null ? "—" : formatBytes(entry.sizeBytes)} · {formatDateTime(entry.createdAt)}
						</p>
					</div>
					<StatusBadge status={entry.status} />
				</div>
				{entry.error !== null && entry.status === "failed" ? <p className="mt-1.5 line-clamp-2 text-xs text-destructive">{entry.error}</p> : null}
				<div className="mt-2.5 flex items-center justify-between">
					<span className="text-xs text-muted-foreground">Retained until {entry.expiresAt === null ? "—" : formatDateTime(entry.expiresAt)}</span>{" "}
					<div className="flex flex-wrap items-center gap-1.5">
						<Button
							variant="outline"
							size="sm"
							disabled={entry.status !== "completed"}
							onClick={(): void => {
								void handleVerify(entry);
							}}
							className="gap-1">
							<ShieldCheck className="size-3.5" />
							Verify
						</Button>{" "}
						<Button
							variant="outline"
							size="sm"
							disabled={entry.status !== "completed"}
							onClick={(): void => {
								setRestoreName("");
								setRestorePassword("");
								setRestoreTarget(entry);
							}}
							className="gap-1">
							<DatabaseZap className="size-3.5" />
							Restore
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={entry.status !== "completed"}
							onClick={(): void => {
								void handleDownload(entry);
							}}
							className="gap-1">
							<Download className="size-3.5" />
							Download
						</Button>
						<Button
							variant="ghost"
							size="icon"
							aria-label={`Delete backup ${entry.name}`}
							disabled={entry.status === "pending" || entry.status === "processing"}
							onClick={(): void => {
								setDeleteTarget(entry);
							}}>
							<Trash2 className="size-4 text-destructive" />
						</Button>
					</div>
				</div>
			</div>
		),
		[handleDownload, handleVerify],
	);

	if (listQuery.isLoading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<div className="flex flex-col items-center gap-3 text-muted-foreground">
					<Loader2 className="size-6 animate-spin" />
					<p className="text-sm">Loading backups…</p>
				</div>
			</div>
		);
	}

	if (listQuery.error) {
		return (
			<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
				Failed to load backups — check that the API is running and you&apos;re signed in.
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-7xl space-y-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">Database Backup</h1>
					<p className="mt-1 max-w-xl text-sm text-muted-foreground">
						Snapshot the entire database with <code className="rounded bg-muted px-1 py-0.5 text-xs">pg_dump</code> → gzip. Backups run one at a time, are checksummed
						(SHA-256), and are pruned automatically after the retention window ({listQuery.data?.data.retentionDays ?? 7} days).
					</p>
				</div>
				<div className="flex items-center gap-2">
					{activeBackup !== undefined ? (
						<Badge variant="secondary" className="gap-1">
							<Loader2 className="size-3 animate-spin" />
							Job in progress
						</Badge>
					) : null}
					<Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
						<RefreshCw className="size-3.5" />
						Refresh
					</Button>
				</div>
			</header>

			{/* ── Active job progress ─────────────────────────────────────── */}
			{activeBackup !== undefined ? (
				<Card>
					<CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
						<div className="min-w-0">
							<CardTitle className="flex items-center gap-2 text-base">
								<DatabaseBackup className="size-4 shrink-0 text-primary" />
								<span className="truncate">{activeBackup.name}</span>
							</CardTitle>
							<CardDescription>
								{STAGE_LABELS[activeBackup.stage] ?? "Working…"}
								{activeBackup.position !== null && activeBackup.position > 0 ? ` · queue position ${String(activeBackup.position)}` : ""} — refreshes every 2s.
							</CardDescription>
						</div>
						<Button
							variant="outline"
							size="sm"
							className="gap-1"
							disabled={cancelMutation.isPending}
							onClick={(): void => {
								void handleCancel(activeBackup);
							}}>
							{cancelMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CircleStop className="size-3.5" />}
							Cancel
						</Button>
					</CardHeader>
					<CardContent className="space-y-2">
						<Progress value={easedProgress}>
							<ProgressLabel>{activeBackup.stage}</ProgressLabel>
							<ProgressValue>{(formattedValue: string | null): React.ReactNode => formattedValue ?? `${String(Math.round(easedProgress))}%`}</ProgressValue>
						</Progress>
					</CardContent>
				</Card>
			) : null}

			{/* ── Create form ────────────────────────────────────────────── */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Create a backup</CardTitle>
					<CardDescription>One job at a time — the form locks while a backup is running.</CardDescription>
				</CardHeader>
				<CardContent>
					{" "}
					<form
						onSubmit={(event): void => {
							void handleCreate(event);
						}}
						className="space-y-5">
						<div className="grid gap-5 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="backup-name">Name (optional)</Label>
								<Input
									id="backup-name"
									value={backupName}
									onChange={(event): void => {
										setBackupName(event.target.value);
									}}
									placeholder="e.g. before_billing_migration"
									disabled={formDisabled}
									autoComplete="off"
									maxLength={50}
								/>
								<p className="text-xs text-muted-foreground">Letters, numbers, underscore and hyphen only — auto-generated when left blank.</p>
							</div>
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label htmlFor="compress-level">Compression level</Label>
									<span className="font-mono text-sm text-muted-foreground tabular-nums">{compressLevel} / 9</span>
								</div>
								<Slider
									id="compress-level"
									min={1}
									max={9}
									step={1}
									value={[compressLevel]}
									onValueChange={(value: number | readonly number[]): void => {
										setCompressLevel(typeof value === "number" ? value : (value[0] ?? 6));
									}}
									disabled={formDisabled}
								/>
								<p className="text-xs text-muted-foreground">Lower = faster but bigger files; higher = slower but smaller.</p>
							</div>
						</div>

						<div className="flex flex-wrap items-center justify-between gap-2">
							<label className="flex cursor-pointer items-center gap-2">
								<Checkbox
									id="schema-only"
									checked={schemaOnly}
									disabled={formDisabled}
									onCheckedChange={(checked: boolean): void => {
										setSchemaOnly(checked);
									}}
								/>
								<span className="text-sm">Schema only</span>
							</label>
							<p className="text-xs text-muted-foreground">Structure without data — a much smaller, faster dump for migrations and schema review.</p>
						</div>

						{rateLimit !== null ? (
							<div className="flex flex-wrap items-center justify-between gap-2">
								<QuotaChip limit={rateLimit.limit} used={rateLimit.used} resetsAt={rateLimit.resetsAt} />
								<p className="text-xs text-muted-foreground">The hourly cap keeps one admin from flooding the single-job queue.</p>
							</div>
						) : null}

						{/* DB size estimation + large DB warning */}
						{optionsQuery.data !== undefined && optionsQuery.data.data.dbSizeBytes !== null ? (
							<div className="rounded-md border border-border bg-muted/30 p-3">
								<div className="flex flex-wrap items-center gap-3">
									<div className="flex items-center gap-1.5 text-sm">
										<HardDrive className="size-4 text-muted-foreground" />
										<span className="font-medium">Database size:</span>
										<span className="tabular-nums">{formatBytes(optionsQuery.data.data.dbSizeBytes)}</span>
									</div>
									<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
										<Timer className="size-3.5" />
										<span>Estimated backup time: {estimateBackupTime(optionsQuery.data.data.dbSizeBytes)}</span>
									</div>
									<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
										<Zap className="size-3.5" />
										<span>Suggested compression: level {optionsQuery.data.data.suggestedCompressLevel}</span>
									</div>
								</div>
								{optionsQuery.data.data.dbSizeBytes > LARGE_DB_THRESHOLD_BYTES ? (
									<div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400">
										<TriangleAlert className="mt-0.5 size-4 shrink-0" />
										<div>
											<p className="font-medium">Large database detected ({formatBytes(optionsQuery.data.data.dbSizeBytes)})</p>
											<p className="mt-0.5">
												This backup may take {estimateBackupTime(optionsQuery.data.data.dbSizeBytes)}. Ensure you have sufficient disk space (at least 2x the database size).
												Consider using schema-only mode or excluding large tables.
											</p>
										</div>
									</div>
								) : null}
							</div>
						) : null}

						{optionsQuery.data !== undefined ? (
							<div className="space-y-2">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div>
										<Label>Exclude table rows (schema is always kept)</Label>
										<p className="text-xs text-muted-foreground">
											Excluded tables still restore with their structure — only their rows are skipped. Useful for high-volume observability tables.
										</p>
									</div>
									<div className="flex flex-wrap items-center gap-2">
										<span className="text-xs text-muted-foreground tabular-nums">
											{excluded.length} / {optionsQuery.data.data.tables.length} excluded
										</span>
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={formDisabled}
											onClick={(): void => {
												setExcluded(optionsQuery.data.data.tables.map((table) => table.name));
											}}
											className="gap-1">
											<CheckSquare className="size-3.5" />
											Select all
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={formDisabled || excluded.length === 0}
											onClick={(): void => {
												setExcluded([]);
											}}
											className="gap-1">
											<SquareDashedMousePointer className="size-3.5" />
											Clear
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={formDisabled || isDefaultSelection}
											onClick={(): void => {
												setExcluded(optionsQuery.data.data.defaultExcluded);
											}}
											className="gap-1">
											<Settings2 className="size-3.5" />
											Restore defaults
										</Button>
									</div>
								</div>
								{optionsQuery.data.data.tables.length > 0 ? (
									<div className="grid max-h-52 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
										{optionsQuery.data.data.tables.map((table) => {
											const isExcluded = excluded.includes(table.name);
											return (
												<label key={table.name} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/60">
													<Checkbox
														checked={isExcluded}
														disabled={formDisabled}
														onCheckedChange={(checked: boolean): void => {
															setExcluded((current) => (checked ? [...current, table.name] : current.filter((name) => name !== table.name)));
														}}
													/>
													<span className="min-w-0 truncate font-mono text-xs">{table.name}</span>
													{table.excludedByDefault && !isExcluded ? <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">default</span> : null}
												</label>
											);
										})}
									</div>
								) : null}
							</div>
						) : null}

						<div className="flex flex-wrap items-center justify-end gap-2">
							{lastCompleted !== undefined && lastCompleted.sizeBytes !== null ? (
								<span className="mr-auto text-xs text-muted-foreground">
									Last backup: {formatBytes(lastCompleted.sizeBytes)} · {formatDateTime(lastCompleted.createdAt)} — expect a comparable dump size.
								</span>
							) : null}
							{activeBackup !== undefined ? (
								<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
									<Loader2 className="size-3 animate-spin" />
									Waiting for the running job…
								</span>
							) : null}
							<Button type="submit" disabled={formDisabled} className="gap-1.5">
								{createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <DatabaseBackup className="size-4" />}
								Start backup
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>

			{/* ── History ────────────────────────────────────────────────── */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Backup history</CardTitle>
					<CardDescription>{rows.length} backups · downloads are gated by a signed 15-minute token · files are pruned at the retention deadline.</CardDescription>
				</CardHeader>
				<CardContent>
					{rows.length === 0 ? (
						<div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-muted-foreground">
							<DatabaseBackup className="size-8" />
							<p className="text-sm">No backups yet — create your first one above.</p>
						</div>
					) : (
						<DataTable
							data={rows}
							columns={columns}
							searchKeys={["name", "status", "requestedByName"]}
							pageSize={10}
							pageSizeOptions={[10, 25, 50]}
							exportable
							exportFilename="backup-history"
							enableColumnVisibility
							mobileCardRender={mobileCardRender}
						/>
					)}
				</CardContent>
			</Card>

			{/* ── Scheduled backups ───────────────────────────────────────── */}
			{listQuery.data?.data.schedules !== undefined && listQuery.data.data.schedules.length > 0 ? (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">Scheduled backups</CardTitle>
						<CardDescription>Automated backups that run on a cron schedule. These run as system jobs with superadmin privileges.</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{listQuery.data.data.schedules.map((schedule) => (
								<div key={schedule.id} className="flex items-center justify-between rounded-md border border-border p-3">
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
									<Button
										variant="outline"
										size="sm"
										disabled={createMutation.isPending}
										onClick={(): void => {
											void (async (): Promise<void> => {
												try {
													await fetch(`/api/backup/schedules/${schedule.id}/toggle`, {
														method: "POST",
														headers: { "Content-Type": "application/json" },
														body: JSON.stringify({ enabled: !schedule.enabled }),
													});
													toastMessage.success({
														title: schedule.enabled ? "Schedule disabled" : "Schedule enabled",
														description: `${schedule.name} has been ${schedule.enabled ? "disabled" : "enabled"}.`,
													});
													await invalidateList();
												} catch (error) {
													toastMessage.error({ title: "Toggle failed", description: error instanceof Error ? error.message : "Unknown error" });
												}
											})();
										}}>
										{schedule.enabled ? "Disable" : "Enable"}
									</Button>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			) : null}

			{/* ── Delete confirmation ────────────────────────────────────── */}
			<AlertDialog
				open={deleteTarget !== null}
				onOpenChange={(open: boolean): void => {
					setDeleteTarget(open ? deleteTarget : null);
				}}>
				<AlertDialogContent
					severity="critical"
					confirmLabel="Delete backup"
					confirmLoading={removeMutation.isPending}
					loadingLabel="Deleting…"
					onConfirm={(): void => {
						void handleDelete();
					}}>
					<AlertDialogHeader align="start">
						<AlertDialogMedia severity="critical">
							<TriangleAlert className="size-6" />
						</AlertDialogMedia>
						<AlertDialogTitle>Delete this backup?</AlertDialogTitle>
						<AlertDialogDescription>"{deleteTarget?.name}" and its compressed file will be permanently removed. This cannot be undone.</AlertDialogDescription>
					</AlertDialogHeader>
				</AlertDialogContent>
			</AlertDialog>

			{/* ── Restore confirmation ────────────────────────────────────── */}
			<AlertDialog
				open={restoreTarget !== null}
				onOpenChange={(open: boolean): void => {
					setRestoreTarget(open ? restoreTarget : null);
				}}>
				<AlertDialogContent
					severity="info"
					confirmLabel="Restore backup"
					confirmLoading={restoreMutation.isPending}
					loadingLabel="Restoring…"
					onConfirm={(): void => {
						void handleRestoreConfirm();
					}}>
					<AlertDialogHeader align="start">
						<AlertDialogMedia severity="info">
							<DatabaseZap className="size-6" />
						</AlertDialogMedia>
						<AlertDialogTitle>Restore this backup?</AlertDialogTitle>
						<AlertDialogDescription>
							"{restoreTarget?.name}" will be restored into a brand-new database. No existing database is ever touched or overwritten. The new database is left in place so you
							can inspect it — dropping it later is a manual <code className="rounded bg-muted px-1 py-0.5 text-xs">DROP DATABASE</code>.
						</AlertDialogDescription>
						<div className="space-y-2">
							<Label htmlFor="restore-name">Target database name (optional)</Label>
							<Input
								id="restore-name"
								value={restoreName}
								onChange={(event): void => {
									setRestoreName(event.target.value);
								}}
								placeholder={`restored_${restoreTarget?.name ?? "backup"}_20260818_120000`}
								disabled={restoreMutation.isPending}
								autoComplete="off"
								maxLength={63}
							/>
							<p className="text-xs text-muted-foreground">Letters, numbers and underscore only — auto-generated when left blank.</p>
						</div>
						<div className="space-y-2">
							<Label htmlFor="restore-password">Confirm your password</Label>
							<Input
								id="restore-password"
								type="password"
								value={restorePassword}
								onChange={(event): void => {
									setRestorePassword(event.target.value);
								}}
								placeholder="Re-enter your password to restore"
								disabled={restoreMutation.isPending}
								autoComplete="current-password"
							/>
							<p className="text-xs text-muted-foreground">Restore creates a real database, so we re-verify your credentials first.</p>
						</div>
					</AlertDialogHeader>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
