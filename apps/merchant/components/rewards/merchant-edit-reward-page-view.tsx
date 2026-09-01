"use client";

import { MerchantInventoryBar, MerchantRewardStatusBadge } from "@/components/merchant-ui/reward-status";
import { MerchantRewardFormFields } from "@/components/rewards/merchant-reward-form-fields";
import { stubApiMeta } from "@/lib/api-envelope";
import { useAuth } from "@workspace/client/lib/auth";
import {
	mapMerchantUpdateRewardFormToInput,
	mapRewardResponseToFormValues,
	MerchantUpdateRewardFormSchema,
	type MerchantRewardFormValues,
	type RewardResponse,
	type RewardType,
} from "@workspace/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { Button } from "@workspace/ui/components/form/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, BarChart3, Loader2, Save } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";

export interface MerchantEditRewardPageViewProps {
	readonly rewardId: string;
	readonly initialRewards?: readonly RewardResponse[];
}

function isRewardEditable(status: RewardResponse["status"]): boolean {
	return status === "DRAFT" || status === "PENDING_REVIEW";
}

export function MerchantEditRewardPageView({ rewardId, initialRewards }: MerchantEditRewardPageViewProps): React.JSX.Element {
	const { api } = useAuth();

	const initialQueryData = React.useMemo(
		() =>
			initialRewards !== undefined
				? {
						success: true as const,
						data: [...initialRewards],
						meta: stubApiMeta(),
					}
				: undefined,
		[initialRewards],
	);

	const rewardsQuery = api.merchant.rewards.list.useQuery(
		{},
		{
			initialData: initialQueryData,
		},
	);
	const reward = rewardsQuery.data?.data.find((row) => row.id === rewardId);

	const {
		register,
		handleSubmit,
		setValue,
		control,
		reset,
		formState: { errors },
	} = useForm<MerchantRewardFormValues>({
		resolver: zodResolver(MerchantUpdateRewardFormSchema),
	});

	React.useEffect((): void => {
		if (reward !== undefined) {
			reset(mapRewardResponseToFormValues(reward));
		}
	}, [reward, reset]);

	const selectedType = useWatch({ control, name: "rewardType" });
	const canEdit = reward !== undefined && isRewardEditable(reward.status);
	const canPublish = reward?.status === "DRAFT";

	const updateMutation = api.merchant.rewards.update.useMutation({
		onSuccess: (): void => {
			toastMessage.success({ title: "Reward updated", description: "Your changes have been saved." });
			void rewardsQuery.refetch();
		},
		onError: (): void => {
			toastMessage.error({ title: "Update failed", description: "Could not save reward changes." });
		},
	});

	const publishMutation = api.merchant.rewards.publish.useMutation({
		onSuccess: (): void => {
			toastMessage.success({ title: "Submitted for review", description: "Your reward is now pending approval." });
			void rewardsQuery.refetch();
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
			void updateMutation.mutateAsync({ rewardId, ...payload });
		},
		[rewardId, updateMutation],
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

	const handlePublish = React.useCallback((): void => {
		void publishMutation.mutateAsync({ rewardId });
	}, [publishMutation, rewardId]);

	if (rewardsQuery.isLoading && initialRewards === undefined) {
		return <p className="text-sm text-muted-foreground">Loading reward…</p>;
	}

	if (reward === undefined) {
		return (
			<div className="mx-auto space-y-6">
				<h1 className="text-2xl font-bold tracking-tight text-foreground">Reward not found</h1>
				<p className="text-muted-foreground">This reward may have been removed or you may not have access.</p>
				<Link href="/rewards">
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
				<Link href="/rewards">
					<Button type="button" variant="ghost" size="icon" aria-label="Back to rewards">
						<ArrowLeft className="size-5" aria-hidden="true" />
					</Button>
				</Link>
				<div className="flex flex-1 flex-wrap items-center gap-3">
					<div>
						<h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">Edit Reward</h1>
						<p className="mt-1 text-muted-foreground">{canEdit ? "Update your reward campaign details" : "View reward details and performance"}</p>
					</div>
					<MerchantRewardStatusBadge status={reward.status} />
				</div>
			</div>

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
						<Link href="/rewards">
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
						<Link href="/rewards">
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
