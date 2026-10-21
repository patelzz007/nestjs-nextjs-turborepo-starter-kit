import { RewardReferralAttributionTokenSchema } from "@workspace/shared";

/** The length every attribution token has (32 random bytes, base64url). */
const ATTRIBUTION_TOKEN_LENGTH = 43;

/**
 * A seeded referral link's attribution token in the contract's shape, so a seeded link can be opened
 * like a real one (`/rewards/:id?ref=<token>`): the readable label, padded to the token length.
 */
export function seedAttributionToken(label: string): string {
	return RewardReferralAttributionTokenSchema.parse(`seed_${label}`.padEnd(ATTRIBUTION_TOKEN_LENGTH, "0"));
}
