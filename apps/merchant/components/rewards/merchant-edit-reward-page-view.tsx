"use client";

import { MerchantRewardEditorPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import { MerchantCapabilityGate } from "@/components/access/merchant-capability-gate";
import { MerchantRewardEditorLayout, RewardPageBackLink } from "@/components/rewards/merchant-reward-editor-layout";
import { MerchantRewardFormFields } from "@/components/rewards/merchant-reward-form-fields";
import type { SavedRewardImage } from "@/components/rewards/merchant-reward-images-field";
import { MerchantRewardPreview } from "@/components/rewards/merchant-reward-preview";
import { MerchantRewardUnavailable } from "@/components/rewards/merchant-reward-unavailable";
import type { RewardVoucherCover } from "@/components/rewards/reward-voucher";
import { useActiveOrganizationId, useMerchantLocation } from "@/features/tenant-context/facade";
import { describeRewardStores } from "@/lib/rewards/presentation";
import { upsertMerchantRewardInListCache } from "@/lib/rewards/query-cache";
import { isRewardEditable, useMerchantReward } from "@/lib/rewards/use-merchant-reward";
import { orgRoutes } from "@/lib/routes";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/auth";
import {
	MERCHANT_CAPABILITY,
	mapMerchantUpdateRewardFormToInput,
	mapRewardResponseToFormValues,
	MerchantUpdateRewardFormSchema,
	type Envelope,
	type MerchantRewardFormValues,
	type RewardResponse,
} from "@workspace/shared";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import { toastMessage } from "@workspace/ui/components/toast";
import { cn } from "@workspace/ui/lib/core/utils";
import { Card } from "@workspace/ui/components/card";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";

export interface MerchantEditRewardPageViewProps {
	readonly orgSlug: string;
	readonly rewardId: string;
	/**
	 * The organization's reward list as the server fetched it (the API's own envelope). The API has no
	 * merchant reward-detail endpoint yet, so the page reads the reward out of the list.
	 */
	readonly initialRewards?: Envelope<RewardResponse[]> | undefined;
}

/** Edit-reward route — requires `merchant:manage_rewards` (the update endpoint); viewing a reward is its own page. */
export function MerchantEditRewardPageView(props: MerchantEditRewardPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.manageRewards} loading={<MerchantRewardEditorPageSkeleton />}>
			<MerchantEditRewardPageContent {...props} />
		</MerchantCapabilityGate>
	);
}

function MerchantEditRewardPageContent({ orgSlug, rewardId, initialRewards }: MerchantEditRewardPageViewProps): React.JSX.Element {
	const state = useMerchantReward(orgSlug, rewardId, initialRewards);
	const routes = orgRoutes(orgSlug);

	if (state.kind === "loading") {
		return <MerchantRewardEditorPageSkeleton />;
	}
	if (state.kind !== "ready") {
		return <MerchantRewardUnavailable state={state} rewardsHref={routes.rewards.list} />;
	}
	if (!isRewardEditable(state.reward.status)) {
		return <MerchantRewardLocked orgSlug={orgSlug} reward={state.reward} />;
	}
	return <MerchantRewardEditForm orgSlug={orgSlug} reward={state.reward} />;
}

interface MerchantRewardEditFormProps {
	readonly orgSlug: string;
	readonly reward: RewardResponse;
}

/** A live or ended reward keeps its offer: say so, and lead back to the reward. */
function MerchantRewardLocked({ orgSlug, reward }: MerchantRewardEditFormProps): React.JSX.Element {
	const detailHref = orgRoutes(orgSlug).rewards.detail(reward.id);
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
function MerchantRewardEditForm({ orgSlug, reward }: MerchantRewardEditFormProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const router = useRouter();
	const organizationId = useActiveOrganizationId();
	const { accessibleLocations } = useMerchantLocation();
	const routes = orgRoutes(orgSlug);
	const detailHref = routes.rewards.detail(reward.id);
	// The photos as the editor holds them: the first is the cover the preview draws.
	const [images, setImages] = React.useState<readonly RewardVoucherCover[]>(reward.images);
	const [cover] = images;
	const formValues = React.useMemo((): MerchantRewardFormValues => mapRewardResponseToFormValues(reward), [reward]);

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
		values: formValues,
		resetOptions: { keepDirtyValues: true },
	});

	const updateMutation = api.organizations.rewards.update.useMutation({
		onSuccess: (response): void => {
			upsertMerchantRewardInListCache(queryClient, orgSlug, response.data);
			toastMessage.success({ title: "Changes saved", description: "The reward shows your latest edits." });
			router.push(routes.rewards.detail(response.data.id), { scroll: false });
		},
		onError: (): void => {
			toastMessage.error({ title: "Changes not saved", description: "Check your connection and try again." });
		},
	});

	const handleImagesChange = React.useCallback(
		(nextImages: readonly SavedRewardImage[]): void => {
			setValue(
				"imageFileIds",
				nextImages.map((image) => image.fileId),
				{ shouldValidate: true, shouldDirty: true },
			);
			setImages(nextImages);
		},
		[setValue],
	);

	const { mutate } = updateMutation;
	const handleFormSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			void handleSubmit((form): void => {
				mutate({ orgSlug, rewardId: reward.id, ...mapMerchantUpdateRewardFormToInput(form) });
			})(event);
		},
		[handleSubmit, mutate, orgSlug, reward.id],
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
					register={register}
					control={control}
					errors={errors}
					setValue={setValue}
					organizationId={organizationId}
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
					control={control}
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
