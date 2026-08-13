"use client";

// ============================================
// components/telescope/webhook-deliveries.tsx
// Feature 13 — webhook delivery log. Every outbound alert-webhook POST from
// `TelescopeAlertService` records a delivery row; this strip shows the recent
// attempts (status, HTTP code, latency, attempt index) so an admin can tell
// whether alerts actually reached the external endpoint.
//
// Dumb component: deliveries + loading arrive via props.
// ============================================

import { CircleCheck, CircleX, Loader2, Webhook } from "lucide-react";

import type { TelescopeWebhookDelivery } from "@workspace/shared";

import { durationLabel, formatTime } from "@/lib/telescope";

export interface WebhookDeliveriesProps {
	readonly deliveries: readonly TelescopeWebhookDelivery[];
	readonly isLoading: boolean;
}

export function WebhookDeliveries({ deliveries, isLoading }: WebhookDeliveriesProps): React.JSX.Element {
	if (isLoading) {
		return (
			<div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
				<Loader2 className="size-3.5 animate-spin" />
				Loading deliveries…
			</div>
		);
	}

	if (deliveries.length === 0) {
		return (
			<div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
				<Webhook className="size-3.5 shrink-0" />
				No webhook deliveries yet — set <code className="font-mono">TELESCOPE_ALERT_WEBHOOK_URL</code> to fire them.
			</div>
		);
	}

	return (
		<div className="space-y-1">
			{deliveries.map((delivery) => (
				<div key={delivery.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-[11px]">
					{delivery.status === "success" ? <CircleCheck className="size-3.5 shrink-0 text-emerald-500" /> : <CircleX className="size-3.5 shrink-0 text-red-500" />}
					<span className="w-14 shrink-0 font-mono font-medium uppercase">{delivery.status}</span>
					{delivery.statusCode !== null ? <span className="w-8 shrink-0 font-mono tabular-nums">{String(delivery.statusCode)}</span> : <span className="w-8 shrink-0">—</span>}
					<span className="w-12 shrink-0 font-mono text-muted-foreground tabular-nums">{durationLabel(delivery.durationMs)}</span>
					<span className="shrink-0 text-muted-foreground tabular-nums">attempt {String(delivery.attempt)}</span>
					<span className="min-w-0 flex-1 truncate text-muted-foreground">{delivery.error ?? `delivered · ${formatTime(delivery.createdAt)}`}</span>
				</div>
			))}
		</div>
	);
}
