"use client";

import { MerchantInventoryBar, MerchantRewardStatusBadge } from "@/components/merchant-ui/reward-status";
import { MerchantRewardFormFields } from "@/components/rewards/merchant-reward-form-fields";
import { MerchantCapabilityGate, MerchantReadOnlyNotice } from "@/components/access/merchant-capability-gate";
import { invalidateMerchantRewardsListCache, upsertMerchantRewardInListCache } from "@/lib/rewards/query-cache";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { REWARDS_STALE_TIME_MS, retryTransientFailures, userSafeErrorMessage } from "@/lib/query/query-policy";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/auth";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import {
	MERCHANT_CAPABILITY,
	mapMerchantUpdateRewardFormToInput,
	mapRewardResponseToFormValues,
	MerchantUpdateRewardFormSchema,
	type Envelope,
	type MerchantRewardFormValues,
	type RewardResponse,
	type RewardType,
} from "@workspace/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { Button } from "@workspace/ui/components/form/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { orgRoutes } from "@/lib/routes";
import { ArrowLeft, BarChart3, Loader2, Save } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";

export interface MerchantEditRewardPageViewProps {
	readonly orgSlug: string;
	readonly rewardId: string;
	/**
	 * The organization's reward list as the server fetched it (the API's own envelope). The API has no
	 * merchant reward-detail endpoint yet, so the page reads the reward out of the list.
	 */
	readonly initialRewards?: Envelope<RewardResponse[]> | undefined;
}

const REWARD_LOAD_FAILED_MESSAGE = "This reward could not be loaded. Try again.";

function isRewardEditable(status: RewardResponse["status"]): boolean {
	return status === "DRAFT" || status === "PENDING_REVIEW";
}

/** Reward detail route — viewing needs `merchant:view_rewards`; edit/submit need `merchant:manage_rewards`. */
export function MerchantEditRewardPageView(props: MerchantEditRewardPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.viewRewards}>
			<MerchantEditRewardPageContent {...props} />
		</MerchantCapabilityGate>
	);
}

