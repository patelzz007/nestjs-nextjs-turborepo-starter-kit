"use client";

import { canRedeliver, DELIVERY_STATUS_PRESENTATION } from "@/contexts/webhooks/lib/webhook-presentation";
import { PLATFORM_DISPLAY_REGION, type WebhookDeliverySummary } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import { RelativeTime } from "@workspace/ui/components/relative-time";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { AlertTriangle, RotateCw, Send } from "lucide-react";
import * as React from "react";

/** Placeholder rows shown while the log loads. */
const SKELETON_ROW_KEYS: readonly string[] = ["first", "second", "third"];

export const WEBHOOK_DELIVERY_LOG_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading deliveries…" };

/** What the last attempt saw, in a few words. */
function attemptSummary(delivery: WebhookDeliverySummary): string {
	if (delivery.attempts === 0) {
		return "Not sent yet";
	}
	const answer = delivery.lastStatusCode === null ? "no answer" : `HTTP ${String(delivery.lastStatusCode)}`;
	const tries = delivery.attempts === 1 ? "1 attempt" : `${String(delivery.attempts)} attempts`;
	return `${tries}, last: ${answer}`;
}

interface DeliveryRowProps {
	readonly delivery: WebhookDeliverySummary;
	readonly showEndpoint: boolean;
	readonly isRedelivering: boolean;
	readonly onRedeliver: (delivery: WebhookDeliverySummary) => void;
}

function DeliveryRow({ delivery, showEndpoint, isRedelivering, onRedeliver }: DeliveryRowProps): React.JSX.Element {
	const status = DELIVERY_STATUS_PRESENTATION[delivery.status];
	const handleRedeliver = React.useCallback((): void => {
		onRedeliver(delivery);
	}, [delivery, onRedeliver]);
	return (
		<li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
			<div className="min-w-0 flex-1 space-y-1">
				<div className="flex flex-wrap items-center gap-2">
					<StatusBadge tone={status.tone}>{status.label}</StatusBadge>
					<span className="font-mono text-sm text-foreground">{delivery.eventType}</span>
				</div>
				{showEndpoint ? <p className="truncate text-xs text-muted-foreground">{delivery.endpointUrl}</p> : null}
				<p className="text-xs text-muted-foreground">
					{attemptSummary(delivery)}
					{delivery.nextAttemptAt !== null && delivery.status === "FAILED" ? (
						<>
							{" · next try "}
							<RelativeTime epochMs={delivery.nextAttemptAt} region={PLATFORM_DISPLAY_REGION} />
						</>
					) : null}
				</p>
				{delivery.lastError === null ? null : <p className="text-xs break-words text-destructive">{delivery.lastError}</p>}
			</div>
			<div className="flex items-center gap-3">
				<RelativeTime className="text-xs text-muted-foreground" epochMs={delivery.createdAt} region={PLATFORM_DISPLAY_REGION} />
				{canRedeliver(delivery.status) ? (
					<Button variant="outline" size="sm" onClick={handleRedeliver} disabled={isRedelivering} aria-label={`Send ${delivery.eventType} again`}>
						<RotateCw className="size-3.5" aria-hidden="true" />
						{isRedelivering ? "Sending…" : "Send again"}
					</Button>
				) : null}
			</div>
		</li>
	);
}

export interface WebhookDeliveryLogProps {
	readonly deliveries: readonly WebhookDeliverySummary[];
	readonly isLoading: boolean;
	readonly isError: boolean;
	readonly onRetry: () => void;
	/** Whether each row names its endpoint (the tenant-wide log does; one endpoint's log does not). */
	readonly showEndpoint: boolean;
	readonly redeliveringId: string | null;
	readonly onRedeliver: (delivery: WebhookDeliverySummary) => void;
	/** An error from the last "Send again", shown above the list. */
	readonly redeliverError: string | null;
}

/** The newest deliveries and what became of them. Presentational: the page owns the query and the redelivery. */
export function WebhookDeliveryLog({
	deliveries,
	isLoading,
	isError,
	onRetry,
	showEndpoint,
	redeliveringId,
	onRedeliver,
	redeliverError,
}: WebhookDeliveryLogProps): React.JSX.Element {
	return (
		<section aria-labelledby="webhook-deliveries-heading" className="space-y-3">
			<div>
				<h2 id="webhook-deliveries-heading" className="text-base font-semibold text-foreground">
					Recent deliveries
				</h2>
				<p className="text-sm text-muted-foreground">Failed deliveries are retried for about three hours. Each one is kept for 30 days.</p>
			</div>
			{redeliverError === null ? null : (
				<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
					{redeliverError}
				</p>
			)}
			{isLoading ? (
				<SkeletonRegion labels={WEBHOOK_DELIVERY_LOG_LOADING_LABELS}>
					<div className="space-y-2">
						{SKELETON_ROW_KEYS.map((key) => (
							<Skeleton key={key} className="h-16 rounded-lg" />
						))}
					</div>
				</SkeletonRegion>
			) : isError ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<AlertTriangle aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle>Couldn&apos;t load deliveries</EmptyTitle>
						<EmptyDescription>Check your connection and try again.</EmptyDescription>
					</EmptyHeader>
					<Button variant="outline" size="sm" onClick={onRetry}>
						Try again
					</Button>
				</Empty>
			) : deliveries.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Send aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle>No deliveries yet</EmptyTitle>
						<EmptyDescription>Send a test event to an endpoint to see its first delivery here.</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="divide-y divide-border rounded-xl border border-border bg-card">
					{deliveries.map((delivery) => (
						<DeliveryRow key={delivery.id} delivery={delivery} showEndpoint={showEndpoint} isRedelivering={redeliveringId === delivery.id} onRedeliver={onRedeliver} />
					))}
				</ul>
			)}
		</section>
	);
}
