import { z } from "zod";

// ── Legal acceptance and claim-checkout readiness (`/legal/*`) ──

export const AcceptRewardLegalSchema = z
	.object({
		termsVersion: z.string().min(1).max(32),
		privacyVersion: z.string().min(1).max(32),
	})
	.strict();

export type AcceptRewardLegalInput = z.output<typeof AcceptRewardLegalSchema>;

/** Claim checkout state for the signed-in user (legal acceptance + verified phone). */
export const RewardClaimCheckoutStatusSchema = z.object({
	hasAcceptedLegal: z.boolean(),
	termsVersion: z.string().nullable(),
	privacyVersion: z.string().nullable(),
	phone: z.string().nullable(),
	phoneVerified: z.boolean(),
});

export type RewardClaimCheckoutStatus = z.output<typeof RewardClaimCheckoutStatusSchema>;