function MerchantEditRewardPageContent({ orgSlug, rewardId, initialRewards }: MerchantEditRewardPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const { can } = useAuthorization();

	// Seeded by the server and cached: no second fetch on mount (the server's answer is fresh).
	const rewardsQuery = api.organizations.rewards.list.useQuery(
		{ orgSlug },
		{
			...initialDataOption(initialRewards),
			staleTime: REWARDS_STALE_TIME_MS,
			retry: retryTransientFailures,
		},
	);
	const reward = rewardsQuery.data?.data.find((row) => row.id === rewardId);
	const isResolvingReward = reward === undefined && (rewardsQuery.isLoading || rewardsQuery.isFetching);
	const formValues = React.useMemo((): MerchantRewardFormValues | undefined => (reward === undefined ? undefined : mapRewardResponseToFormValues(reward)), [reward]);

	const {
		register,
		handleSubmit,
		setValue,
		control,
		formState: { errors },
	} = useForm<MerchantRewardFormValues>({
		resolver: zodResolver(MerchantUpdateRewardFormSchema),
		// The form follows the server's reward (no effect + reset): a refetch updates the fields the
		// merchant has not touched and keeps every unsaved edit.
		...(formValues === undefined ? {} : { values: formValues }),
		resetOptions: { keepDirtyValues: true },
	});

	const selectedType = useWatch({ control, name: "rewardType" });
	const canManageRewards = can(MERCHANT_CAPABILITY.manageRewards);
	const canEdit = canManageRewards && reward !== undefined && isRewardEditable(reward.status);
	const canPublish = canManageRewards && reward?.status === "DRAFT";
	const rewardsPath = orgRoutes(orgSlug).rewards.list;

	const updateMutation = api.organizations.rewards.update.useMutation({
		onSuccess: (response): void => {
			upsertMerchantRewardInListCache(queryClient, orgSlug, response.data);
			toastMessage.success({ title: "Reward updated", description: "Your changes have been saved." });
		},
		onError: (): void => {
			toastMessage.error({ title: "Update failed", description: "Could not save reward changes." });
		},
	});

	const publishMutation = api.organizations.rewards.publish.useMutation({
		onSuccess: (response): void => {
			upsertMerchantRewardInListCache(queryClient, orgSlug, response.data);
			toastMessage.success({ title: "Submitted for review", description: "Your reward is now pending approval." });
			void invalidateMerchantRewardsListCache(queryClient, orgSlug);
		},
		onError: (): void => {
			toastMessage.error({ title: "Submit failed", description: "Could not submit reward for review." });
		},
	});

	const handleTypeSelect = React.useCallback(
		(rewardType: RewardType): void => {
			setValue("rewardType", rewardType, { shouldValidate: true });
		},
		[setValue],
	);

	const onSubmit = React.useCallback(
		(form: MerchantRewardFormValues): void => {
			const payload = mapMerchantUpdateRewardFormToInput(form);
			void updateMutation.mutateAsync({ orgSlug, rewardId, ...payload });
		},
		[orgSlug, rewardId, updateMutation],
	);

	const handleFormSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			void handleSubmit(onSubmit)(event);
		},
		[handleSubmit, onSubmit],
	);

	const handleMaxClaimsChange = React.useCallback(
		(value: string | null): void => {
			if (value !== null) {
				setValue("maxClaimsPerUser", Number(value), { shouldValidate: true });
			}
		},
		[setValue],
	);

	const refetchRewards = rewardsQuery.refetch;
	const handleRetry = React.useCallback((): void => {
		void refetchRewards();
	}, [refetchRewards]);

	const handlePublish = React.useCallback((): void => {
		void publishMutation.mutateAsync({ orgSlug, rewardId });
	}, [orgSlug, publishMutation, rewardId]);

	if (isResolvingReward) {
		return <p className="text-sm text-muted-foreground">Loading reward…</p>;
	}

	if (reward === undefined && rewardsQuery.isError) {
		return (
			<div className="mx-auto space-y-6">
				<h1 className="text-2xl font-bold tracking-tight text-foreground">Could not load this reward</h1>
				<p role="alert" className="text-muted-foreground">
					{userSafeErrorMessage(rewardsQuery.error, REWARD_LOAD_FAILED_MESSAGE)}
				</p>
				<Button type="button" onClick={handleRetry}>
					Try again
				</Button>
			</div>
		);
	}

	if (reward === undefined) {
		return (
			<div className="mx-auto space-y-6">
				<h1 className="text-2xl font-bold tracking-tight text-foreground">Reward not found</h1>
				<p className="text-muted-foreground">This reward may have been removed or you may not have access.</p>
				<Link href={rewardsPath}>
					<Button type="button" variant="outline">
						Back to rewards
					</Button>
				</Link>
			</div>
		);
	}

	return (
		<div className="mx-auto space-y-6">
			<div className="mb-2 flex flex-wrap items-center gap-4">
				<Link href={rewardsPath}>
					<Button type="button" variant="ghost" size="icon" aria-label="Back to rewards">
						<ArrowLeft className="size-5" aria-hidden="true" />
					</Button>
				</Link>
				<div className="flex flex-1 flex-wrap items-center gap-3">
					<div>
						<h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">{canManageRewards ? "Edit Reward" : "View Reward"}</h1>
						<p className="mt-1 text-muted-foreground">{canEdit ? "Update your reward campaign details" : "View reward details and performance"}</p>
					</div>
					<MerchantRewardStatusBadge status={reward.status} />
				</div>
			</div>

			{canManageRewards ? null : <MerchantReadOnlyNotice>Your role can view this reward but not edit it or submit it for review.</MerchantReadOnlyNotice>}

			<form onSubmit={handleFormSubmit} className="space-y-6">
				<MerchantRewardFormFields
					register={register}
					control={control}
					errors={errors}
					setValue={setValue}
					selectedType={selectedType}
					onTypeSelect={handleTypeSelect}
					onMaxClaimsChange={handleMaxClaimsChange}
					readOnly={!canEdit}
				/>

				<Card className="border-border/80 bg-card shadow-xs">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<BarChart3 className="size-5 text-primary" aria-hidden="true" />
							Performance
						</CardTitle>
						<CardDescription>Claims, redemptions, and inventory for this reward</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<dl className="grid gap-4 sm:grid-cols-3">
							<div className="rounded-lg border border-border bg-background p-4">
								<dt className="text-xs tracking-wide text-muted-foreground uppercase">Claims</dt>
								<dd className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{reward.claimCount}</dd>
							</div>
							<div className="rounded-lg border border-border bg-background p-4">
								<dt className="text-xs tracking-wide text-muted-foreground uppercase">Redemptions</dt>
								<dd className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{reward.redemptionCount}</dd>
							</div>
							<div className="rounded-lg border border-border bg-background p-4">
								<dt className="text-xs tracking-wide text-muted-foreground uppercase">Category</dt>
								<dd className="mt-1 text-lg font-medium text-foreground capitalize">{reward.category}</dd>
							</div>
						</dl>
						<MerchantInventoryBar remaining={reward.quantityRemaining} total={reward.quantityTotal} />
					</CardContent>
				</Card>

				{canEdit ? (
					<div className="flex flex-wrap items-center justify-end gap-4">
						<Link href={rewardsPath}>
							<Button type="button" variant="outline">
								Cancel
							</Button>
						</Link>
						{canPublish ? (
							<Button type="button" variant="secondary" disabled={publishMutation.isPending} onClick={handlePublish}>
								{publishMutation.isPending ? "Submitting…" : "Submit for review"}
							</Button>
						) : null}
						<Button type="submit" disabled={updateMutation.isPending} className="gap-2">
							{updateMutation.isPending ? (
								<>
									<Loader2 className="size-4 animate-spin" aria-hidden="true" />
									Saving...
								</>
							) : (
								<>
									<Save className="size-4" aria-hidden="true" />
									Save changes
								</>
							)}
						</Button>
					</div>
				) : (
					<div className="flex justify-end">
						<Link href={rewardsPath}>
							<Button type="button" variant="outline">
								Back to rewards
							</Button>
						</Link>
					</div>
				)}
			</form>
		</div>
	);
}
