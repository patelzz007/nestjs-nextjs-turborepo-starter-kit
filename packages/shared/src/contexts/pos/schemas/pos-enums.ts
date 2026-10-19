import { z } from "zod";

// ── POS enums (mirror Prisma — packages/shared cannot import @prisma/client) ───

export const RewardRedemptionMethodSchema = z.enum(["SCAN", "MANUAL"]);
export type RewardRedemptionMethod = z.output<typeof RewardRedemptionMethodSchema>;

export const RewardTerminalIdHeaderSchema = z.string().min(1).max(100);
