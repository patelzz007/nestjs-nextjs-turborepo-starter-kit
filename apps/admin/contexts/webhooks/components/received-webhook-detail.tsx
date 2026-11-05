"use client";

import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { Envelope, ReceivedWebhookDetail } from "@workspace/shared";
import { buttonVariants } from "@workspace/ui/components/button";
import { formatBytes } from "@workspace/ui/lib/format/bytes";
import Link from "next/link";
import type * as React from "react";

import { auditLogListHref, NOT_RECORDED, orDash, RecordField, RecordSection } from "@/contexts/audit";
import { ReceivedWebhookDetailPageSkeleton } from "@/components/loading/received-webhook-skeletons";
import { RECEIVED_WEBHOOK_PROVIDER_LABELS } from "@/lib/data-table/enum-filter-options";
import { formatDateTimeWithSeconds } from "@/lib/format/dates";
import { ROUTES } from "@/lib/routes";

import { ReceivedWebhookOutcomeBadge, ReceivedWebhookVerificationBadge } from "./received-webhook-badges";

export interface ReceivedWebhookDetailViewProps {
	readonly id: string;
	/** The server-prefetched `GET /admin/webhooks/received/:id` envelope, or `undefined` when the prefetch failed. */
	readonly initialRecord?: Envelope<ReceivedWebhookDetail> | undefined;
}

/** An optional epoch-ms time, or the dash. */
function timeOrDash(value: number | null): string {
	return value === null ? NOT_RECORDED : formatDateTimeWithSeconds(value);
}

