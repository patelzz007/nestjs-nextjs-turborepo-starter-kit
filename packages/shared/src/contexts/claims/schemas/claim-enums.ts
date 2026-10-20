import { z } from "zod";

// ── Claim enums (mirror Prisma — packages/shared cannot import @prisma/client) ───

export const RewardClaimStatusSchema = z.enum(["PENDING", "REDEEMED", "EXPIRED"]);
export type RewardClaimStatus = z.output<typeof RewardClaimStatusSchema>;

export const RewardOtpPurposeSchema = z.enum(["CLAIM"]);
export type RewardOtpPurpose = z.output<typeof RewardOtpPurposeSchema>;

/** 8-char backup code: A–Z + 2–9, excludes 0/O/1/I. */
export const RewardBackupCodeSchema = z
	.string()
	.length(8)
	.regex(/^[A-HJ-NP-Z2-9]{8}$/, "Invalid backup code format");

export type RewardBackupCode = z.output<typeof RewardBackupCodeSchema>;
