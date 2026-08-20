"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import type { BackupEntry, BackupSchedule, BackupListResponse, BackupOptionsResponse, Envelope } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ERROR_CODE_COPY, formatBytes, triggerDownload } from "./backup-copy";

/**
 * All state + callbacks for the Backup panel.
 * Extracted from backup-panel.tsx to keep the component a pure rendering shell.
 */
export function useBackupPanel(initialList: Envelope<BackupListResponse>, initialOptions: Envelope<BackupOptionsResponse>) {
	const { api } = useAuth();
	const queryClient = useQueryClient();

	const listQuery = api.backup.list.useQuery(undefined, {
		initialData: initialList,
		refetchInterval: (query): number | false => {
			const payload = query.state.data;
			const active: boolean =
				payload?.data.active === true || (payload?.data.backups.some((entry: BackupEntry): boolean => entry.status === "pending" || entry.status === "processing") ?? false);
			return active ? 2000 : false;
		},
	});
	const optionsQuery = api.backup.options.useQuery(undefined, { initialData: initialOptions });

	const createMutation = api.backup.create.useMutation();
	const downloadMutation = api.backup.download.useMutation();
	const removeMutation = api.backup.remove.useMutation();
	const verifyMutation = api.backup.verify.useMutation();
	const restoreMutation = api.backup.restore.useMutation();
	const cancelMutation = api.backup.cancel.useMutation();
	const toggleScheduleMutation = api.backup.toggleSchedule.useMutation();

	const [backupName, setBackupName] = useState<string>("");
	const [compressLevel, setCompressLevel] = useState<number>(6);
	const [excluded, setExcluded] = useState<readonly string[]>([]);
	const [schemaOnly, setSchemaOnly] = useState<boolean>(false);
	const [deleteTargets, setDeleteTargets] = useState<readonly BackupEntry[] | null>(null);
	const [restoreTarget, setRestoreTarget] = useState<BackupEntry | null>(null);
	const [restoreName, setRestoreName] = useState<string>("");
	const [restorePassword, setRestorePassword] = useState<string>("");
	const excludedSeeded = useRef<boolean>(false);

	useEffect(() => {
		if (!excludedSeeded.current && optionsQuery.data !== undefined) {
			excludedSeeded.current = true;
			setExcluded(optionsQuery.data.data.defaultExcluded);
		}
	}, [optionsQuery.data]);

	const rows = useMemo<BackupEntry[]>(() => listQuery.data?.data.backups ?? [], [listQuery.data]);
	const activeBackup = useMemo<BackupEntry | undefined>(() => rows.find((entry: BackupEntry): boolean => entry.status === "pending" || entry.status === "processing"), [rows]);

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

	const easedProgress = useMemo(() => {
		// Simple easing: progress jumps quickly at start, slows near end
		const raw = activeBackup?.progress ?? 0;
		return raw < 50 ? raw * 0.8 : raw * 0.8 + (raw - 50) * 0.4;
	}, [activeBackup?.progress]);

	const lastCompleted = useMemo<BackupEntry | undefined>(() => rows.find((entry: BackupEntry): boolean => entry.status === "completed"), [rows]);
	const rateLimit = listQuery.data?.data.rateLimit ?? null;
	const quotaExhausted: boolean = rateLimit !== null && rateLimit.used >= rateLimit.limit;
	const formDisabled: boolean = createMutation.isPending || activeBackup !== undefined || quotaExhausted;

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
		(schedule: BackupSchedule): void => {
			void (async (): Promise<void> => {
				try {
					await toggleScheduleMutation.mutateAsync({ id: schedule.id, enabled: !schedule.enabled });
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
		[invalidateList, toggleScheduleMutation],
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

	return {
		// Data
		listQuery,
		optionsQuery,
		rows,
		activeBackup,
		lastCompleted,
		rateLimit,
		easedProgress,
		quotaExhausted,
		formDisabled,
		isDefaultSelection,

		// Mutations
		createMutation,
		removeMutation,
		restoreMutation,
		cancelMutation,

		// Form state
		backupName,
		compressLevel,
		schemaOnly,
		excluded,
		deleteTargets,
		restoreTarget,
		restoreName,
		restorePassword,

		// Handlers
		handleRefresh,
		handleFormSubmit,
		handleBackupNameChange,
		handleCompressChange,
		handleSchemaOnlyChange,
		handleSelectAllTables,
		handleClearExcluded,
		handleRestoreDefaults,
		handleExcludeTableToggle,
		handleDownloadClick,
		handleVerifyClick,
		handleRestoreOpen,
		handleDeleteOpen,
		handleCopyChecksumAction,
		handleBulkDownload,
		handleBulkDelete,
		handleCancelActive,
		handleToggleSchedule,
		handleDeleteDialogOpenChange,
		handleRestoreDialogOpenChange,
		handleDeleteConfirm,
		handleRestoreConfirmClick,
		handleRestoreNameChange,
		handleRestorePasswordChange,
		copyChecksum,
	};
}
