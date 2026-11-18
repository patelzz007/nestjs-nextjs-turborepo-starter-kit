"use client";

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useAbility } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { EXPERIMENT_METRIC_REGISTRY, StopExperimentSchema, type ExperimentDetail, type ExperimentMetricResult } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { toastMessage } from "@workspace/ui/components/toast";
import { Pencil } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { TextField, useFormSubmitHandler } from "@/components/common/form-fields";
import { toastMutationError } from "@/lib/api/mutation-error";
import { ROUTES } from "@/lib/routes";

import { EXPERIMENT_STATUS_LABELS, EXPERIMENT_STATUS_TONES, formatWhen } from "../lib/release-labels";
import { ReasonActionForm } from "./reason-action-form";

const RELEASES_SCOPE: readonly string[] = ["admin", "releases"];
const DECIMALS = 2;

function figure(value: number | null): string {
	return value === null ? "—" : value.toFixed(DECIMALS);
}

/** `/releases/experiments/[id]` (ADR 087): one experiment: its plan, results per metric, starting and stopping it. */
export function ExperimentDetailView({ experimentId }: { readonly experimentId: string }): React.JSX.Element {
	const { api } = useAuth();
	const experiment = api.featureFlags.experiment.useQuery({ experimentId }).data?.data;
	if (experiment === undefined) {
		return <Skeleton className="h-96 w-full rounded-xl" />;
	}
	return <ExperimentLoaded experiment={experiment} />;
}

