"use client";

// ============================================
// app/(panel)/telescope/mail/page.tsx
// Mail tab — the last 100 sends from the shared email log, surfaced inside
// Telescope so the observability console stays self-contained. The canonical,
// live-updating view remains `/email-log` (SSE); this is a read-only mirror.
// ============================================

import { Badge } from "@workspace/ui/components/feedback/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/overlay/dialog";
import type { ColumnDef } from "@tanstack/react-table";
import { ADMIN_DATA_TABLE_LABELS } from "@/lib/data-table-labels";
import { DataTable, type DataTableFeatures } from "@workspace/ui/components/display/data-table";
import { Mail, CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Input } from "@workspace/ui/components/form/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";

import type { EmailLogEntry, EmailLogStatus } from "@workspace/shared";

import { formatTime, timeAgo } from "@/lib/telescope";

const STATUS_META: Readonly<
	Record<EmailLogStatus, { readonly label: string; readonly variant: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"; readonly icon: React.ReactNode }>
> = {
	sent: { label: "Sent", variant: "secondary", icon: <Mail className="size-3" /> },
	delivered: { label: "Delivered", variant: "default", icon: <CircleCheck className="size-3" /> },
	bounced: { label: "Bounced", variant: "destructive", icon: <CircleX className="size-3" /> },
	complained: { label: "Complained", variant: "destructive", icon: <CircleX className="size-3" /> },
	failed: { label: "Failed", variant: "destructive", icon: <TriangleAlert className="size-3" /> },
};

function StatusBadge({ status }: { readonly status: EmailLogStatus }): React.JSX.Element {
	const meta = STATUS_META[status];
	return (
		<Badge variant={meta.variant} className="gap-1">
			{meta.icon}
			{meta.label}
		</Badge>
	);
}
interface TelescopeMailViewProps {
	readonly initialData: { readonly logs: readonly EmailLogEntry[] };
}

export default function TelescopeMailPage({ initialData }: TelescopeMailViewProps): React.JSX.Element {
	const [selected, setSelected] = useState<EmailLogEntry | null>(null);

	const rows: readonly EmailLogEntry[] = initialData.logs;

	// Feature 17 — status filter + template search (client-side; the payload
	// is bounded at 100 rows, so filtering in-memory beats another round-trip).
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [templateFilter, setTemplateFilter] = useState<string>("");

	const filteredRows = useMemo((): readonly EmailLogEntry[] => {
		const needle: string = templateFilter.trim().toLowerCase();
		return rows.filter((row: EmailLogEntry): boolean => {
			if (statusFilter !== "all" && row.status !== statusFilter) {
				return false;
			}
			if (needle.length > 0 && !row.templateKey.toLowerCase().includes(needle)) {
				return false;
			}
			return true;
		});
	}, [rows, statusFilter, templateFilter]);

	const handleStatusFilterChange = useCallback((value: string | null): void => {
		if (value !== null) setStatusFilter(value);
	}, []);

	const handleTemplateFilterChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setTemplateFilter(event.target.value);
	}, []);

	// Improvement 17 — clicking a row opens a detail dialog.
	const handleDialogOpenChange = useCallback((open: boolean): void => {
		if (!open) {
			setSelected(null);
		}
	}, []);

	const handleRowClick = useCallback((row: EmailLogEntry): void => {
		setSelected(row);
	}, []);

	const columns = useMemo<ColumnDef<DataTableFeatures, EmailLogEntry>[]>(
		() => [
			{
				accessorKey: "subject",
				header: "Subject",
				cell: ({ row }): React.JSX.Element => (
					<div className="min-w-0">
						<p className="truncate font-medium">{row.original.subject}</p>
						<p className="truncate text-xs text-muted-foreground">{row.original.templateKey}</p>
					</div>
				),
			},
			{
				accessorKey: "to",
				header: "To",
				cell: ({ row }): React.JSX.Element => <span className="text-muted-foreground">{row.original.to}</span>,
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }): React.JSX.Element => <StatusBadge status={row.original.status} />,
			},
			{
				accessorKey: "createdAt",
				header: "Sent at",
				cell: ({ row }): React.JSX.Element => (
					<div className="text-muted-foreground tabular-nums">
						<div>{formatTime(row.original.createdAt)}</div>
						{/* Improvement v2 — relative "2m ago" sub-line. */}
						<div className="text-[11px] text-muted-foreground/70">{timeAgo(row.original.createdAt)}</div>
					</div>
				),
			},
		],
		[],
	);

	return (
		<div className="mx-auto w-full max-w-7xl space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight text-foreground">Mail</h1>
				<p className="mt-1 max-w-xl text-sm text-muted-foreground">
					The last 100 outbound emails with their delivery status. For the full log with live updates, head to{" "}
					<Link href="/email-log" className="font-medium text-primary hover:underline">
						Email Log
					</Link>
					.
				</p>
			</header>

			{/* Feature 17 — status + template filters. */}
			<div className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1.5">
					<label htmlFor="tel-mail-status" className="text-xs font-medium text-muted-foreground">
						Status
					</label>
					<Select
						value={statusFilter}
						onValueChange={handleStatusFilterChange}
						items={[{ value: "all", label: "All statuses" }, ...Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))]}>
						<SelectTrigger id="tel-mail-status" className="h-9 w-40 text-sm">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All statuses</SelectItem>
							{Object.entries(STATUS_META).map(([value, meta]) => (
								<SelectItem key={value} value={value}>
									{meta.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex flex-col gap-1.5">
					<label htmlFor="tel-mail-template" className="text-xs font-medium text-muted-foreground">
						Template
					</label>
					<Input
						id="tel-mail-template"
						type="search"
						placeholder="e.g. verification"
						value={templateFilter}
						onChange={handleTemplateFilterChange}
						className="h-9 w-48 text-sm"
					/>
				</div>
			</div>

			<DataTable
				labels={ADMIN_DATA_TABLE_LABELS}
				data={[...filteredRows]}
				columns={columns}
				searchKeys={["subject", "to", "templateKey"]}
				pageSize={10}
				pageSizeOptions={[10, 25, 50, 100]}
				exportable
				exportFilename="telescope-mail"
				enableColumnVisibility
				onRowClick={handleRowClick}
			/>

			{/* Mail detail dialog (improvement 17) */}
			<Dialog open={selected !== null} onOpenChange={handleDialogOpenChange}>
				<DialogContent className="sm:max-w-lg">
					{selected !== null ? (
						<>
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2">
									<StatusBadge status={selected.status} />
									<span className="truncate">{selected.subject}</span>
								</DialogTitle>
								<DialogDescription>Email log detail — timestamps and delivery metadata.</DialogDescription>
							</DialogHeader>
							<dl className="space-y-2 text-sm">
								{[
									{ label: "Template", value: selected.templateKey },
									{ label: "To", value: selected.to },
									{ label: "Sent", value: formatTime(selected.createdAt) },
									{ label: "Updated", value: formatTime(selected.updatedAt) },
									{ label: "Resend id", value: selected.resendId ?? "—" },
									{ label: "Error", value: selected.error ?? "—" },
								].map((row) => (
									<div key={row.label} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
										<dt className="text-muted-foreground">{row.label}</dt>
										<dd className="min-w-0 font-mono text-xs break-all text-foreground">{row.value}</dd>
									</div>
								))}
							</dl>
						</>
					) : null}
				</DialogContent>
			</Dialog>
		</div>
	);
}
