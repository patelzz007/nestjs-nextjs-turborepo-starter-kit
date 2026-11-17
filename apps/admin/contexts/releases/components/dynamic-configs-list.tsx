"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import Link from "next/link";
import * as React from "react";

import { ROUTES } from "@/lib/routes";

import { formatWhen, ROLLOUT_UNIT_LABELS } from "../lib/release-labels";
import { EnvironmentNote } from "./environment-note";

/** `/releases/configs` (ADR 087): every dynamic config the code declares, its values, rules and running experiment. */
export function DynamicConfigsList(): React.JSX.Element {
	const { api } = useAuth();
	const configs = api.featureFlags.configs.useQuery(undefined).data?.data.configs;
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold tracking-tight">Dynamic configs</h1>
				<p className="text-sm text-muted-foreground">
					A value the code reads instead of a fixed setting. You name the values it may take; rules (or a running experiment) decide who gets which. Never put a secret or
					personal data in a value.
				</p>
				<EnvironmentNote />
			</header>
			<Card>
				<CardHeader>
					<CardTitle>Configs</CardTitle>
					<CardDescription>Open one to see its values, rules and history.</CardDescription>
				</CardHeader>
				<CardContent className="overflow-x-auto">
					{configs === undefined ? (
						<Skeleton className="h-40 w-full rounded-xl" />
					) : (
						<Table aria-label="Dynamic configs">
							<TableHeader>
								<TableRow>
									<TableHead>Config</TableHead>
									<TableHead>Decided per</TableHead>
									<TableHead>Now</TableHead>
									<TableHead className="text-right">Reads, 24 h</TableHead>
									<TableHead>Last changed</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{configs.map((config): React.JSX.Element => (
									<TableRow key={config.key}>
										<TableCell>
											<Link href={ROUTES.releases.config(config.key)} className="font-medium hover:underline">
												{config.title}
											</Link>
											<p className="font-mono text-xs text-muted-foreground">{config.key}</p>
										</TableCell>
										<TableCell>{ROLLOUT_UNIT_LABELS[config.rolloutUnit]}</TableCell>
										<TableCell>
											<div className="flex flex-wrap gap-1.5">
												<StatusBadge tone="muted">{`${String(config.valueCount)} value${config.valueCount === 1 ? "" : "s"}`}</StatusBadge>
												<StatusBadge tone={config.ruleCount > 0 ? "info" : "muted"}>{`${String(config.ruleCount)} rule${config.ruleCount === 1 ? "" : "s"}`}</StatusBadge>
												{config.runningExperimentId === null ? null : <StatusBadge tone="info">Experiment running</StatusBadge>}
												{config.pendingRevision === null ? null : <StatusBadge tone="warning">Change waiting</StatusBadge>}
											</div>
										</TableCell>
										<TableCell className="text-right tabular-nums">{config.exposures24h.toLocaleString("en-GB")}</TableCell>
										<TableCell className="whitespace-nowrap">{formatWhen(config.updatedAt)}</TableCell>
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
