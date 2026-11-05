"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { FeatureFlagModeSchema, PERMISSION, StoreFeatureFlagKeySchema, UpdateFeatureFlagSchema, type FeatureFlag, type FeatureFlagMode } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";

import { OptionSelectField } from "@/components/common/form-fields";
import { StoreOverridesSection } from "@/contexts/feature-flags/components/store-overrides-section";
import { toastMutationError } from "@/lib/api/mutation-error";

/** How each mode reads. */
export const MODE_LABELS: Readonly<Record<FeatureFlagMode, string>> = { DEFAULT: "Default", ON: "On", OFF: "Off", PERCENTAGE: "On for a share of people" };
const MODE_TONES: Readonly<Record<FeatureFlagMode, StatusTone>> = { DEFAULT: "muted", ON: "success", OFF: "neutral", PERCENTAGE: "info" };

function modeLabel(mode: FeatureFlagMode): string {
	return MODE_LABELS[mode];
}

/** What a flag's setting says, in a few words. */
export function describeSetting(flag: Pick<FeatureFlag, "mode" | "percentage">): string {
	return flag.mode === "PERCENTAGE" ? `On for ${String(flag.percentage ?? 0)}% of people` : MODE_LABELS[flag.mode];
}

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** `/settings/feature-flags` (enhancement 5.6): what each flag does, its default, its setting, and changing it. */
export function FeatureFlagsView(): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const flags = api.featureFlags.list.useQuery(undefined).data?.data.flags;
	const canChange = can(PERMISSION.FEATURE_FLAG.UPDATE);
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-1">
				<h2 className="text-xl font-semibold tracking-tight">Feature flags</h2>
				<p className="text-sm text-muted-foreground">
					Turn a feature on or off for this deployment, or on for a share of people, without a release. Default keeps what the deployment decides on its own. A store feature
					can also be set per merchant or per branch.
				</p>
			</header>
			{flags === undefined ? (
				<Skeleton className="h-48 w-full rounded-xl" />
			) : (
				flags.map((flag): React.JSX.Element => <FeatureFlagCard key={flag.key} flag={flag} canChange={canChange} />)
			)}
		</div>
	);
}

function FeatureFlagCard({ flag, canChange }: { readonly flag: FeatureFlag; readonly canChange: boolean }): React.JSX.Element {
	const titleId = React.useId();
	// A store flag (5.11) also has each store's own setting.
	const storeKey = StoreFeatureFlagKeySchema.safeParse(flag.key);
	return (
		<section aria-labelledby={titleId}>
			<Card>
				<CardHeader>
					<div className="flex flex-wrap items-center gap-2">
						<CardTitle id={titleId}>{flag.title}</CardTitle>
						<StatusBadge tone={MODE_TONES[flag.mode]}>{describeSetting(flag)}</StatusBadge>
					</div>
					<CardDescription>{flag.description}</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<dl className="grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
						<dt className="text-muted-foreground">Default comes from</dt>
						<dd>{flag.defaultFrom}</dd>
						{flag.updatedAt === null ? null : (
							<>
								<dt className="text-muted-foreground">Last changed</dt>
								<dd>
									{DATE.format(flag.updatedAt)}
									{flag.updatedByName === null ? "" : ` by ${flag.updatedByName}`}
									{flag.reason === null ? "" : `: ${flag.reason}`}
								</dd>
							</>
						)}
					</dl>
					{canChange ? <ChangeFlagForm flag={flag} /> : null}
					{storeKey.success ? <StoreOverridesSection flagKey={storeKey.data} title={flag.title} canChange={canChange} /> : null}
				</CardContent>
			</Card>
		</section>
	);
}

function ChangeFlagForm({ flag }: { readonly flag: FeatureFlag }): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [mode, setMode] = React.useState<FeatureFlagMode>(flag.mode);
	const [percentage, setPercentage] = React.useState(flag.percentage === null ? "" : String(flag.percentage));
	const [reason, setReason] = React.useState("");
	const percentageId = React.useId();
	const reasonId = React.useId();
	const update = api.featureFlags.update.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: `${flag.title}: saved` });
			setReason("");
			await queryClient.invalidateQueries({ queryKey: apiRouter.featureFlags.list.queryKey(undefined) });
		},
		onError: (error): void => {
			toastMutationError("Could not change the flag", error);
		},
	});
	const draft = { mode, percentage: mode === "PERCENTAGE" ? Number.parseInt(percentage, 10) : null, reason };
	const valid: boolean = UpdateFeatureFlagSchema.safeParse(draft).success && !update.isPending;
	const { mutate } = update;
	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			const parsed = UpdateFeatureFlagSchema.safeParse({ mode, percentage: mode === "PERCENTAGE" ? Number.parseInt(percentage, 10) : null, reason });
			if (parsed.success) {
				mutate({ key: flag.key, ...parsed.data });
			}
		},
		[flag.key, mode, mutate, percentage, reason],
	);
	const handlePercentage = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setPercentage(event.currentTarget.value);
	}, []);
	const handleReason = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setReason(event.currentTarget.value);
	}, []);
	return (
		<form className="flex flex-col gap-3 border-t border-border pt-4" onSubmit={handleSubmit} aria-label={`Change ${flag.title}`}>
			<div className="grid gap-3 sm:grid-cols-2">
				<OptionSelectField id={`${flag.key}-mode`} label="Setting" value={mode} options={FeatureFlagModeSchema.options} onChange={setMode} labelOf={modeLabel} />
				{mode === "PERCENTAGE" ? (
					<div className="flex flex-col gap-1.5">
						<Label htmlFor={percentageId}>Share of people (1–99%)</Label>
						<Input id={percentageId} type="number" inputMode="numeric" min={1} max={99} value={percentage} onChange={handlePercentage} />
					</div>
				) : null}
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={reasonId}>Why (kept in the audit log)</Label>
				<Input id={reasonId} value={reason} onChange={handleReason} placeholder="e.g. Trying it with a quarter of staff first" />
			</div>
			<div>
				<Button type="submit" size="sm" disabled={!valid}>
					Save
				</Button>
			</div>
		</form>
	);
}
