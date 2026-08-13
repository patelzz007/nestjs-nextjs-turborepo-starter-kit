"use client";

// ============================================
// app/(panel)/telescope/mail/page.tsx
// Mail tab — the last 100 sends from the shared email log, surfaced inside
// Telescope so the observability console stays self-contained. The canonical,
// live-updating view remains `/email-log` (SSE); this is a read-only mirror.
// ============================================

import { useAuth } from "@workspace/client/lib/auth";
import { telescopeEndpoints } from "@workspace/client/lib/api/endpoints";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/overlay/dialog";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type DataTableFeatures } from "@workspace/ui/components/display/data-table";
import { Loader2, Mail, CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

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
export default function TelescopeMailPage(): React.JSX.Element {
	const { api } = useAuth();
	const mailQuery = api.procedure(telescopeEndpoints.mail()).useQuery();
	const [selected, setSelected] = useState<EmailLogEntry | null>(null);

	const rows = useMemo(() => mailQuery.data?.data.logs ?? [], [mailQuery.data]);

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

	if (mailQuery.isLoading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<div className="flex flex-col items-center gap-3 text-muted-foreground">
					<Loader2 className="size-6 animate-spin" />
					<p className="text-sm">Loading mail…</p>
				</div>
			</div>
		);
	}

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

			<DataTable
				data={[...rows]}
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
