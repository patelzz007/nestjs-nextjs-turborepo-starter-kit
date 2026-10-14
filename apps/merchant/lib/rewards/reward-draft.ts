// What the reward editor's live preview says about a reward that is still
// being written: what is missing before it can be saved, and how its end date
// reads. Pure functions over the form's values — the same shared schema that
// validates the form (and the API) decides what is missing, so the preview's
// checklist can never disagree with the save.

import {
	MerchantRewardFormFieldsSchema,
	parseRewardDateInputToEpochMs,
	PLATFORM_DISPLAY_REGION,
	type MerchantRewardFormValues,
	type OrganizationLocationResponse,
} from "@workspace/shared";
import { describeRewardStores, type RewardStores } from "@/lib/rewards/presentation";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { z } from "zod";

/** The editor's sections, in page order — each is an anchor the preview's checklist links to. */
export const RewardEditorSectionIdSchema = z.enum(["reward-offer", "reward-photos", "reward-schedule", "reward-stores", "reward-terms"]);

export type RewardEditorSectionId = z.output<typeof RewardEditorSectionIdSchema>;

type RewardFormField = keyof MerchantRewardFormValues;

const RewardFormFieldSchema = MerchantRewardFormFieldsSchema.keyof();

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

/** `FIELD_GAPS`' keys, read back as fields: the page order of the checklist. */
const PAGE_ORDER: readonly RewardFormField[] = Object.keys(FIELD_GAPS).flatMap((key): RewardFormField[] => {
	const parsed = RewardFormFieldSchema.safeParse(key);
	return parsed.success ? [parsed.data] : [];
});

/**
 * What the reward still needs before it can be saved, one entry per field, in
 * page order. Empty once the shared schema accepts the values.
 */
export function describeRewardDraftGaps(values: Readonly<Partial<MerchantRewardFormValues>>): readonly RewardDraftGap[] {
	const result = MerchantRewardFormFieldsSchema.safeParse(values);
	if (result.success) {
		return [];
	}
	const failing = new Set<RewardFormField>(
		result.error.issues.flatMap((issue): RewardFormField[] => {
			const [field] = issue.path;
			const parsed = RewardFormFieldSchema.safeParse(field);
			return parsed.success ? [parsed.data] : [];
		}),
	);
	return PAGE_ORDER.filter((field) => failing.has(field)).map((field): RewardDraftGap => ({ field, ...FIELD_GAPS[field] }));
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
	locations: readonly Pick<OrganizationLocationResponse, "id" | "name">[],
	organizationName: string | undefined,
): RewardStores {
	const locationScopeType = values.locationScopeType ?? "ALL_LOCATIONS";
	const locationIds = values.locationIds ?? [];
	const locationNames = locations.filter((location) => locationIds.includes(location.id)).map((location) => location.name);
	return describeRewardStores({ locationScopeType, locationIds: [...locationIds], locationNames, ...(organizationName === undefined ? {} : { organizationName }) });
}
