"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useAbility } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { ConfigRevisionContent, DynamicConfigDetail, DynamicConfigKey, Revision, SubjectContext } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Pencil } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";
import { ROUTES } from "@/lib/routes";

import { DECISION_SOURCE_LABELS, ROLLOUT_UNIT_LABELS } from "../lib/release-labels";
import { EnvironmentNote } from "./environment-note";
import { ExportRulesButton } from "./export-rules-button";
import { ExposureStatsCard } from "./exposure-stats-card";
import { PendingRevisionCard, RevisionHistoryCard } from "./revision-cards";
import { RulesSummary } from "./rules-summary";
import { SubjectCheckCard, type CheckOutcome } from "./subject-check-card";

const RELEASES_SCOPE: readonly string[] = ["admin", "releases"];
/** Indentation of a value shown to staff. */
const JSON_INDENT = 2;

function contentOf(revision: Revision | null): ConfigRevisionContent | null {
	return revision?.content.kind === "CONFIG" ? revision.content : null;
}

/** A config revision's named values and rules, read-only. */
function ConfigContentSummary({ content, now }: { readonly content: ConfigRevisionContent | null; readonly now: number }): React.JSX.Element {
	if (content === null) {
		return <p className="text-sm text-muted-foreground">No values yet: everyone gets the code default.</p>;
	}
	return (
		<div className="flex flex-col gap-4">
			<div className="grid gap-3 sm:grid-cols-2">
				{content.values.map((value): React.JSX.Element => (
					<div key={value.name} className="rounded-lg border border-border p-3">
						<p className="font-mono text-sm font-medium">{value.name}</p>
						<pre className="mt-1 overflow-x-auto text-xs text-muted-foreground">{JSON.stringify(value.value, null, JSON_INDENT)}</pre>
					</div>
				))}
			</div>
			<RulesSummary rules={content.rules} fallback="the code default" now={now} />
		</div>
	);
}

/** `/releases/configs/[key]` (ADR 087): one dynamic config, read-only: its values, rules, exposures and history. */
export function DynamicConfigDetailView({ configKey }: { readonly configKey: DynamicConfigKey }): React.JSX.Element {
	const { api } = useAuth();
	const config = api.featureFlags.config.useQuery({ key: configKey }).data?.data;
	const revisions = api.featureFlags.configRevisions.useQuery({ key: configKey }).data?.data.revisions;
	if (config === undefined) {
		return <Skeleton className="h-96 w-full rounded-xl" />;
	}
	return <ConfigDetailLoaded config={config} revisions={revisions} />;
}

function ConfigDetailLoaded({ config, revisions }: { readonly config: DynamicConfigDetail; readonly revisions: readonly Revision[] | undefined }): React.JSX.Element {
	const { api, user } = useAuth();
	const ability = useAbility();
	const queryClient = useQueryClient();
	const decide = api.featureFlags.decideConfigRevision.useMutation({
		onSuccess: async (): Promise<void> => {
			await queryClient.invalidateQueries({ queryKey: RELEASES_SCOPE });
		},
		onError: (error): void => {
			toastMutationError("Could not decide the change", error);
		},
	});
	const check = api.featureFlags.checkConfig.useMutation({
		onError: (error): void => {
			toastMutationError("Could not check", error);
		},
	});
	// The moment the page opened: a scheduled rollout's share now is worked out from it.
	const [now] = React.useState(Date.now);
	const pending = config.pending;
	const isOwnPending = pending !== null && pending.authorUserId !== null && pending.authorUserId === user?.id;
	const { mutateAsync: decideRevision } = decide;
	const decidePending = React.useCallback(
		async (approve: boolean, reason: string): Promise<void> => {
			if (pending !== null) {
				await decideRevision({ key: config.key, number: pending.number, decision: approve ? "APPROVE" : "REJECT", reason });
			}
		},
		[config.key, decideRevision, pending],
	);
	const [firstApp = "api"] = config.apps;
	const runCheck = React.useCallback(
		async (subject: SubjectContext): Promise<CheckOutcome> => {
			const result = (await check.mutateAsync({ key: config.key, subject })).data;
			return { value: `${result.result.valueName ?? "the code default"} · ${DECISION_SOURCE_LABELS[result.result.source]}`, trace: result.trace };
		},
		[check, config.key],
	);
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-semibold tracking-tight">{config.title}</h1>
					<p className="font-mono text-xs text-muted-foreground">{config.key}</p>
					<p className="max-w-3xl text-sm text-muted-foreground">{config.description}</p>
					<p className="text-sm text-muted-foreground">{`Decided per ${ROLLOUT_UNIT_LABELS[config.rolloutUnit].toLowerCase()} · read by ${config.apps.join(", ")}`}</p>
					<EnvironmentNote />
				</div>
				<div className="flex flex-wrap gap-2">
					{config.live === null ? null : <ExportRulesButton query={{ kind: "CONFIG", key: config.key }} />}
					{ability.can("UPDATE", "DYNAMIC_CONFIG") && pending === null ? (
						<Button render={<Link href={ROUTES.releases.editConfig(config.key)} />} nativeButton={false}>
							<Pencil className="size-4" />
							Edit values and rules
						</Button>
					) : null}
				</div>
			</header>
			{config.runningExperimentId === null ? null : (
				<p className="text-sm">
					An experiment is running on this config: its subjects get their variant ahead of the rules.{" "}
					<Link href={ROUTES.releases.experiments.detail(config.runningExperimentId)} className="font-medium underline">
						Open it
					</Link>
				</p>
			)}
			{pending === null ? null : (
				<PendingRevisionCard
					revision={pending}
					preview={<ConfigContentSummary content={contentOf(pending)} now={now} />}
					canDecide={ability.can("APPROVE", "DYNAMIC_CONFIG")}
					isOwn={isOwnPending}
					pending={decide.isPending}
					onDecide={decidePending}
				/>
			)}
			<Card>
				<CardHeader>
					<CardTitle>{config.live === null ? "Values and rules" : `Values and rules (revision ${String(config.live.number)})`}</CardTitle>
					<CardDescription>The code default when nothing decides: {JSON.stringify(config.defaultValue)}</CardDescription>
				</CardHeader>
				<CardContent>
					<ConfigContentSummary content={contentOf(config.live)} now={now} />
				</CardContent>
			</Card>
			<ExposureStatsCard stats={config.exposures} />
			<SubjectCheckCard idPrefix={`check-${config.key}`} defaultApp={firstApp} pending={check.isPending} onCheck={runCheck} />
			<RevisionHistoryCard revisions={revisions} />
		</div>
	);
}
