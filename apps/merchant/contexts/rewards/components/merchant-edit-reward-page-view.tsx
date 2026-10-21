"use client";

import { MerchantRewardEditorPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import { MerchantCapabilityGate } from "@/contexts/tenancy";
import { MerchantRewardEditorLayout, RewardPageBackLink } from "@/contexts/rewards/components/merchant-reward-editor-layout";
import { MerchantRewardFormFields } from "@/contexts/rewards/components/merchant-reward-form-fields";
import type { SavedRewardImage } from "@/contexts/rewards/components/merchant-reward-images-field";
import { MerchantRewardPreview } from "@/contexts/rewards/components/merchant-reward-preview";
import { MerchantRewardUnavailable } from "@/contexts/rewards/components/merchant-reward-unavailable";
import type { RewardVoucherCover } from "@/contexts/rewards/components/reward-voucher";
import { useMerchantLocation } from "@/features/tenant-context/facade";
import { describeRewardStores } from "@/contexts/rewards/lib/presentation";
import { applyMerchantRewardChange } from "@/contexts/rewards/lib/query-cache";
import { toRewardEditorInput, useRewardEditorForm, type RewardEditorInput } from "@/contexts/rewards/lib/reward-editor-form";
import { isRewardEditable, useMerchantReward } from "@/contexts/rewards/lib/use-merchant-reward";
import { tenantRoutes } from "@/lib/routes";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import {
	MERCHANT_CAPABILITY,
	mapMerchantUpdateRewardFormToInput,
	mapRewardResponseToFormValues,
	type Envelope,
	type MerchantRewardFormValues,
	type RewardResponse,
} from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import { toastMessage } from "@workspace/ui/components/toast";
import { cn } from "@workspace/ui/lib/core/utils";
import { Card } from "@workspace/ui/components/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

export interface MerchantEditRewardPageViewProps {
	readonly tenantSlug: string;
	readonly rewardId: string;
	/** The reward as the server fetched it (`GET /t/:tenantSlug/rewards/:rewardId`, the API's own envelope). */
	readonly initialReward?: Envelope<RewardResponse> | undefined;
}

/** Edit-reward route — requires `merchant:manage_rewards` (the update endpoint); viewing a reward is its own page. */
export function MerchantEditRewardPageView(props: MerchantEditRewardPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.manageRewards} loading={<MerchantRewardEditorPageSkeleton />}>
			<MerchantEditRewardPageContent {...props} />
		</MerchantCapabilityGate>
	);
}

function MerchantEditRewardPageContent({ tenantSlug, rewardId, initialReward }: MerchantEditRewardPageViewProps): React.JSX.Element {
	const state = useMerchantReward(tenantSlug, rewardId, initialReward);
	const routes = tenantRoutes(tenantSlug);

	if (state.kind === "loading") {
		return <MerchantRewardEditorPageSkeleton />;
	}
	if (state.kind !== "ready") {
		return <MerchantRewardUnavailable state={state} rewardsHref={routes.rewards.list} />;
	}
	if (!isRewardEditable(state.reward.status)) {
		return <MerchantRewardLocked tenantSlug={tenantSlug} reward={state.reward} />;
	}
	return <MerchantRewardEditForm tenantSlug={tenantSlug} reward={state.reward} />;
}

interface MerchantRewardEditFormProps {
	readonly tenantSlug: string;
	readonly reward: RewardResponse;
}

/** A live or ended reward keeps its offer: say so, and lead back to the reward. */
function MerchantRewardLocked({ tenantSlug, reward }: MerchantRewardEditFormProps): React.JSX.Element {
	const detailHref = tenantRoutes(tenantSlug).rewards.detail(reward.id);
	return (
		<div className="flex flex-col gap-6">
			<RewardPageBackLink href={detailHref} label="Back to reward" />
			<Card className="items-start gap-3 px-6 py-8">
				<h1 className="text-xl font-semibold tracking-tight text-foreground">{"This reward can't be edited"}</h1>
				<p className="max-w-prose text-sm text-muted-foreground">
					{"Customers may already hold it, so its offer stays as it was published. Rewards can be edited while they're drafts or in review."}
				</p>
				<Link href={detailHref} className={cn(buttonVariants({ variant: "outline" }))}>
					View reward
				</Link>
			</Card>
		</div>
	);
}

