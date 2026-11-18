"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useAbility } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { FeatureFlagDetail, FeatureFlagKey, FlagRule, Revision, SubjectContext } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { toastMessage } from "@workspace/ui/components/toast";
import { Pencil } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";
import { ROUTES } from "@/lib/routes";

import { DECISION_SOURCE_LABELS, formatWhen, READY_TO_REMOVE_LABELS, ROLLOUT_UNIT_LABELS } from "../lib/release-labels";
import { EnvironmentNote } from "./environment-note";
import { ExportRulesButton } from "./export-rules-button";
import { ExposureStatsCard } from "./exposure-stats-card";
import { OverridesCard, type OverrideInput } from "./overrides-card";
import { ReasonActionForm } from "./reason-action-form";
import { PendingRevisionCard, RevisionHistoryCard } from "./revision-cards";
import { RulesSummary } from "./rules-summary";
import { SubjectCheckCard, type CheckOutcome } from "./subject-check-card";

const RELEASES_SCOPE: readonly string[] = ["admin", "releases"];

function rulesOf(revision: Revision | null): readonly FlagRule[] {
	return revision?.content.kind === "FLAG" ? revision.content.rules : [];
}

/** `/releases/flags/[key]` (ADR 087): one flag, read-only, with its controls that never wait (kill switch, overrides). */
export function FeatureFlagDetailView({ flagKey }: { readonly flagKey: FeatureFlagKey }): React.JSX.Element {
	const { api } = useAuth();
	const detail = api.featureFlags.detail.useQuery({ key: flagKey }).data?.data;
	const revisions = api.featureFlags.revisions.useQuery({ key: flagKey }).data?.data.revisions;
	if (detail === undefined) {
		return <Skeleton className="h-96 w-full rounded-xl" />;
	}
	return <FlagDetailLoaded flag={detail} revisions={revisions} />;
}

