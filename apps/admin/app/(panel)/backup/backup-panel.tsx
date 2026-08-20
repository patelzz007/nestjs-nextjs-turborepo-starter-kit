"use client";

import type { BackupEntry, BackupListResponse, BackupOptionsResponse, Envelope } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Loader2, RefreshCw } from "lucide-react";

import { BackupActiveJobCard } from "./backup-active-job";
import { STAGE_LABELS } from "./backup-copy";
import { BackupCreateForm } from "./backup-create-form";
import { BackupDeleteDialog, BackupRestoreDialog } from "./backup-dialogs";
import { BackupHistoryTable } from "./backup-history-table";
import { BackupSchedulesCard } from "./backup-schedules";
import { useBackupPanel } from "./use-backup-panel";

/**
 * Database Backup — create pg_dump snapshots, watch them complete, and
 * download/delete them. All state lives in `useBackupPanel`; this component
 * is a pure rendering shell.
 */
interface BackupPanelProps {
	readonly initialList: Envelope<BackupListResponse>;
	readonly initialOptions: Envelope<BackupOptionsResponse>;
}

export default function BackupPanel({ initialList, initialOptions }: BackupPanelProps): React.JSX.Element {
	const panel = useBackupPanel(initialList, initialOptions);

	if (panel.listQuery.isLoading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<div className="flex flex-col items-center gap-3 text-muted-foreground">
					<Loader2 className="size-6 animate-spin" />
					<p className="text-sm">Loading backups…</p>
				</div>
			</div>
		);
	}

	if (panel.listQuery.error) {
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
						(SHA-256), and are pruned automatically after the retention window ({panel.listQuery.data?.data.retentionDays ?? 7} days).
					</p>
				</div>
				<div className="flex items-center gap-2">
					{panel.activeBackup !== undefined ? (
						<Badge variant="secondary" className="gap-1">
							<Loader2 className="size-3 animate-spin" />
							Job in progress
						</Badge>
					) : null}
					<Button variant="outline" size="sm" onClick={panel.handleRefresh} className="gap-1.5">
						<RefreshCw className="size-3.5" />
						Refresh
					</Button>
				</div>
			</header>

			{panel.activeBackup !== undefined ? (
				<BackupActiveJobCard
					entry={panel.activeBackup}
					stageLabel={STAGE_LABELS[panel.activeBackup.stage] ?? "Working…"}
					easedProgress={panel.easedProgress}
					cancelPending={panel.cancelMutation.isPending}
					onCancel={panel.handleCancelActive}
				/>
			) : null}

			<BackupCreateForm
				backupName={panel.backupName}
				compressLevel={panel.compressLevel}
				schemaOnly={panel.schemaOnly}
				excluded={panel.excluded}
				formDisabled={panel.formDisabled}
				createPending={panel.createMutation.isPending}
				isDefaultSelection={panel.isDefaultSelection}
				rateLimit={panel.rateLimit}
				options={panel.optionsQuery.data?.data}
				lastCompleted={panel.lastCompleted}
				activeBackup={panel.activeBackup}
				onSubmit={panel.handleFormSubmit}
				onBackupNameChange={panel.handleBackupNameChange}
				onCompressChange={panel.handleCompressChange}
				onSchemaOnlyChange={panel.handleSchemaOnlyChange}
				onSelectAllTables={panel.handleSelectAllTables}
				onClearExcluded={panel.handleClearExcluded}
				onRestoreDefaults={panel.handleRestoreDefaults}
				onExcludeTableToggle={panel.handleExcludeTableToggle}
			/>

			<BackupHistoryTable
				rows={panel.rows}
				onDownload={panel.handleDownloadClick}
				onVerify={panel.handleVerifyClick}
				onRestore={panel.handleRestoreOpen}
				onCopyChecksum={panel.copyChecksum}
				onCopyChecksumAction={panel.handleCopyChecksumAction}
				onDelete={panel.handleDeleteOpen}
				onBulkDownload={panel.handleBulkDownload}
				onBulkDelete={panel.handleBulkDelete}
			/>

			<BackupSchedulesCard schedules={panel.listQuery.data?.data.schedules ?? []} disabled={panel.createMutation.isPending} onToggle={panel.handleToggleSchedule} />

			<BackupDeleteDialog targets={panel.deleteTargets} pending={panel.removeMutation.isPending} onOpenChange={panel.handleDeleteDialogOpenChange} onConfirm={panel.handleDeleteConfirm} />

			<BackupRestoreDialog
				target={panel.restoreTarget}
				name={panel.restoreName}
				password={panel.restorePassword}
				pending={panel.restoreMutation.isPending}
				onOpenChange={panel.handleRestoreDialogOpenChange}
				onConfirm={panel.handleRestoreConfirmClick}
				onNameChange={panel.handleRestoreNameChange}
				onPasswordChange={panel.handleRestorePasswordChange}
			/>
		</div>
	);
}
