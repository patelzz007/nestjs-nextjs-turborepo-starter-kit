"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { emailEndpoints } from "@workspace/client/lib/api/endpoints";
import type { EmailLogEntry, EmailLogStatus } from "@workspace/shared";
import { useEmailLogLive, type LiveState } from "@/lib/email-log-live";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { DataTable, type DataTableFeatures } from "@workspace/ui/components/display/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { CircleCheck, CircleX, Loader2, Mail, RefreshCw, TriangleAlert } from "lucide-react";
import * as React from "react";

// ── Status presentation ───────────────────────────────────────────────────

/** Visual treatment per lifecycle status — colors stay token-driven. */
const STATUS_META: Readonly<
	Record<EmailLogStatus, { readonly label: string; readonly variant: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"; readonly icon: React.ReactNode }>
> = {
	sent: { label: "Sent", variant: "secondary", icon: <Mail className="size-3" /> },
	delivered: { label: "Delivered", variant: "default", icon: <CircleCheck className="size-3" /> },
	bounced: { label: "Bounced", variant: "destructive", icon: <CircleX className="size-3" /> },
	complained: { label: "Complained", variant: "destructive", icon: <CircleX className="size-3" /> },
	failed: { label: "Failed", variant: "destructive", icon: <TriangleAlert className="size-3" /> },
};

/**
 * Status badge — surfaces the delivery lifecycle only. Open/click tracking
 * was deliberately removed from the system, so the badge never claims anyone
 * "opened" an email — it just shows where the delivery stands.
 */
function StatusBadge({ entry }: { readonly entry: EmailLogEntry }): React.JSX.Element {
	const meta = STATUS_META[entry.status];
	return (
		<Badge variant={meta.variant} className="gap-1">
			{meta.icon}
			{meta.label}
		</Badge>
	);
}

// ── Live pill ──────────────────────────────────────────────────────────────

/**
 * Connection indicator for the SSE live stream — a pulsing dot + label.
 * `open` = updates flow instantly; `connecting` = initial connect or an
 * auto-reconnect after a drop; `closed` = not expected to recover.
 */
function LivePill({ state }: { readonly state: LiveState }): React.JSX.Element {
	const meta: Readonly<Record<LiveState, { readonly label: string; readonly dot: string; readonly text: string; readonly title: string }>> = {
		open: {
			label: "Live",
			dot: "bg-emerald-500",
			text: "text-emerald-600 dark:text-emerald-400",
			title: "Connected — the log updates automatically the instant a webhook flips a status.",
		},
		connecting: {
			label: "Connecting…",
			dot: "bg-amber-500",
			text: "text-amber-600 dark:text-amber-400",
			title: "Connecting to the live stream — updates resume automatically once connected.",
		},
		closed: {
			label: "Offline",
			dot: "bg-muted-foreground",
			text: "text-muted-foreground",
			title: "Live stream unavailable — use Refresh to pull the latest rows.",
		},
	};
	const current = meta[state];
	return (
		<span title={current.title} className={`inline-flex items-center gap-1.5 rounded-full border border-input bg-card px-2.5 py-1 text-xs font-medium ${current.text}`}>
			<span className={`size-1.5 animate-pulse rounded-full ${current.dot}`} />
			{current.label}
		</span>
	);
}

// ── Smart page component ──────────────────────────────────────────────────

/**
 * Email Log — admin audit surface for every outbound email.
 *
 * The page owns the data (fetched from `GET /notifications/email-log`), the
 * column defs, and the status presentation; the shared `DataTable` renders it
 * with search / pagination / export for free. Statuses are delivery-only
 * (sent → delivered / bounced / complained / failed) — open/click tracking
 * was removed from the system.
 */
export default function EmailLogPage(): React.JSX.Element {
	const { api } = useAuth();
	const logQuery = api.procedure(emailEndpoints.logList).useQuery();

	// Live updates: SSE stream → invalidate the list query on every webhook
	// write, so delivery status flips appear instantly.
	const liveState: LiveState = useEmailLogLive();

	// Stable rows reference (rule 16 — avoid re-renders via new array identity).
	const rows = React.useMemo(() => logQuery.data?.data.logs ?? [], [logQuery.data]);

	const columns = React.useMemo<ColumnDef<DataTableFeatures, EmailLogEntry>[]>(
		() => [
			{
				accessorKey: "subject",
				header: "Subject",
				enableHiding: false,
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
				cell: ({ row }): React.JSX.Element => (
					<div className="flex flex-wrap items-center gap-2">
						<StatusBadge entry={row.original} />
						{row.original.error !== undefined && row.original.error !== null ? (
							<span title={row.original.error} className="max-w-48 truncate text-xs text-destructive">
								{row.original.error}
							</span>
						) : null}
					</div>
				),
			},
			{
				accessorKey: "createdAt",
				header: (): React.JSX.Element => <div className="w-full text-end">Sent at</div>,
				cell: ({ row }): React.JSX.Element => <div className="text-end text-muted-foreground tabular-nums">{formatTime(row.original.createdAt)}</div>,
			},
		],
		[],
	);

	const mobileCardRender = React.useCallback(
		(item: EmailLogEntry): React.ReactNode => (
			<div className="rounded-lg border bg-card p-3">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<p className="truncate font-medium">{item.subject}</p>
						<p className="truncate text-xs text-muted-foreground">{item.to}</p>
					</div>
					<StatusBadge entry={item} />
				</div>
				{item.error !== undefined && item.error !== null ? (
					<span title={item.error} className="mt-1.5 block max-w-full truncate text-xs text-destructive">
						{item.error}
					</span>
				) : null}
				<div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
					<span className="font-mono">{item.templateKey}</span>
					<span className="tabular-nums">{formatTime(item.createdAt)}</span>
				</div>
			</div>
		),
		[],
	);

	const handleRefresh = React.useCallback((): void => {
		void logQuery.refetch();
	}, [logQuery]);

	if (logQuery.isLoading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<div className="flex flex-col items-center gap-3 text-muted-foreground">
					<Loader2 className="size-6 animate-spin" />
					<p className="text-sm">Loading email log…</p>
				</div>
			</div>
		);
	}

	if (logQuery.error) {
		return (
			<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
				Failed to load the email log — check that the API is running and you&apos;re signed in.
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-7xl space-y-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">Email Log</h1>{" "}
					<p className="mt-1 max-w-xl text-sm text-muted-foreground">
						Every outbound email and its delivery lifecycle — `sent` until the Resend webhook flips it to delivered, bounced, complained, or failed. No open/click tracking:
						the log reports delivery only. This page updates itself in real time.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<LivePill state={liveState} />
					<Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
						<RefreshCw className="size-3.5" />
						Refresh
					</Button>
				</div>
			</header>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Recent sends</CardTitle>
					<CardDescription>
						{rows.length} rows · newest first{rows.length >= 100 ? " · showing most recent 100" : ""}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<DataTable
						data={rows}
						columns={columns}
						searchKeys={["subject", "to", "templateKey"]}
						pageSize={10}
						pageSizeOptions={[10, 25, 50, 100]}
						exportable
						exportFilename="email-log"
						enableColumnVisibility
						mobileCardRender={mobileCardRender}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

/**
 * ISO timestamp → locale string. The formatter is built once at module scope
 * so every cell render reuses the same `Intl.DateTimeFormat` instance.
 */
const TIME_FORMATTER: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function formatTime(iso: string): string {
	return TIME_FORMATTER.format(new Date(iso));
}
