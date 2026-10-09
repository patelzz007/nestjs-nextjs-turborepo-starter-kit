import { z } from "zod";

import { EpochMsSchema } from "../../api/common";
import { defineListQuery } from "../../api/list-query";
import { SIGNUP_REFERRAL_CODE_LENGTH } from "./signup-referral.constants";

export const SignupReferralStatusSchema = z.enum(["not_redeemed", "redeemed"]);
export type SignupReferralStatus = z.output<typeof SignupReferralStatusSchema>;

export const AdminSignupReferralStatusFilterSchema = z.enum(["not_redeemed", "redeemed"]);
export type AdminSignupReferralStatusFilter = z.output<typeof AdminSignupReferralStatusFilterSchema>;

/**
 * The optional `referralCode` of consumer web signup (ADR 035). Trimmed, at
 * most {@link SIGNUP_REFERRAL_CODE_LENGTH} characters; an omitted field, a JSON
 * `null` and an empty string all mean "no referral code".
 */
export const SignupReferralCodeInputSchema = z.string().trim().max(SIGNUP_REFERRAL_CODE_LENGTH).nullish().meta({
	description: "Optional signup referral code from another user (consumer web signup only)",
	example: "AB23CD45",
});

/** The three signup validation errors a presented referral code can produce (ADR 035, "Error codes"). */
export const SignupReferralErrorCodeSchema = z.enum(["REFERRAL_CODE_UNRECOGNIZED", "REFERRAL_CODE_EXPIRED", "REFERRAL_CODE_UNAVAILABLE"]);
export type SignupReferralErrorCode = z.output<typeof SignupReferralErrorCodeSchema>;

/**
 * What the referrer's screen shows for their latest code: `active` (copyable),
 * `expired` (`now >= expiresAt`, successor not issued yet), `unavailable` (the
 * caller is deactivated or deleted) and `pending` (no code issued yet).
 */
export const SignupReferralCodeStateSchema = z.enum(["active", "expired", "unavailable", "pending"]);
export type SignupReferralCodeState = z.output<typeof SignupReferralCodeStateSchema>;

export const SignupReferralRefereeItemSchema = z
	.object({
		fullName: z.string(),
		createdAt: EpochMsSchema,
		status: SignupReferralStatusSchema,
	})
	.strict();

export type SignupReferralRefereeItem = z.output<typeof SignupReferralRefereeItemSchema>;

export const SignupReferralDashboardSchema = z
	.object({
		code: z.string().length(SIGNUP_REFERRAL_CODE_LENGTH).nullable(),
		expiresAt: EpochMsSchema.nullable(),
		shareable: z.boolean(),
		codeState: SignupReferralCodeStateSchema,
	})
	.strict();

export type SignupReferralDashboard = z.output<typeof SignupReferralDashboardSchema>;

export const signupReferralRefereeListQuery = defineListQuery({
	sortable: ["createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {},
	params: {},
});

export const SignupReferralRefereeListQuerySchema = signupReferralRefereeListQuery.schema;
export type SignupReferralRefereeListQuery = z.output<typeof SignupReferralRefereeListQuerySchema>;

export const AdminSignupReferrerSummarySchema = z
	.object({
		id: z.uuid(),
		fullName: z.string(),
	})
	.strict();

export type AdminSignupReferrerSummary = z.output<typeof AdminSignupReferrerSummarySchema>;
