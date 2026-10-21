// What the reward editor's live preview says about a reward that is still
// being written: what is missing before it can be saved, and how its end date
// reads. Pure functions over the editor's values — the same shared schema that
// validates the form (and the API) decides what is missing, so the preview's
// checklist can never disagree with the save.

import { parseRewardDateInputToEpochMs, PLATFORM_DISPLAY_REGION, type LocationResponse, type MerchantRewardFormValues } from "@workspace/shared";
import { rewardEditorErrors, type RewardEditorField, type RewardEditorInput } from "@/contexts/rewards/lib/reward-editor-form";
import { describeRewardStores, type RewardStores } from "@/contexts/rewards/lib/presentation";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { z } from "zod";

/** The editor's sections, in page order — each is an anchor the preview's checklist links to. */
export const RewardEditorSectionIdSchema = z.enum(["reward-offer", "reward-photos", "reward-schedule", "reward-stores", "reward-terms"]);

export type RewardEditorSectionId = z.output<typeof RewardEditorSectionIdSchema>;

type RewardFormField = RewardEditorField;

/** One thing the reward still needs, in the merchant's words, and the section where it is fixed. */
export interface RewardDraftGap {
	readonly field: RewardFormField;
	readonly label: string;
	readonly sectionId: RewardEditorSectionId;
}

interface FieldGapCopy {
	readonly label: string;
	readonly sectionId: RewardEditorSectionId;
}

/** Every form field's gap, in the order the fields appear on the page. */
const FIELD_GAPS: Readonly<Record<RewardFormField, FieldGapCopy>> = {
	rewardType: { label: "Choose what kind of reward it is", sectionId: "reward-offer" },
	rewardValue: { label: "Set what the reward is worth", sectionId: "reward-offer" },
	minPurchase: { label: "Fix the minimum spend", sectionId: "reward-offer" },
	title: { label: "Give it a title", sectionId: "reward-offer" },
	description: { label: "Describe what customers get", sectionId: "reward-offer" },
	imageFileIds: { label: "Add at least one photo", sectionId: "reward-photos" },
	startDate: { label: "Pick a start date", sectionId: "reward-schedule" },
	expiryDate: { label: "End it on or after the start date", sectionId: "reward-schedule" },
	quantityTotal: { label: "Make at least one available", sectionId: "reward-schedule" },
	maxClaimsPerUser: { label: "Set how often a customer can claim it", sectionId: "reward-schedule" },
	locationScopeType: { label: "Choose where it can be redeemed", sectionId: "reward-stores" },
	locationIds: { label: "Pick at least one store", sectionId: "reward-stores" },
	termsConditions: { label: "Shorten the terms", sectionId: "reward-terms" },
};

/** The checklist's page order: the order the fields appear in the editor. */
const PAGE_ORDER: readonly RewardFormField[] = [
	"rewardType",
	"rewardValue",
	"minPurchase",
	"title",
	"description",
	"imageFileIds",
	"startDate",
	"expiryDate",
	"quantityTotal",
	"maxClaimsPerUser",
	"locationScopeType",
	"locationIds",
	"termsConditions",
];

/**
 * What the reward still needs before it can be saved, one entry per field, in
 * page order. Empty once the shared schema accepts the values.
 */
export function describeRewardDraftGaps(values: RewardEditorInput): readonly RewardDraftGap[] {
	const errors = rewardEditorErrors(values);
	return PAGE_ORDER.filter((field) => errors[field] !== undefined).map((field): RewardDraftGap => ({ field, ...FIELD_GAPS[field] }));
}

const DateInputSchema = z.iso.date();

/** "Ends 14 Nov 2026" for the form's end date; a prompt while no valid date is picked. */
export function formatDraftRewardEnd(expiryDate: string | undefined): string {
	const parsed = DateInputSchema.safeParse(expiryDate);
	if (!parsed.success) {
		return "No end date yet";
	}
	return `Ends ${formatEpochMs(parseRewardDateInputToEpochMs(parsed.data), "date", PLATFORM_DISPLAY_REGION)}`;
}

/** Where a reward still being written can be redeemed, named the way the catalog names it. */
export function describeDraftRewardStores(
	values: { readonly locationScopeType: MerchantRewardFormValues["locationScopeType"] | undefined; readonly locationIds: readonly string[] | undefined },
	locations: readonly Pick<LocationResponse, "id" | "name">[],
	tenantName: string | undefined,
): RewardStores {
	const locationScopeType = values.locationScopeType ?? "ALL_LOCATIONS";
	const locationIds = values.locationIds ?? [];
	const locationNames = locations.filter((location) => locationIds.includes(location.id)).map((location) => location.name);
	return describeRewardStores({ locationScopeType, locationIds: [...locationIds], locationNames, ...(tenantName === undefined ? {} : { tenantName }) });
}