function FlagDetailLoaded({ flag, revisions }: { readonly flag: FeatureFlagDetail; readonly revisions: readonly Revision[] | undefined }): React.JSX.Element {
	const { api, user } = useAuth();
	const ability = useAbility();
	const queryClient = useQueryClient();
	const canChange = ability.can("UPDATE", "FEATURE_FLAG");
	const refresh = React.useCallback(async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: RELEASES_SCOPE });
	}, [queryClient]);
	const onError =
		(title: string) =>
		(error: Error): void => {
			toastMutationError(title, error);
		};
	const killSwitch = api.featureFlags.setKillSwitch.useMutation({ onSuccess: refresh, onError: onError("Could not change the kill switch") });
	const setOverride = api.featureFlags.setOverride.useMutation({ onSuccess: refresh, onError: onError("Could not set the override") });
	const removeOverride = api.featureFlags.removeOverride.useMutation({ onSuccess: refresh, onError: onError("Could not remove the override") });
	const decide = api.featureFlags.decideRevision.useMutation({ onSuccess: refresh, onError: onError("Could not decide the change") });
	const check = api.featureFlags.check.useMutation({ onError: onError("Could not check") });
	// The moment the page opened: a scheduled rollout's share now is worked out from it.
	const [now] = React.useState(Date.now);
	const fallback = `${flag.defaultOn ? "On" : "Off"} (the code default)`;
	const pending = flag.pending;
	const isOwnPending = pending !== null && pending.authorUserId !== null && pending.authorUserId === user?.id;
	const { mutateAsync: decideRevision } = decide;
	const { mutateAsync: putOverride } = setOverride;
	const { mutateAsync: dropOverride } = removeOverride;
	const decidePending = React.useCallback(
		async (approve: boolean, reason: string): Promise<void> => {
			if (pending !== null) {
				await decideRevision({ key: flag.key, number: pending.number, decision: approve ? "APPROVE" : "REJECT", reason });
			}
		},
		[decideRevision, flag.key, pending],
	);
	const saveOverride = React.useCallback(
		async (override: OverrideInput): Promise<void> => {
			await putOverride({ key: flag.key, ...override });
		},
		[flag.key, putOverride],
	);
	const deleteOverride = React.useCallback(
		async (overrideId: string, reason: string): Promise<void> => {
			await dropOverride({ key: flag.key, overrideId, reason });
		},
		[dropOverride, flag.key],
	);
	// "Check a subject" starts from the first app that reads the flag.
	const [firstApp = "api"] = flag.apps;

	const throwOrRelease = React.useCallback(
		async (reason: string): Promise<void> => {
			await killSwitch.mutateAsync({ key: flag.key, on: !flag.killSwitch.on, reason });
			toastMessage.success({ title: flag.killSwitch.on ? `${flag.title} follows its rules again` : `${flag.title} is off for everyone` });
		},
		[flag.key, flag.killSwitch.on, flag.title, killSwitch],
	);
	const runCheck = React.useCallback(
		async (subject: SubjectContext): Promise<CheckOutcome> => {
			const result = (await check.mutateAsync({ key: flag.key, subject })).data;
			return { value: `${result.result.on ? "On" : "Off"} · ${DECISION_SOURCE_LABELS[result.result.source]}`, trace: result.trace };
		},
		[check, flag.key],
	);

	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-semibold tracking-tight">{flag.title}</h1>
					<p className="font-mono text-xs text-muted-foreground">{flag.key}</p>
					<p className="max-w-3xl text-sm text-muted-foreground">{flag.description}</p>
					<p className="text-sm text-muted-foreground">
						{`Decided per ${ROLLOUT_UNIT_LABELS[flag.rolloutUnit].toLowerCase()} · read by ${flag.apps.join(", ")} · ${flag.exposures24h.toLocaleString("en-GB")} checks in the last day`}
					</p>
					{flag.readyToRemove === null ? null : <StatusBadge tone="warning">{`Ready to remove from code · ${READY_TO_REMOVE_LABELS[flag.readyToRemove]}`}</StatusBadge>}
					<EnvironmentNote />
				</div>
				<div className="flex flex-wrap gap-2">
					{flag.live === null ? null : <ExportRulesButton query={{ kind: "FLAG", key: flag.key }} />}
					{canChange && pending === null ? (
						<Button render={<Link href={ROUTES.releases.editFlag(flag.key)} />} nativeButton={false}>
							<Pencil className="size-4" />
							Edit rules
						</Button>
					) : null}
				</div>
			</header>

			<Card className={flag.killSwitch.on ? "border-destructive/50" : undefined}>
				<CardHeader>
					<CardTitle>Kill switch</CardTitle>
					<CardDescription>
						{flag.killSwitch.on
							? `Thrown ${formatWhen(flag.killSwitch.changedAt)}${flag.killSwitch.changedByName === null ? "" : ` by ${flag.killSwitch.changedByName}`}: ${flag.killSwitch.reason ?? ""}. Off for everyone, overrides included.`
							: "Turns the flag off for everyone at once, ahead of every override and rule. It never waits for approval."}
					</CardDescription>
				</CardHeader>
				{canChange ? (
					<CardContent>
						<ReasonActionForm
							id={`kill-${flag.key}`}
							label={flag.killSwitch.on ? "Why release it" : "Why throw it"}
							submitLabel={flag.killSwitch.on ? "Release the kill switch" : "Throw the kill switch"}
							placeholder={flag.killSwitch.on ? "e.g. The fix is deployed" : "e.g. Redemptions are failing at the tills"}
							destructive={!flag.killSwitch.on}
							pending={killSwitch.isPending}
							onSubmit={throwOrRelease}
						/>
					</CardContent>
				) : null}
			</Card>

			{pending === null ? null : (
				<PendingRevisionCard
					revision={pending}
					preview={<RulesSummary rules={rulesOf(pending)} fallback={fallback} now={now} />}
					canDecide={ability.can("APPROVE", "FEATURE_FLAG")}
					isOwn={isOwnPending}
					pending={decide.isPending}
					onDecide={decidePending}
				/>
			)}

			<Card>
				<CardHeader>
					<CardTitle>{flag.live === null ? "Rules" : `Rules (revision ${String(flag.live.number)})`}</CardTitle>
					<CardDescription>Tried in order; the first rule a subject matches decides, and its share picks who gets it.</CardDescription>
				</CardHeader>
				<CardContent>
					<RulesSummary rules={rulesOf(flag.live)} fallback={fallback} now={now} />
				</CardContent>
			</Card>

			<OverridesCard
				flagTitle={flag.title}
				overrides={flag.overrides}
				canChange={canChange}
				pending={setOverride.isPending || removeOverride.isPending}
				onSet={saveOverride}
				onRemove={deleteOverride}
			/>

			<ExposureStatsCard stats={flag.exposures} />
			<SubjectCheckCard idPrefix={`check-${flag.key}`} defaultApp={firstApp} pending={check.isPending} onCheck={runCheck} />
			<RevisionHistoryCard revisions={revisions} />
		</div>
	);
}
