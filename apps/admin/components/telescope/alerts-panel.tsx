"use client";

// ============================================
// components/telescope/alerts-panel.tsx
// Feature 18 — threshold alerts. Recent duration/error alerts fired by the
// alert service; each row links to the offending request.
//
// Improvement 5 — triage: rows can be acknowledged (resolved) or snoozed
// from the panel. The panel stays a dumb list — each row's actions own their
// mutation (the id is part of the URL path, so one mutation per row) and
// report success through `onChanged`, which the parent uses to refetch.
// ============================================

import { useAuth } from "@workspace/client/lib/auth";
import { telescopeEndpoints } from "@workspace/client/lib/api/endpoints";
import { Button } from "@workspace/ui/components/form/button";
import { BellRing, Check, Clock3 } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import type { TelescopeAlertEntry } from "@workspace/shared";

import { alertReasonTone, durationLabel, timeAgo } from "@/lib/telescope";

export interface AlertsPanelProps {
	readonly alerts: readonly TelescopeAlertEntry[];
	/** Called after an ack/snooze succeeds — the parent refetches the list. */
	readonly onChanged: () => void;
}

/** Per-row actions: ack + quick snooze options. Owns its mutation. */
function AlertRowActions({ alert, onChanged }: { readonly alert: TelescopeAlertEntry; readonly onChanged: () => void }): React.JSX.Element {
	const { api } = useAuth();
	const [showSnooze, setShowSnooze] = useState<boolean>(false);
	const ackMutation = api.procedure(telescopeEndpoints.alertAck(alert.id)).useMutation();
	const snoozeMutation = api.procedure(telescopeEndpoints.alertSnooze(alert.id)).useMutation();

	const handleAck = useCallback(
		(event: React.MouseEvent): void => {
			event.preventDefault();
			ackMutation.mutate(
				{},
				{
					onSuccess: (): void => {
						onChanged();
						toast.success("Alert acknowledged.");
					},
					onError: (): void => {
						toast.error("Failed to acknowledge the alert.");
					},
				},
			);
		},
		[ackMutation, onChanged],
	);
	const handleSnooze = useCallback(
		(event: React.MouseEvent, minutes: number): void => {
			event.preventDefault();
			snoozeMutation.mutate(
				{ minutes },
				{
					onSuccess: (): void => {
						onChanged();
						toast.success(`Alert snoozed for ${String(minutes)} minutes.`);
					},
					onError: (): void => {
						toast.error("Failed to snooze the alert.");
					},
				},
			);
			setShowSnooze(false);
		},
		[snoozeMutation, onChanged],
	);

	return (
		<span
			className="flex shrink-0 items-center gap-1"
			onClick={(event: React.MouseEvent): void => {
				event.stopPropagation();
			}}>
			{!showSnooze ? (
				<>
					<Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground" onClick={handleAck} title="Acknowledge (resolve) this alert">
						<Check className="size-3" />
						Ack
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground"
						onClick={(event: React.MouseEvent): void => {
							event.preventDefault();
							setShowSnooze(true);
						}}
						title="Snooze this alert">
						<Clock3 className="size-3" />
						Snooze
					</Button>
				</>
			) : (
				<span className="inline-flex items-center gap-1">
					<span className="text-[11px] text-muted-foreground">for</span>
					{[15, 30, 60].map((minutes: number) => (
						<Button
							key={minutes}
							variant="outline"
							size="sm"
							className="h-6 px-1.5 text-[11px]"
							onClick={(event: React.MouseEvent): void => {
								handleSnooze(event, minutes);
							}}>
							{String(minutes)}m
						</Button>
					))}
					<Button
						variant="ghost"
						size="sm"
						className="h-6 px-1.5 text-[11px] text-muted-foreground"
						onClick={(event: React.MouseEvent): void => {
							event.preventDefault();
							setShowSnooze(false);
						}}>
						Cancel
					</Button>
				</span>
			)}
		</span>
	);
}

export function AlertsPanel({ alerts, onChanged }: AlertsPanelProps): React.JSX.Element {
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
			{alerts.map((alert) => {
				const snoozed: boolean = alert.snoozedUntil !== null;
				// Request alerts deep-link to the offending request; job alerts
				// (no correlated request) link to the jobs page instead.
				const href: string = alert.requestId !== null ? `/telescope/requests/${alert.requestId}` : "/telescope/jobs";
				return (
					<Link key={alert.id} href={href} className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-accent">
						<BellRing className={`size-3.5 shrink-0 ${snoozed ? "text-muted-foreground" : "text-red-500"}`} />
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">{alert.method}</span>
								<span className="truncate font-mono text-xs text-foreground group-hover:underline">{alert.path}</span>
								<span className="text-[11px] text-muted-foreground capitalize">
									{alert.status}
									{snoozed ? ` · until ${timeAgo(alert.snoozedUntil ?? 0)}` : ""}
								</span>
							</div>
							<div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
								<span className={`inline-flex rounded-full border px-1.5 py-0.5 font-medium uppercase ${alertReasonTone(alert.reason)}`}>{alert.reason}</span>
								<span className="tabular-nums">{durationLabel(alert.durationMs)}</span>
							</div>
						</div>
						<span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{timeAgo(alert.firedAt)}</span>
						<AlertRowActions alert={alert} onChanged={onChanged} />
					</Link>
				);
			})}
		</div>
	);
}
