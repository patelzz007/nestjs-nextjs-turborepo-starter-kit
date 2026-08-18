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
import { DataTable, type Action, type BulkAction, type DataTableFeatures, type Filter } from "@workspace/ui/components/display/data-table";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { Progress, ProgressLabel, ProgressValue } from "@workspace/ui/components/feedback/progress";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from "@workspace/ui/components/overlay/alert-dialog";
import type { ColumnDef } from "@tanstack/react-table";
import {
	CheckSquare,
	CircleCheck,
	CircleDashed,
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

const STATUS_FILTER_OPTIONS: readonly { value: string; label: string }[] = [
	{ value: "pending", label: "Queued" },
	{ value: "processing", label: "Processing" },
	{ value: "completed", label: "Completed" },
	{ value: "failed", label: "Failed" },
];

const KIND_FILTER_OPTIONS: readonly { value: string; label: string }[] = [
	{ value: "false", label: "Full dump" },
	{ value: "true", label: "Schema only" },
];

const STAGE_LABELS: Readonly<Record<string, string>> = {
	queued: "Waiting for the dump to start…",
	dumping: "Dumping the database…",
	compressing: "Compressing the dump…",
	finalizing: "Verifying checksum…",
	done: "Complete",
	failed: "Failed",
};

function StatusBadge({ status }: { readonly status: BackupStatus }): React.JSX.Element {
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

/** Copies a SHA-256 checksum — extracted so `onClick` is a memoized callback, not an inline arrow. */
function ChecksumCopyButton({ checksum, onCopy }: { readonly checksum: string; readonly onCopy: (checksum: string) => void }): React.JSX.Element {
	const handleCopy = useCallback((): void => {
		onCopy(checksum);
	}, [checksum, onCopy]);
	return (
		<button
			type="button"
			onClick={handleCopy}
			className="inline-flex max-w-36 items-center gap-1 rounded-md border border-transparent px-1.5 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:border-border hover:text-foreground"
			title="Copy SHA-256 checksum">
			<Copy className="size-3 shrink-0" />
			<span className="truncate">{checksum.slice(0, 10)}…</span>
		</button>
	);
}

function ExcludeTableCheckbox({
	table,
	isExcluded,
	disabled,
	onToggle,
}: {
	readonly table: { readonly name: string; readonly excludedByDefault: boolean };
	readonly isExcluded: boolean;
	readonly disabled: boolean;
	readonly onToggle: (name: string, checked: boolean) => void;
}): React.JSX.Element {
	const handleCheckedChange = useCallback(
		(checked: boolean): void => {
			onToggle(table.name, checked);
		},
		[onToggle, table.name],
	);
	return (
		<label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/60">
			<Checkbox checked={isExcluded} disabled={disabled} onCheckedChange={handleCheckedChange} />
			<span className="min-w-0 truncate font-mono text-xs">{table.name}</span>
			{table.excludedByDefault && !isExcluded ? <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">default</span> : null}
		</label>
	);
}

interface BackupScheduleRow {
	readonly id: string;
	readonly cron: string;
	readonly name: string;
	readonly enabled: boolean;
	readonly nextRun: number;
}

function ScheduleRow({
	schedule,
	disabled,
	onToggle,
}: {
	readonly schedule: BackupScheduleRow;
	readonly disabled: boolean;
	readonly onToggle: (schedule: BackupScheduleRow) => void;
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

function ActiveJobCancelButton({ pending, onCancel }: { readonly pending: boolean; readonly onCancel: () => void }): React.JSX.Element {
	return (
		<Button variant="outline" size="sm" className="gap-1" disabled={pending} onClick={onCancel}>
			{pending ? <Loader2 className="size-3.5 animate-spin" /> : <CircleStop className="size-3.5" />}
			Cancel
		</Button>
	);
}

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
	const [deleteTargets, setDeleteTargets] = useState<readonly BackupEntry[] | null>(null);
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
		if (deleteTargets === null || deleteTargets.length === 0) return;
		try {
			for (const target of deleteTargets) {
				await removeMutation.mutateAsync({ id: target.id });
			}
			const count: number = deleteTargets.length;
			toastMessage.success({
				title: count === 1 ? "Backup deleted" : `${String(count)} backups deleted`,
				description: count === 1 ? `"${deleteTargets[0]?.name ?? ""}" and its file were removed.` : "The selected files and rows were removed.",
			});
			setDeleteTargets(null);
			await invalidateList();
		} catch (error) {
			toastMessage.error({ title: "Delete failed", description: error instanceof Error ? error.message : "Unknown error" });
		}
	}, [deleteTargets, removeMutation, invalidateList]);

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

	const handleFormSubmit = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			void handleCreate(event);
		},
		[handleCreate],
	);

	const handleBackupNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setBackupName(event.target.value);
	}, []);

	const handleCompressChange = useCallback((value: number | readonly number[]): void => {
		setCompressLevel(typeof value === "number" ? value : (value[0] ?? 6));
	}, []);

	const handleSchemaOnlyChange = useCallback((checked: boolean): void => {
		setSchemaOnly(checked);
	}, []);

	const handleSelectAllTables = useCallback((): void => {
		const tables = optionsQuery.data?.data.tables;
		if (tables === undefined) return;
		setExcluded(tables.map((table): string => table.name));
	}, [optionsQuery.data]);

	const handleClearExcluded = useCallback((): void => {
		setExcluded([]);
	}, []);

	const handleRestoreDefaults = useCallback((): void => {
		const defaults = optionsQuery.data?.data.defaultExcluded;
		if (defaults === undefined) return;
		setExcluded(defaults);
	}, [optionsQuery.data]);

	const handleExcludeTableToggle = useCallback((name: string, checked: boolean): void => {
		setExcluded((current) => (checked ? [...current, name] : current.filter((tableName) => tableName !== name)));
	}, []);

	const handleRestoreOpen = useCallback((entry: BackupEntry): void => {
		if (entry.status !== "completed") {
			toastMessage.error({ title: "Restore unavailable", description: "Only completed backups can be restored." });
			return;
		}
		setRestoreName("");
		setRestorePassword("");
		setRestoreTarget(entry);
	}, []);

	const handleDeleteOpen = useCallback((entry: BackupEntry): void => {
		if (entry.status === "pending" || entry.status === "processing") {
			toastMessage.error({ title: "Delete unavailable", description: "Queued or running backups cannot be deleted — cancel them first." });
			return;
		}
		setDeleteTargets([entry]);
	}, []);

	const handleVerifyClick = useCallback(
		(entry: BackupEntry): void => {
			if (entry.status !== "completed") {
				toastMessage.error({ title: "Verify unavailable", description: "Only completed backups can be verified." });
				return;
			}
			void handleVerify(entry);
		},
		[handleVerify],
	);

	const handleDownloadClick = useCallback(
		(entry: BackupEntry): void => {
			if (entry.status !== "completed") {
				toastMessage.error({ title: "Download unavailable", description: "Only completed backups can be downloaded." });
				return;
			}
			void handleDownload(entry);
		},
		[handleDownload],
	);

	const handleCopyChecksumAction = useCallback(
		(entry: BackupEntry): void => {
			if (entry.checksum === null) {
				toastMessage.error({ title: "Checksum unavailable", description: "The dump has not finished yet." });
				return;
			}
			copyChecksum(entry.checksum);
		},
		[copyChecksum],
	);

	const handleBulkDownload = useCallback(
		(selected: BackupEntry[]): void => {
			const completed: BackupEntry[] = selected.filter((entry: BackupEntry): boolean => entry.status === "completed");
			if (completed.length === 0) {
				toastMessage.error({ title: "Nothing to download", description: "Select at least one completed backup." });
				return;
			}
			void (async (): Promise<void> => {
				for (const entry of completed) {
					await handleDownload(entry);
				}
			})();
		},
		[handleDownload],
	);

	const handleBulkDelete = useCallback((selected: BackupEntry[]): void => {
		const removable: BackupEntry[] = selected.filter((entry: BackupEntry): boolean => entry.status !== "pending" && entry.status !== "processing");
		if (removable.length === 0) {
			toastMessage.error({ title: "Nothing to delete", description: "Queued or running backups cannot be deleted — cancel them first." });
			return;
		}
		setDeleteTargets(removable);
	}, []);

	const handleCancelActive = useCallback((): void => {
		if (activeBackup === undefined) return;
		void handleCancel(activeBackup);
	}, [activeBackup, handleCancel]);

	const handleToggleSchedule = useCallback(
		(schedule: BackupScheduleRow): void => {
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
		},
		[invalidateList],
	);

	const handleDeleteDialogOpenChange = useCallback((open: boolean): void => {
		if (!open) setDeleteTargets(null);
	}, []);

	const handleRestoreDialogOpenChange = useCallback((open: boolean): void => {
		if (!open) setRestoreTarget(null);
	}, []);

	const handleDeleteConfirm = useCallback((): void => {
		void handleDelete();
	}, [handleDelete]);

	const handleRestoreConfirmClick = useCallback((): void => {
		void handleRestoreConfirm();
	}, [handleRestoreConfirm]);

	const handleRestoreNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setRestoreName(event.target.value);
	}, []);

	const handleRestorePasswordChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setRestorePassword(event.target.value);
	}, []);

	const filters = useMemo<Filter[]>(
		() => [
			{ key: "status", label: "Status", options: STATUS_FILTER_OPTIONS },
			{ key: "schemaOnly", label: "Type", options: KIND_FILTER_OPTIONS },
		],
		[],
	);

	const actions = useMemo<Action<BackupEntry>[]>(
		() => [
			{
				key: "download",
				label: "Download",
				description: "Save the compressed dump",
				icon: <Download className="size-4" />,
				onClick: handleDownloadClick,
			},
			{
				key: "verify",
				label: "Verify",
				description: "Restore into a scratch database",
				icon: <ShieldCheck className="size-4" />,
				onClick: handleVerifyClick,
			},
			{
				key: "restore",
				label: "Restore",
				description: "Restore into a new database",
				icon: <DatabaseZap className="size-4" />,
				onClick: handleRestoreOpen,
			},
			{
				key: "copy-checksum",
				label: "Copy checksum",
				description: "Copy the SHA-256 digest",
				icon: <Copy className="size-4" />,
				onClick: handleCopyChecksumAction,
			},
			{
				key: "delete",
				label: "Delete",
				description: "Remove the file and history row",
				icon: <Trash2 className="size-4" />,
				onClick: handleDeleteOpen,
				isDestructive: true,
				iconBgColor: "bg-red-100 dark:bg-red-900/40",
			},
		],
		[handleDownloadClick, handleVerifyClick, handleRestoreOpen, handleCopyChecksumAction, handleDeleteOpen],
	);

	const bulkActions = useMemo<BulkAction<BackupEntry>[]>(
		() => [
			{
				key: "download",
				label: "Download selected",
				icon: <Download className="size-4" />,
				onClick: handleBulkDownload,
			},
			{
				key: "delete",
				label: "Delete selected",
				icon: <Trash2 className="size-4" />,
				onClick: handleBulkDelete,
				variant: "destructive",
			},
		],
		[handleBulkDownload, handleBulkDelete],
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, BackupEntry>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Backup",
				enableHiding: false,
				cell: ({ row }): React.JSX.Element => (
					<div className="min-w-0">
						<span className="font-medium">{row.original.name}</span>
						{row.original.verifiedAt !== null ? (
							<p className="truncate text-xs text-emerald-600 dark:text-emerald-400">
								Verified {row.original.verifiedTableCount ?? 0} tables · {formatDateTime(row.original.verifiedAt)}
							</p>
						) : null}
						{row.original.restoredAt !== null ? <p className="truncate text-xs text-sky-600 dark:text-sky-400">Restored to {row.original.restoredDatabase}</p> : null}
					</div>
				),
			},
			{
				accessorKey: "schemaOnly",
				header: "Type",
				cell: ({ row }): React.JSX.Element => <span className="text-muted-foreground">{row.original.schemaOnly ? "Schema only" : "Full dump"}</span>,
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
				cell: ({ row }): React.JSX.Element => <div className="tabular-nums">{row.original.sizeBytes === null ? "—" : formatBytes(row.original.sizeBytes)}</div>,
			},
			{
				accessorKey: "checksum",
				header: "Checksum",
				cell: ({ row }): React.JSX.Element => {
					const checksum: string | null = row.original.checksum;
					if (checksum === null) {
						return <span className="text-muted-foreground">—</span>;
					}
					return <ChecksumCopyButton checksum={checksum} onCopy={copyChecksum} />;
				},
			},
			{
				accessorKey: "requestedByName",
				header: "Requested by",
				cell: ({ row }): React.JSX.Element => <span className="text-muted-foreground">{row.original.requestedByName ?? "Admin"}</span>,
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
		],
		[copyChecksum],
	);

	const mobileCardRender = useCallback(
		(entry: BackupEntry): React.ReactNode => (
			<div className="rounded-lg border bg-card p-3">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<p className="truncate font-medium">{entry.name}</p>
						<p className="text-xs text-muted-foreground">{entry.requestedByName ?? "Admin"}</p>
					</div>
					<StatusBadge status={entry.status} />
				</div>
				<div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
					<span>{entry.schemaOnly ? "Schema only" : "Full dump"}</span>
					<span className="tabular-nums">
						{entry.sizeBytes === null ? "—" : formatBytes(entry.sizeBytes)} · {formatDateTime(entry.createdAt)}
					</span>
				</div>
			</div>
		),
		[],
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
						<ActiveJobCancelButton pending={cancelMutation.isPending} onCancel={handleCancelActive} />
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
					<form onSubmit={handleFormSubmit} className="space-y-5">
						<div className="grid gap-5 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="backup-name">Name (optional)</Label>
								<Input
									id="backup-name"
									value={backupName}
									onChange={handleBackupNameChange}
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
								<Slider id="compress-level" min={1} max={9} step={1} value={[compressLevel]} onValueChange={handleCompressChange} disabled={formDisabled} />
								<p className="text-xs text-muted-foreground">Lower = faster but bigger files; higher = slower but smaller.</p>
							</div>
						</div>

						<div className="flex flex-wrap items-center justify-between gap-2">
							<label className="flex cursor-pointer items-center gap-2">
								<Checkbox id="schema-only" checked={schemaOnly} disabled={formDisabled} onCheckedChange={handleSchemaOnlyChange} />
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
										<Button type="button" variant="outline" size="sm" disabled={formDisabled} onClick={handleSelectAllTables} className="gap-1">
											<CheckSquare className="size-3.5" />
											Select all
										</Button>
										<Button type="button" variant="outline" size="sm" disabled={formDisabled || excluded.length === 0} onClick={handleClearExcluded} className="gap-1">
											<SquareDashedMousePointer className="size-3.5" />
											Clear
										</Button>
										<Button type="button" variant="outline" size="sm" disabled={formDisabled || isDefaultSelection} onClick={handleRestoreDefaults} className="gap-1">
											<Settings2 className="size-3.5" />
											Restore defaults
										</Button>
									</div>
								</div>
								{optionsQuery.data.data.tables.length > 0 ? (
									<div className="grid max-h-52 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
										{optionsQuery.data.data.tables.map((table) => (
											<ExcludeTableCheckbox
												key={table.name}
												table={table}
												isExcluded={excluded.includes(table.name)}
												disabled={formDisabled}
												onToggle={handleExcludeTableToggle}
											/>
										))}
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
			<DataTable
				data={rows}
				columns={columns}
				title="Backup history"
				description={`${String(rows.length)} backups · downloads are gated by a signed 15-minute token · files are pruned at the retention deadline.`}
				searchKeys={["name", "status", "requestedByName"]}
				filters={filters}
				actions={actions}
				bulkActions={bulkActions}
				enableBulkSelection
				enableColumnVisibility
				enableColumnPinning
				exportable
				exportFilename="backup-history.csv"
				exportableColumns={["name", "schemaOnly", "status", "sizeBytes", "checksum", "requestedByName", "createdAt", "expiresAt"]}
				persistKey="backup-history"
				pageSize={10}
				pageSizeOptions={[10, 20, 50]}
				searchDebounceMs={200}
				sortCycle="asc-desc-none"
				mobileCardRender={mobileCardRender}
				emptyState={{
					icon: <DatabaseBackup className="size-6" />,
					title: "No backups found",
					description: "Create your first backup above, or try adjusting your search or filters.",
				}}
			/>

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
								<ScheduleRow key={schedule.id} schedule={schedule} disabled={createMutation.isPending} onToggle={handleToggleSchedule} />
							))}
						</div>
					</CardContent>
				</Card>
			) : null}

			{/* ── Delete confirmation ────────────────────────────────────── */}
			<AlertDialog open={deleteTargets !== null} onOpenChange={handleDeleteDialogOpenChange}>
				<AlertDialogContent
					severity="critical"
					confirmLabel={deleteTargets !== null && deleteTargets.length > 1 ? "Delete backups" : "Delete backup"}
					confirmLoading={removeMutation.isPending}
					loadingLabel="Deleting…"
					onConfirm={handleDeleteConfirm}>
					<AlertDialogHeader align="start">
						<AlertDialogMedia severity="critical">
							<TriangleAlert className="size-6" />
						</AlertDialogMedia>
						<AlertDialogTitle>
							{deleteTargets !== null && deleteTargets.length > 1 ? `Delete ${String(deleteTargets.length)} backups?` : "Delete this backup?"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{deleteTargets !== null && deleteTargets.length > 1
								? "The selected compressed files and history rows will be permanently removed. This cannot be undone."
								: `"${deleteTargets?.[0]?.name ?? ""}" and its compressed file will be permanently removed. This cannot be undone.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
				</AlertDialogContent>
			</AlertDialog>

			{/* ── Restore confirmation ────────────────────────────────────── */}
			<AlertDialog open={restoreTarget !== null} onOpenChange={handleRestoreDialogOpenChange}>
				<AlertDialogContent
					severity="info"
					confirmLabel="Restore backup"
					confirmLoading={restoreMutation.isPending}
					loadingLabel="Restoring…"
					onConfirm={handleRestoreConfirmClick}>
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
								onChange={handleRestoreNameChange}
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
								onChange={handleRestorePasswordChange}
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
