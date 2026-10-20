"use client";

import { MerchantRewardEditorPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import { MerchantCapabilityGate } from "@/contexts/organizations";
import { MerchantRewardEditorLayout } from "@/contexts/rewards/components/merchant-reward-editor-layout";
import { MerchantRewardFormFields } from "@/contexts/rewards/components/merchant-reward-form-fields";
import type { SavedRewardImage } from "@/contexts/rewards/components/merchant-reward-images-field";
import { MerchantRewardLocationFields } from "@/contexts/rewards/components/merchant-reward-location-fields";
import { MerchantRewardPreview } from "@/contexts/rewards/components/merchant-reward-preview";
import type { RewardVoucherCover } from "@/contexts/rewards/components/reward-voucher";
import { useActiveOrganizationId, useActiveOrganizationName, useMerchantLocation } from "@/features/tenant-context/facade";
import { describeDraftRewardStores } from "@/contexts/rewards/lib/reward-draft";
import { applyMerchantRewardChange } from "@/contexts/rewards/lib/query-cache";
import { orgRoutes } from "@/lib/routes";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { useQueryClient } from "@tanstack/react-query";
import {
	MERCHANT_CAPABILITY,
	mapMerchantCreateRewardFormToInput,
	MerchantRewardFormFieldsSchema,
	type MerchantRewardFormValues,
	type RewardCategory,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import { toastMessage } from "@workspace/ui/components/toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format } from "date-fns";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

/** A new reward runs for this many days unless the merchant picks another end date. */
const DEFAULT_RUN_DAYS = 30;
/** A new reward starts with this many to give away. */
const DEFAULT_QUANTITY = 100;

/**
 * What the pressed save button asks for — its `value`. Saving a draft keeps the
 * reward private; submitting sends it to review (the API's `saveAsDraft: false`).
 */
const RewardSaveIntentSchema = z.enum(["draft", "review"]);

type RewardSaveIntent = z.output<typeof RewardSaveIntentSchema>;

/** The intent of the button that submitted the form; pressing Enter submits through the first one — "Save as draft". */
function resolveSaveIntent(submitter: HTMLElement | null): RewardSaveIntent {
	const parsed = RewardSaveIntentSchema.safeParse(submitter?.getAttribute("value"));
	return parsed.success ? parsed.data : RewardSaveIntentSchema.enum.draft;
}

function buildDefaultFormValues(activeLocationId: string | undefined, hasMultipleLocations: boolean): MerchantRewardFormValues {
	const startDate = new Date();
	const expiryDate = addDays(startDate, DEFAULT_RUN_DAYS);
	const limitToActiveStore = hasMultipleLocations && activeLocationId !== undefined;

	return {
		rewardType: "DISCOUNT",
		title: "",
		description: "",
		// Empty until a photo is uploaded — the schema then asks for one ("Add at least one image").
		imageFileIds: [],
		rewardValue: 0,
		startDate: format(startDate, "yyyy-MM-dd"),
		expiryDate: format(expiryDate, "yyyy-MM-dd"),
		quantityTotal: DEFAULT_QUANTITY,
		maxClaimsPerUser: 1,
		locationScopeType: limitToActiveStore ? "SELECTED" : "ALL_LOCATIONS",
		locationIds: limitToActiveStore ? [activeLocationId] : [],
	};
}

/** A reward not created yet has no claims or redemptions. */
const NO_ACTIVITY = { claimCount: 0, redemptionCount: 0 };

/** A new reward starts without photos. */
const NO_IMAGES: readonly SavedRewardImage[] = [];

export interface MerchantCreateRewardPageViewProps {
	readonly orgSlug: string;
	readonly defaultCategory: RewardCategory;
}

/** Create-reward route — requires `merchant:manage_rewards` (create endpoint); form hooks mount only when allowed. */
export function MerchantCreateRewardPageView(props: MerchantCreateRewardPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.manageRewards} loading={<MerchantRewardEditorPageSkeleton />}>
			<MerchantCreateRewardPageContent {...props} />
		</MerchantCapabilityGate>
	);
}

