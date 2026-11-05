"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { PUBLIC_STATUS_LABELS, STATUS_COMPONENT_LABELS, STATUS_INCIDENT_STATE_LABELS, type PublicStatus, type PublicStatusIncident } from "@workspace/shared";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge";
import * as React from "react";

/** How often the page asks again while open (the API's own cache is 30 s). */
const STATUS_REFRESH_MS = 60_000;

const STATUS_TONES: Readonly<Record<PublicStatus, StatusTone>> = {
	OPERATIONAL: "success",
	UNKNOWN: "muted",
	DEGRADED: "warning",
	PARTIAL_OUTAGE: "danger",
	MAJOR_OUTAGE: "danger",
};

/** The headline for the whole service. */
const OVERALL_HEADLINES: Readonly<Record<PublicStatus, string>> = {
	OPERATIONAL: "Everything is working",
	UNKNOWN: "We can't confirm right now",
	DEGRADED: "Some things are slower than usual",
	PARTIAL_OUTAGE: "Part of the service is down",
	MAJOR_OUTAGE: "The service is down",
};

const DATE_TIME = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function formatStatusTime(at: number): string {
	return DATE_TIME.format(at);
}

/** `/status` (enhancement 4.5): each part of the service, what is wrong, and what was wrong this week. */
export function PublicStatusView(): React.JSX.Element {
	const { api } = useAuth();
	const query = api.operations.publicStatus.useQuery(undefined, { refetchInterval: STATUS_REFRESH_MS });
	const page = query.data?.data;
	if (page === undefined) {
		return query.isError ? (
			<Alert variant="warning">
				<AlertTitle>We can&apos;t load the status right now</AlertTitle>
				<AlertDescription>That may itself be the problem. Try again in a minute.</AlertDescription>
			</Alert>
		) : (
			<Skeleton className="h-64 w-full rounded-xl" />
		);
	}
	return (
		<div className="flex flex-col gap-6">
			<section aria-labelledby="status-overall" className="flex flex-col gap-1">
				<div className="flex flex-wrap items-center gap-3">
					<h2 id="status-overall" className="text-xl font-semibold tracking-tight">
						{OVERALL_HEADLINES[page.overall]}
					</h2>
					<StatusBadge tone={STATUS_TONES[page.overall]}>{PUBLIC_STATUS_LABELS[page.overall]}</StatusBadge>
				</div>
				{page.checkedAt === null ? null : <p className="text-sm text-muted-foreground">Last checked {formatStatusTime(page.checkedAt)}</p>}
			</section>
			<Card>
				<CardHeader>
					<CardTitle>Each part</CardTitle>
				</CardHeader>
				<CardContent>
					<ul className="divide-y divide-border" aria-label="Each part of the service">
						{page.components.map((component): React.JSX.Element => (
							<li key={component.key} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
								<span className="text-sm">{component.label}</span>
								<StatusBadge tone={STATUS_TONES[component.status]}>{PUBLIC_STATUS_LABELS[component.status]}</StatusBadge>
							</li>
						))}
					</ul>
				</CardContent>
			</Card>
			{page.open.length === 0 ? null : <IncidentList title="Happening now" incidents={page.open} />}
			<IncidentList title="This week" incidents={page.recent} emptyText="Nothing went wrong in the last 7 days." />
		</div>
	);
}

function IncidentList({
	title,
	incidents,
	emptyText,
}: {
	readonly title: string;
	readonly incidents: readonly PublicStatusIncident[];
	readonly emptyText?: string;
}): React.JSX.Element {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				{incidents.length === 0 && emptyText !== undefined ? <CardDescription>{emptyText}</CardDescription> : null}
			</CardHeader>
			{incidents.length === 0 ? null : (
				<CardContent className="flex flex-col gap-6">
					{incidents.map((incident): React.JSX.Element => (
						<article key={incident.id} aria-labelledby={`incident-${incident.id}`} className="flex flex-col gap-2">
							<div className="flex flex-wrap items-center gap-2">
								<h3 id={`incident-${incident.id}`} className="font-medium">
									{incident.title}
								</h3>
								<StatusBadge tone={incident.resolvedAt === null ? "warning" : "success"}>{STATUS_INCIDENT_STATE_LABELS[incident.state]}</StatusBadge>
							</div>
							<p className="text-xs text-muted-foreground">
								Affects {incident.components.map((key) => STATUS_COMPONENT_LABELS[key]).join("; ")}. Started {formatStatusTime(incident.startedAt)}
								{incident.resolvedAt === null ? "" : `, resolved ${formatStatusTime(incident.resolvedAt)}`}.
							</p>
							<ol className="flex flex-col gap-2 border-s-2 border-border ps-3" aria-label={`Updates on ${incident.title}`}>
								{incident.updates.map((update): React.JSX.Element => (
									<li key={`${String(update.postedAt)}-${update.state}`} className="text-sm">
										<span className="font-medium">{STATUS_INCIDENT_STATE_LABELS[update.state]}</span>
										<span className="text-muted-foreground">, {formatStatusTime(update.postedAt)}</span>
										<p className="whitespace-pre-wrap">{update.message}</p>
									</li>
								))}
							</ol>
						</article>
					))}
				</CardContent>
			)}
		</Card>
	);
}