/** The editor, mounted once the reward is known: its fields start from the saved reward. */
function MerchantRewardEditForm({ tenantSlug, reward }: MerchantRewardEditFormProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const router = useRouter();
	const { accessibleLocations } = useMerchantLocation();
	const routes = tenantRoutes(tenantSlug);
	const detailHref = routes.rewards.detail(reward.id);
	// The photos as the editor holds them: the first is the cover the preview draws.
	const [images, setImages] = React.useState<readonly RewardVoucherCover[]>(reward.images);
	const [cover] = images;
	// The form follows the server's reward: a refetch is taken over while the merchant has not
	// touched the form, and every unsaved edit is kept once they have.
	const defaultValues = React.useMemo((): RewardEditorInput => toRewardEditorInput(mapRewardResponseToFormValues(reward)), [reward]);

	const updateMutation = api.tenants.rewards.update.useMutation({
		onSuccess: (response): void => {
			void applyMerchantRewardChange(queryClient, tenantSlug, response);
			toastMessage.success({ title: "Changes saved", description: "The reward shows your latest edits." });
			router.push(routes.rewards.detail(response.data.id), { scroll: false });
		},
		onError: (): void => {
			toastMessage.error({ title: "Changes not saved", description: "Check your connection and try again." });
		},
	});

	const { mutate } = updateMutation;
	const handleValid = React.useCallback(
		(form: MerchantRewardFormValues): void => {
			mutate({ tenantSlug, rewardId: reward.id, ...mapMerchantUpdateRewardFormToInput(form) });
		},
		[mutate, tenantSlug, reward.id],
	);
	const { editor, submit } = useRewardEditorForm<null>({ defaultValues, defaultMeta: null, onValid: handleValid });
	const { setField } = editor;

	const handleImagesChange = React.useCallback(
		(nextImages: readonly SavedRewardImage[]): void => {
			setField(
				"imageFileIds",
				nextImages.map((image) => image.fileId),
			);
			setImages(nextImages);
		},
		[setField],
	);

	const handleFormSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			void submit(null);
		},
		[submit],
	);

	const stores = describeRewardStores(reward);
	const isSaving = updateMutation.isPending;

	return (
		<MerchantRewardEditorLayout
			heading="Edit reward"
			description="Changes show in the preview as you make them. Nothing changes for customers until you save."
			back={{ href: detailHref, label: "Back to reward" }}
			status={reward.status}
			onSubmit={handleFormSubmit}
			fields={
				<MerchantRewardFormFields
					editor={editor}
					tenantSlug={tenantSlug}
					initialImages={reward.images}
					onImagesChange={handleImagesChange}
					stores={
						accessibleLocations.length > 1 ? (
							<p className="text-sm text-muted-foreground">
								<span className="font-medium text-foreground" title={stores.fullLabel}>
									{stores.label}.
								</span>{" "}
								Stores are set when a reward is created.
							</p>
						) : null
					}
					disabled={isSaving}
				/>
			}
			preview={
				<MerchantRewardPreview
					values={editor.values}
					category={reward.category}
					status={reward.status}
					cover={cover}
					stores={stores}
					activity={{ claimCount: reward.claimCount, redemptionCount: reward.redemptionCount }}
					actions={
						<div className="grid grid-cols-2 gap-2">
							<Link href={detailHref} className={cn(buttonVariants({ variant: "outline" }))}>
								Cancel
							</Link>
							<Button type="submit" disabled={isSaving}>
								{isSaving ? <Spinner className="size-4" aria-hidden="true" /> : null}
								{isSaving ? "Saving…" : "Save changes"}
							</Button>
						</div>
					}
				/>
			}
		/>
	);
}
