"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { FeatureFlagSummary } from "@workspace/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import Link from "next/link";
import * as React from "react";

import { ROUTES } from "@/lib/routes";

import { formatWhen, READY_TO_REMOVE_LABELS, ROLLOUT_UNIT_LABELS } from "../lib/release-labels";
import { EnvironmentNote } from "./environment-note";

/** A flag's state in a word or two, from strongest to weakest: killed, waiting for approval, its rules, its default. */
function FlagState({ flag }: { readonly flag: FeatureFlagSummary }): React.JSX.Element {
	if (flag.killSwitch.on) {
		return <StatusBadge tone="danger">Killed</StatusBadge>;
	}
	return (
		<div className="flex flex-wrap gap-1.5">
			<StatusBadge tone={flag.ruleCount > 0 ? "info" : "muted"}>
				{flag.ruleCount > 0 ? `${String(flag.ruleCount)} rule${flag.ruleCount === 1 ? "" : "s"}` : `Default: ${flag.defaultOn ? "on" : "off"}`}
			</StatusBadge>
			{flag.pendingRevision === null ? null : <StatusBadge tone="warning">Change waiting</StatusBadge>}
			{flag.overrideCount > 0 ? <StatusBadge tone="neutral">{`${String(flag.overrideCount)} override${flag.overrideCount === 1 ? "" : "s"}`}</StatusBadge> : null}
		</div>
	);
}

/** `/releases/flags` (ADR 087): every flag the code declares, how it is decided now, and whether it can leave the code. */
export function FeatureFlagsList(): React.JSX.Element {
	const { api } = useAuth();
	const flags = api.featureFlags.list.useQuery(undefined).data?.data.flags;
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold tracking-tight">Feature flags</h1>
				<p className="text-sm text-muted-foreground">
					Each flag is declared in the code; here you decide who gets it: rules for who and how many, overrides for one person or store, and a kill switch that turns it off
					for everyone at once.
				</p>
				<EnvironmentNote />
			</header>
			<Card>
				<CardHeader>
					<CardTitle>Flags</CardTitle>
					<CardDescription>Open a flag to see its rules, overrides, history and who it reached.</CardDescription>
				</CardHeader>
				<CardContent className="overflow-x-auto">
					{flags === undefined ? (
						<Skeleton className="h-48 w-full rounded-xl" />
					) : (
						<Table aria-label="Feature flags">
							<TableHeader>
								<TableRow>
									<TableHead>Flag</TableHead>
									<TableHead>Decided per</TableHead>
									<TableHead>Now</TableHead>
									<TableHead className="text-right">Checks, 24 h</TableHead>
									<TableHead>Last changed</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{flags.map((flag): React.JSX.Element => (
									<TableRow key={flag.key}>
										<TableCell>
											<Link href={ROUTES.releases.flag(flag.key)} className="font-medium hover:underline">
												{flag.title}
											</Link>
											<p className="font-mono text-xs text-muted-foreground">{flag.key}</p>
											{flag.readyToRemove === null ? null : (
												<StatusBadge tone="warning" className="mt-1">{`Ready to remove from code · ${READY_TO_REMOVE_LABELS[flag.readyToRemove]}`}</StatusBadge>
											)}
										</TableCell>
										<TableCell>{ROLLOUT_UNIT_LABELS[flag.rolloutUnit]}</TableCell>
										<TableCell>
											<FlagState flag={flag} />
										</TableCell>
										<TableCell className="text-right tabular-nums">{flag.exposures24h.toLocaleString("en-GB")}</TableCell>
										<TableCell className="whitespace-nowrap">{formatWhen(flag.updatedAt)}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
