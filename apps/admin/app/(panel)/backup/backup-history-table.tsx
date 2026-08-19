"use client";

import type { BackupEntry } from "@workspace/shared";
import { formatDateTime, timeAgo } from "@/lib/dates";
import { DataTable, type Action, type BulkAction, type DataTableFeatures, type DataTableLabels, type Filter } from "@workspace/ui/components/display/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Copy, DatabaseBackup, DatabaseZap, Download, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";

import { BackupStatusBadge } from "./backup-status-badge";
import { ERROR_CODE_COPY, formatBytes, KIND_FILTER_OPTIONS, STATUS_FILTER_OPTIONS } from "./backup-copy";

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

export function BackupHistoryTable({
	rows,
	onDownload,
	onVerify,
	onRestore,
	onCopyChecksum,
	onCopyChecksumAction,
	onDelete,
	onBulkDownload,
	onBulkDelete,
}: {
	readonly rows: BackupEntry[];
	readonly onDownload: (entry: BackupEntry) => void;
	readonly onVerify: (entry: BackupEntry) => void;
	readonly onRestore: (entry: BackupEntry) => void;
	readonly onCopyChecksum: (checksum: string) => void;
	readonly onCopyChecksumAction: (entry: BackupEntry) => void;
	readonly onDelete: (entry: BackupEntry) => void;
	readonly onBulkDownload: (selected: BackupEntry[]) => void;
	readonly onBulkDelete: (selected: BackupEntry[]) => void;
}): React.JSX.Element {
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
				onClick: onDownload,
			},
			{
				key: "verify",
				label: "Verify",
				description: "Restore into a scratch database",
				icon: <ShieldCheck className="size-4" />,
				onClick: onVerify,
			},
			{
				key: "restore",
				label: "Restore",
				description: "Restore into a new database",
				icon: <DatabaseZap className="size-4" />,
				onClick: onRestore,
			},
			{
				key: "copy-checksum",
				label: "Copy checksum",
				description: "Copy the SHA-256 digest",
				icon: <Copy className="size-4" />,
				onClick: onCopyChecksumAction,
			},
			{
				key: "delete",
				label: "Delete",
				description: "Remove the file and history row",
				icon: <Trash2 className="size-4" />,
				onClick: onDelete,
				isDestructive: true,
				iconBgColor: "bg-red-100 dark:bg-red-900/40",
			},
		],
		[onDownload, onVerify, onRestore, onCopyChecksumAction, onDelete],
	);

	const bulkActions = useMemo<BulkAction<BackupEntry>[]>(
		() => [
			{
				key: "download",
				label: "Download selected",
				icon: <Download className="size-4" />,
				onClick: onBulkDownload,
			},
			{
				key: "delete",
				label: "Delete selected",
				icon: <Trash2 className="size-4" />,
				onClick: onBulkDelete,
				variant: "destructive",
			},
		],
		[onBulkDownload, onBulkDelete],
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
						<BackupStatusBadge status={row.original.status} />
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
					return <ChecksumCopyButton checksum={checksum} onCopy={onCopyChecksum} />;
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
		[onCopyChecksum],
	);

	const mobileCardRender = useCallback(
		(entry: BackupEntry): React.ReactNode => (
			<div className="rounded-lg border bg-card p-3">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<p className="truncate font-medium">{entry.name}</p>
						<p className="text-xs text-muted-foreground">{entry.requestedByName ?? "Admin"}</p>
					</div>
					<BackupStatusBadge status={entry.status} />
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

	const emptyIcon = useMemo(() => <DatabaseBackup className="size-6" />, []);

	const dataTableLabels = useMemo(
		(): DataTableLabels => ({
			actionsMenuTitle: "Backup actions",
			openRowMenu: "Open backup row menu",
		}),
		[],
	);

	return (
		<DataTable
			data={rows}
			columns={columns}
			title="Backup history"
			description={`${String(rows.length)} backups · downloads are gated by a signed 15-minute token · files are pruned at the retention deadline.`}
			searchKeys={["name", "status", "requestedByName"]}
			filters={filters}
			actions={actions}
			labels={dataTableLabels}
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
				icon: emptyIcon,
				title: "No backups found",
				description: "Create your first backup above, or try adjusting your search or filters.",
			}}
		/>
	);
}