function MerchantCreateRewardPageContent({ orgSlug, defaultCategory }: MerchantCreateRewardPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const router = useRouter();
	const { locationId: activeLocationId, accessibleLocations } = useMerchantLocation();
	const organizationId = useActiveOrganizationId();
	const organizationName = useActiveOrganizationName();
	const hasMultipleLocations = accessibleLocations.length > 1;
	const routes = orgRoutes(orgSlug);
	const [cover, setCover] = React.useState<RewardVoucherCover | undefined>(undefined);

	const {
		register,
		handleSubmit,
		setValue,
		control,
		formState: { errors },
	} = useForm<MerchantRewardFormValues>({
		resolver: zodResolver(MerchantRewardFormFieldsSchema),
		defaultValues: buildDefaultFormValues(activeLocationId, hasMultipleLocations),
	});

	const locationScopeType = useWatch({ control, name: "locationScopeType" });
	const locationIds = useWatch({ control, name: "locationIds" });
	const stores = React.useMemo(
		() => describeDraftRewardStores({ locationScopeType, locationIds }, accessibleLocations, organizationName),
		[accessibleLocations, locationIds, locationScopeType, organizationName],
	);

	const createMutation = api.organizations.rewards.create.useMutation({
		onSuccess: (response, input): void => {
			void applyMerchantRewardChange(queryClient, orgSlug, response);
			toastMessage.success(
				input.saveAsDraft
					? { title: "Draft saved", description: "Only your team can see it until you submit it for review." }
					: { title: "Submitted for review", description: "It's reviewed before it goes live." },
			);
			router.push(routes.rewards.detail(response.data.id), { scroll: false });
		},
		onError: (): void => {
			toastMessage.error({ title: "Reward not saved", description: "Check your connection and try again." });
		},
	});

	const handleImagesChange = React.useCallback(
		(images: readonly SavedRewardImage[]): void => {
			setValue(
				"imageFileIds",
				images.map((image) => image.fileId),
				{ shouldValidate: true, shouldDirty: true },
			);
			const [first] = images;
			setCover(first);
		},
		[setValue],
	);

	const { mutate } = createMutation;
	const handleFormSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			const saveAsDraft = resolveSaveIntent(event.submitter) === "draft";
			void handleSubmit((form): void => {
				mutate({ orgSlug, ...mapMerchantCreateRewardFormToInput({ ...form, saveAsDraft }, defaultCategory) });
			})(event);
		},
		[defaultCategory, handleSubmit, mutate, orgSlug],
	);

	const isSaving = createMutation.isPending;
	const savingIntent: RewardSaveIntent | undefined = isSaving ? (createMutation.variables.saveAsDraft ? "draft" : "review") : undefined;

	return (
		<MerchantRewardEditorLayout
			heading="New reward"
			description="Fill in the offer and watch it take shape. Save it as a draft, or submit it for review when it's ready."
			back={{ href: routes.rewards.list, label: "Rewards" }}
			onSubmit={handleFormSubmit}
			fields={
				<MerchantRewardFormFields
					register={register}
					control={control}
					errors={errors}
					setValue={setValue}
					organizationId={organizationId}
					initialImages={NO_IMAGES}
					onImagesChange={handleImagesChange}
					stores={hasMultipleLocations ? <MerchantRewardLocationFields control={control} errors={errors} setValue={setValue} disabled={isSaving} /> : null}
					disabled={isSaving}
				/>
			}
			preview={
				<MerchantRewardPreview
					control={control}
					category={defaultCategory}
					status={undefined}
					cover={cover}
					stores={stores}
					activity={NO_ACTIVITY}
					actions={
						<div className="grid grid-cols-2 gap-2">
							{/* "Save as draft" comes first, so pressing Enter in a field saves privately rather than submitting. */}
							<Button type="submit" value={RewardSaveIntentSchema.enum.draft} variant="outline" disabled={isSaving}>
								{savingIntent === "draft" ? <Spinner className="size-4" aria-hidden="true" /> : null}
								{savingIntent === "draft" ? "Saving…" : "Save as draft"}
							</Button>
							<Button type="submit" value={RewardSaveIntentSchema.enum.review} disabled={isSaving}>
								{savingIntent === "review" ? <Spinner className="size-4" aria-hidden="true" /> : null}
								{savingIntent === "review" ? "Submitting…" : "Submit for review"}
							</Button>
						</div>
					}
				/>
			}
		/>
	);
}
