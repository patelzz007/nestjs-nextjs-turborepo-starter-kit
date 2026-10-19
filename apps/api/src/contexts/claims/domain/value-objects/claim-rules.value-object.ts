import { DAY_MS } from "@workspace/shared";
import { z } from "zod";

/** A claim's life: held (PENDING) until redeemed at a till or expired. */
export const RewardClaimStatusSchema = z.enum(["PENDING", "REDEEMED", "EXPIRED"]);

export type RewardClaimStatus = z.output<typeof RewardClaimStatusSchema>;

export const REWARD_CLAIM_STATUSES: readonly RewardClaimStatus[] = RewardClaimStatusSchema.options;

/** Statuses that count toward a reward's per-customer limit (an expired claim returned its unit and does not). */
export const LIMIT_COUNTED_CLAIM_STATUSES: readonly RewardClaimStatus[] = ["PENDING", "REDEEMED"];

/** Days a consumer claim stays redeemable (capped by the reward's own expiry). */
const CLAIM_TTL_DAYS = 7;

export const CLAIM_TTL_MS = CLAIM_TTL_DAYS * DAY_MS;

const MS_PER_MINUTE = 60_000;

/** Minutes a claim OTP stays valid (also shown in the email). */
export const OTP_EXPIRES_MINUTES = 5;

export const OTP_TTL_MS = OTP_EXPIRES_MINUTES * MS_PER_MINUTE;

/** Verification attempts one OTP challenge allows before it is spent (D09). */
export const MAX_OTP_ATTEMPTS = 5;

/** Overdue claims one expiry job run handles (the next run picks up the rest). */
export const CLAIM_EXPIRY_BATCH_SIZE = 200;