function MetricResults({ metric, rows, control }: { readonly metric: string; readonly rows: readonly ExperimentMetricResult[]; readonly control: string }): React.JSX.Element {
	return (
		<Table aria-label={`Results: ${metric}`}>
			<TableHeader>
				<TableRow>
					<TableHead>Variant</TableHead>
					<TableHead className="text-right">People</TableHead>
					<TableHead className="text-right">Per person</TableHead>
					<TableHead className="text-right">Difference</TableHead>
					<TableHead>95% interval</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{rows.map((row): React.JSX.Element => (
					<TableRow key={row.valueName}>
						<TableCell className="font-mono text-xs">
							{row.valueName}
							{row.valueName === control ? <span className="ml-2 text-muted-foreground">(control)</span> : null}
						</TableCell>
						<TableCell className="text-right tabular-nums">{row.subjects.toLocaleString("en-GB")}</TableCell>
						<TableCell className="text-right tabular-nums">{figure(row.mean)}</TableCell>
						<TableCell className="text-right tabular-nums">{figure(row.delta)}</TableCell>
						<TableCell>
							{row.ciLow === null || row.ciHigh === null ? "—" : `${figure(row.ciLow)} to ${figure(row.ciHigh)}`}
							{row.significant ? (
								<StatusBadge tone={(row.delta ?? 0) > 0 ? "success" : "danger"} className="ml-2">
									Clear difference
								</StatusBadge>
							) : null}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

function ExperimentLoaded({ experiment }: { readonly experiment: ExperimentDetail }): React.JSX.Element {
	const { api } = useAuth();
	const ability = useAbility();
	const queryClient = useQueryClient();
	const canChange = ability.can("UPDATE", "EXPERIMENT");
	const refresh = async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: RELEASES_SCOPE });
	};
	const start = api.featureFlags.startExperiment.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: `${experiment.name} is running` });
			await refresh();
		},
		onError: (error): void => {
			toastMutationError("Could not start the experiment", error);
		},
	});
	const { mutateAsync: startAsync } = start;
	const startExperiment = React.useCallback(
		async (reason: string): Promise<void> => {
			await startAsync({ experimentId: experiment.id, reason });
		},
		[experiment.id, startAsync],
	);
	const stop = api.featureFlags.stopExperiment.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: `${experiment.name} stopped` });
			await refresh();
		},
		onError: (error): void => {
			toastMutationError("Could not stop the experiment", error);
		},
	});
	const { mutateAsync: stopAsync } = stop;
	const stopForm = useForm({
		defaultValues: { reason: "", conclusion: "" },
		validators: { onSubmit: StopExperimentSchema },
		onSubmit: async ({ value }): Promise<void> => {
			await stopAsync({ experimentId: experiment.id, ...StopExperimentSchema.parse(value) });
		},
	});
	const submitStop = React.useCallback((): Promise<void> => stopForm.handleSubmit(), [stopForm]);
	const handleStop = useFormSubmitHandler(submitStop);
	const metrics = [experiment.primaryMetric, ...experiment.guardrailMetrics];
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="flex flex-col gap-1">
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="text-2xl font-semibold tracking-tight">{experiment.name}</h1>
						<StatusBadge tone={EXPERIMENT_STATUS_TONES[experiment.status]}>{EXPERIMENT_STATUS_LABELS[experiment.status]}</StatusBadge>
					</div>
					<p className="font-mono text-xs text-muted-foreground">{experiment.key}</p>
					<p className="max-w-3xl text-sm">{experiment.hypothesis}</p>
					<p className="text-sm text-muted-foreground">
						{`On `}
						<Link href={ROUTES.releases.config(experiment.configKey)} className="underline">
							{experiment.configKey}
						</Link>
						{` · ${String(experiment.trafficPercentage)}% of its audience · ${experiment.variants.map((variant) => `${variant.valueName} ${String(variant.allocation)}%`).join(", ")} · started ${formatWhen(experiment.startedAt)} · planned end ${formatWhen(experiment.plannedEndAt)}`}
					</p>
				</div>
				{canChange && experiment.status === "DRAFT" ? (
					<Button render={<Link href={ROUTES.releases.experiments.edit(experiment.id)} />} nativeButton={false} variant="outline">
						<Pencil className="size-4" />
						Edit the plan
					</Button>
				) : null}
			</header>
			{experiment.conclusion === null ? null : (
				<Card>
					<CardHeader>
						<CardTitle>Conclusion</CardTitle>
						<CardDescription>{`Stopped ${formatWhen(experiment.stoppedAt)}`}</CardDescription>
					</CardHeader>
					<CardContent className="text-sm">{experiment.conclusion}</CardContent>
				</Card>
			)}
			<Card>
				<CardHeader>
					<CardTitle>Results</CardTitle>
					<CardDescription>{`Each person counts the times it happened while they took part. Worked out ${formatWhen(experiment.results.computedAt)}.`}</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-6">
					{experiment.results.results.length === 0 ? (
						<p className="text-sm text-muted-foreground">No results yet: they appear within an hour of people taking part.</p>
					) : (
						metrics.map((metric, index): React.JSX.Element => (
							<div key={metric} className="flex flex-col gap-2">
								<h3 className="text-sm font-medium">{`${EXPERIMENT_METRIC_REGISTRY[metric].title}${index === 0 ? " (primary)" : " (guardrail)"}`}</h3>
								<MetricResults metric={metric} rows={experiment.results.results.filter((row) => row.metric === metric)} control={experiment.controlValueName} />
							</div>
						))
					)}
				</CardContent>
			</Card>
			{canChange && experiment.status === "DRAFT" ? (
				<Card>
					<CardHeader>
						<CardTitle>Start it</CardTitle>
						<CardDescription>Its people get their variant at once, ahead of the config&apos;s rules.</CardDescription>
					</CardHeader>
					<CardContent>
						<ReasonActionForm
							id={`start-${experiment.id}`}
							label="Why start now"
							submitLabel="Start experiment"
							placeholder="e.g. Design signed off the bold button"
							pending={start.isPending}
							onSubmit={startExperiment}
						/>
					</CardContent>
				</Card>
			) : null}
			{canChange && experiment.status === "RUNNING" ? (
				<Card>
					<CardHeader>
						<CardTitle>Stop it</CardTitle>
						<CardDescription>Everyone gets the config&apos;s rules again. Write down what you learned.</CardDescription>
					</CardHeader>
					<CardContent>
						<form noValidate className="flex max-w-2xl flex-col gap-3" onSubmit={handleStop}>
							<stopForm.Field name="conclusion">
								{(field) => (
									<TextField
										id="stop-conclusion"
										label="Conclusion"
										multiline
										value={field.state.value}
										onChange={field.handleChange}
										onBlur={field.handleBlur}
										errors={field.state.meta.errors}
									/>
								)}
							</stopForm.Field>
							<stopForm.Field name="reason">
								{(field) => (
									<TextField
										id="stop-reason"
										label="Why stop now"
										value={field.state.value}
										onChange={field.handleChange}
										onBlur={field.handleBlur}
										errors={field.state.meta.errors}
										placeholder="e.g. Reached the planned two weeks"
									/>
								)}
							</stopForm.Field>
							<div>
								<Button type="submit" size="sm" variant="destructive" disabled={stop.isPending}>
									Stop experiment
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
