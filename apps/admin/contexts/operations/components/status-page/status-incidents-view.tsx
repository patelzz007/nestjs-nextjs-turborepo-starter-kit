"use client";

import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { PERMISSION, type StatusIncident } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { Megaphone } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { ROUTES } from "@/lib/routes";

import { formatDateTimeShort } from "../../lib/ops-format";
import { componentsSummary, IMPACT_SHORT_LABELS, IMPACT_TONES, STATE_LABELS, STATE_TONES } from "../../lib/status-page-labels";

/** `/operations/status` (enhancement 4.5): the incidents told to customers on the public status page. */
export function StatusIncidentsView(): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const list = api.operations.statusIncidents.useQuery(undefined);
	const incidents = list.data?.data.incidents;

	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-semibold tracking-tight">Status page</h1>
					<p className="text-sm text-muted-foreground">
						What customers and merchants read when something is wrong. Each part&apos;s status also follows the monitor on its own.
					</p>
				</div>
				{can(PERMISSION.STATUS_INCIDENT.CREATE) ? (
					<Button render={<Link href={ROUTES.operations.newStatusIncident} />} nativeButton={false}>
						<Megaphone className="size-4" />
						Open an incident
					</Button>
				) : null}
			</header>
			<Card>
				<CardHeader>
					<CardTitle>Incidents</CardTitle>
					<CardDescription>Newest first. Resolved ones stay on the public page for a week.</CardDescription>
				</CardHeader>
				<CardContent className="overflow-x-auto">
					{incidents === undefined ? (
						<Skeleton className="h-40 w-full rounded-xl" />
					) : incidents.length === 0 ? (
						<p className="text-sm text-muted-foreground">No incidents yet. When something breaks, open one so customers know you&apos;re on it.</p>
					) : (
						<IncidentsTable incidents={incidents} />
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function IncidentsTable({ incidents }: { readonly incidents: readonly StatusIncident[] }): React.JSX.Element {
	return (
		<Table aria-label="Incidents">
			<TableHeader>
				<TableRow>
					<TableHead>Incident</TableHead>
					<TableHead>Impact</TableHead>
					<TableHead>Where it stands</TableHead>
					<TableHead>Started</TableHead>
					<TableHead>Resolved</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{incidents.map((incident): React.JSX.Element => (
					<TableRow key={incident.id}>
						<TableCell>
							<Link href={ROUTES.operations.statusIncident(incident.id)} className="font-medium hover:underline">
								{incident.title}
							</Link>
							<p className="text-xs text-muted-foreground">{componentsSummary(incident.components)}</p>
						</TableCell>
						<TableCell>
							<StatusBadge tone={IMPACT_TONES[incident.impact]}>{IMPACT_SHORT_LABELS[incident.impact]}</StatusBadge>
						</TableCell>
						<TableCell>
							<StatusBadge tone={STATE_TONES[incident.state]}>{STATE_LABELS[incident.state]}</StatusBadge>
						</TableCell>
						<TableCell className="whitespace-nowrap">{formatDateTimeShort(incident.startedAt)}</TableCell>
						<TableCell className="whitespace-nowrap">{formatDateTimeShort(incident.resolvedAt)}</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
