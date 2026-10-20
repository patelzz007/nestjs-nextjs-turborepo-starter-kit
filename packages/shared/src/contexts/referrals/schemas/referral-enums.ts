import { z } from "zod";

// ── Referral enums (mirror Prisma — packages/shared cannot import @prisma/client) ───

export const RewardReferralStatusSchema = z.enum(["PENDING", "CREDITED", "BLOCKED"]);
export type RewardReferralStatus = z.output<typeof RewardReferralStatusSchema>;
