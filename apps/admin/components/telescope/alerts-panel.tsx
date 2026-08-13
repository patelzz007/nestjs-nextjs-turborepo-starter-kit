"use client";

// ============================================
// components/telescope/alerts-panel.tsx
// Feature 18 — threshold alerts. Recent duration/error alerts fired by the
// alert service; each row links to the offending request.
//
// Dumb component: alerts arrive via props.
// ============================================

import { BellRing } from "lucide-react";
import Link from "next/link";

import type { TelescopeAlertEntry } from "@workspace/shared";

import { alertReasonTone, durationLabel, timeAgo } from "@/lib/telescope";

export function AlertsPanel({ alerts }: { readonly alerts: readonly TelescopeAlertEntry[] }): React.JSX.Element {
	if (alerts.length === 0) {
		return (
			<div className="flex min-h-16 items-center justify-center rounded-md border border-dashed p-4 text-center">
				<p className="text-xs text-muted-foreground">
					No alerts in this window. Configure <code className="font-mono">TELESCOPE_ALERT_WEBHOOK_URL</code> to fire webhooks.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-1">
			{alerts.map((alert) => (
				<Link
					key={alert.id}
					href={`/telescope/requests/${alert.requestId}`}
					className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-accent">
					<BellRing className="size-3.5 shrink-0 text-red-500" />
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">{alert.method}</span>
							<span className="truncate font-mono text-xs text-foreground group-hover:underline">{alert.path}</span>
						</div>
						<div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
							<span className={`inline-flex rounded-full border px-1.5 py-0.5 font-medium uppercase ${alertReasonTone(alert.reason)}`}>{alert.reason}</span>
							<span className="tabular-nums">{durationLabel(alert.durationMs)}</span>
						</div>
					</div>
					<span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{timeAgo(alert.firedAt)}</span>
				</Link>
			))}
		</div>
	);
}
