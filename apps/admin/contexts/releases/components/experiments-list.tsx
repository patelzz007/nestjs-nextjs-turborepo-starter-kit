"use client";

import { useAbility } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { Plus } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { ROUTES } from "@/lib/routes";

import { EXPERIMENT_STATUS_LABELS, EXPERIMENT_STATUS_TONES, formatWhen } from "../lib/release-labels";

/** `/releases/experiments` (ADR 087): experiments on dynamic configs, newest first. */
export function ExperimentsList(): React.JSX.Element {
	const { api } = useAuth();
	const ability = useAbility();
	const experiments = api.featureFlags.experiments.useQuery(undefined).data?.data.experiments;
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-semibold tracking-tight">Experiments</h1>
					<p className="text-sm text-muted-foreground">Split a dynamic config&apos;s audience between its values and compare what they do: claims, redemptions, sign-ins.</p>
				</div>
				{ability.can("UPDATE", "EXPERIMENT") ? (
					<Button render={<Link href={ROUTES.releases.experiments.create} />} nativeButton={false}>
						<Plus className="size-4" />
						Plan an experiment
					</Button>
				) : null}
			</header>
			<Card>
				<CardHeader>
					<CardTitle>Experiments</CardTitle>
					<CardDescription>One runs per config at a time. Results are worked out every hour.</CardDescription>
				</CardHeader>
				<CardContent className="overflow-x-auto">
					{experiments === undefined ? (
						<Skeleton className="h-40 w-full rounded-xl" />
					) : experiments.length === 0 ? (
						<p className="text-sm text-muted-foreground">No experiments yet.</p>
					) : (
						<Table aria-label="Experiments">
							<TableHeader>
								<TableRow>
									<TableHead>Experiment</TableHead>
									<TableHead>Config</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Started</TableHead>
									<TableHead>Stopped</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{experiments.map((experiment): React.JSX.Element => (
									<TableRow key={experiment.id}>
										<TableCell>
											<Link href={ROUTES.releases.experiments.detail(experiment.id)} className="font-medium hover:underline">
												{experiment.name}
											</Link>
											<p className="font-mono text-xs text-muted-foreground">{experiment.key}</p>
										</TableCell>
										<TableCell className="font-mono text-xs">{experiment.configKey}</TableCell>
										<TableCell>
											<StatusBadge tone={EXPERIMENT_STATUS_TONES[experiment.status]}>{EXPERIMENT_STATUS_LABELS[experiment.status]}</StatusBadge>
										</TableCell>
										<TableCell className="whitespace-nowrap">{formatWhen(experiment.startedAt)}</TableCell>
										<TableCell className="whitespace-nowrap">{formatWhen(experiment.stoppedAt)}</TableCell>
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