/** The allowlisted headers as a key / value table, sorted by name. */
function HeadersTable({ headers }: { readonly headers: Readonly<Record<string, string>> }): React.JSX.Element {
	const entries: [string, string][] = Object.entries(headers).sort(([left], [right]) => left.localeCompare(right));
	if (entries.length === 0) {
		return <p className="text-sm text-muted-foreground">No allowlisted headers were sent.</p>;
	}
	return (
		<div className="overflow-x-auto rounded-md border">
			<table className="w-full text-left font-mono text-xs">
				<caption className="sr-only">The request headers kept with this delivery</caption>
				<thead className="bg-muted text-muted-foreground">
					<tr>
						<th scope="col" className="px-3 py-2 font-medium">
							Header
						</th>
						<th scope="col" className="px-3 py-2 font-medium">
							Value
						</th>
					</tr>
				</thead>
				<tbody>
					{entries.map(([name, value]) => (
						<tr key={name} className="border-t align-top">
							<th scope="row" className="px-3 py-2 font-medium whitespace-nowrap">
								{name}
							</th>
							<td className="px-3 py-2 break-all">{value}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** One received webhook, presentational: the caller fetched it. */
export function ReceivedWebhookRecord({ record }: { readonly record: ReceivedWebhookDetail }): React.JSX.Element {
	return (
		<div className="space-y-4">
			<header className="space-y-2">
				<div className="flex flex-wrap items-center gap-2">
					<h1 className="text-xl font-semibold text-foreground">{RECEIVED_WEBHOOK_PROVIDER_LABELS[record.provider]}</h1>
					<span className="font-mono text-sm text-muted-foreground">{record.eventType ?? NOT_RECORDED}</span>
					<ReceivedWebhookVerificationBadge verification={record.verification} />
					<ReceivedWebhookOutcomeBadge outcome={record.outcome} />
				</div>
				<p className="font-mono text-xs break-all text-muted-foreground">{record.providerDeliveryId ?? "No delivery id — the signature did not verify"}</p>
			</header>

			{record.errorSummary === null ? null : (
				<section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
					<h2 className="text-sm font-semibold text-destructive">Why it was refused or failed</h2>
					<p className="mt-1 text-sm break-all text-destructive">{record.errorSummary}</p>
				</section>
			)}

			<RecordSection title="Delivery" description="What the provider sent and what this server answered." layout="page">
				<RecordField label="Provider">{RECEIVED_WEBHOOK_PROVIDER_LABELS[record.provider]}</RecordField>
				<RecordField label="Event" mono>
					{orDash(record.eventType)}
				</RecordField>
				<RecordField label="Delivery id" mono>
					{orDash(record.providerDeliveryId)}
				</RecordField>
				<RecordField label="Signature">
					<ReceivedWebhookVerificationBadge verification={record.verification} />
				</RecordField>
				<RecordField label="Outcome">
					<ReceivedWebhookOutcomeBadge outcome={record.outcome} />
				</RecordField>
				<RecordField label="HTTP status" mono>
					{orDash(record.httpStatus)}
				</RecordField>
				<RecordField label="Attempts">{record.attempts}</RecordField>
				<RecordField label="Duplicates answered">{record.duplicateCount}</RecordField>
			</RecordSection>

			<RecordSection title="When" description="The API's clock, shown in your time zone." layout="page">
				<RecordField label="First received">{formatDateTimeWithSeconds(record.receivedAt)}</RecordField>
				<RecordField label="Last received">{formatDateTimeWithSeconds(record.lastReceivedAt)}</RecordField>
				<RecordField label="Processing claimed">{timeOrDash(record.claimedAt)}</RecordField>
				<RecordField label="Completed">{timeOrDash(record.completedAt)}</RecordField>
			</RecordSection>

			<RecordSection title="Payload" description="The body is never kept — only its fingerprint and size, to tell two deliveries apart." layout="page">
				<RecordField label="SHA-256" mono>
					{record.payloadSha256}
				</RecordField>
				<RecordField label="Size">{formatBytes(record.payloadBytes)}</RecordField>
			</RecordSection>

			<section className="space-y-3 rounded-lg border bg-card p-4">
				<div>
					<h2 className="text-sm font-semibold">Headers</h2>
					<p className="text-xs text-muted-foreground">Only allowlisted headers are kept — never a signature, an authorization header or a cookie.</p>
				</div>
				<HeadersTable headers={record.headers} />
			</section>

			<RecordSection title="Tracing" description="The request in the audit log, with its full redacted headers." layout="page">
				<RecordField label="Correlation id" mono>
					{record.correlationId === null ? (
						NOT_RECORDED
					) : (
						<Link href={auditLogListHref({ correlationId: record.correlationId })} className="text-primary hover:underline">
							{record.correlationId}
						</Link>
					)}
				</RecordField>
				<RecordField label="Record id" mono>
					{record.id}
				</RecordField>
			</RecordSection>
		</div>
	);
}

/**
 * `/webhooks/received/[id]` — one received webhook on its own read-only page:
 * its signature check, outcome, timing, payload fingerprint and allowlisted headers.
 */
export default function ReceivedWebhookDetailView({ id, initialRecord }: ReceivedWebhookDetailViewProps): React.JSX.Element {
	const { api } = useAuth();
	// GET /admin/webhooks/received/:id needs READ AUDIT_LOG, which the route guard enforces for this page.
	const detailQuery = api.receivedWebhooks.detail.useQuery({ id }, initialDataOption(initialRecord));
	const record: ReceivedWebhookDetail | undefined = detailQuery.data?.data;

	if (detailQuery.isLoading && record === undefined) {
		return <ReceivedWebhookDetailPageSkeleton />;
	}

	if (detailQuery.isError || record === undefined) {
		return (
			<div className="space-y-4">
				<Link href={ROUTES.webhooks.received} className={buttonVariants({ variant: "outline" })}>
					Back to received webhooks
				</Link>
				<p className="text-destructive">Could not load this webhook.</p>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-10xl space-y-6">
			<Link href={ROUTES.webhooks.received} className={buttonVariants({ variant: "outline", size: "sm" })}>
				Back to received webhooks
			</Link>
			<ReceivedWebhookRecord record={record} />
		</div>
	);
}
