// The params and copy shared by the sign-in step screens (§10.2, §10.3).

import { z } from "zod";

/** A route param that is a yes or no: `"1"` or absent (a link without it means no). */
const FlagParamSchema = z
	.enum(["1", "0"])
	.optional()
	.transform((flag: "1" | "0" | undefined): boolean => flag === "1");

/**
 * `/auth/two-factor?tempToken=…&passkey=1` — the short-lived challenge reference from `POST /auth/login`, and
 * whether the account has a passkey that may finish the sign-in instead of a code (ADR 080).
 */
export const TwoFactorRouteParamsSchema = z.object({ tempToken: z.string().min(1), passkey: FlagParamSchema });

/** The two-factor route's `passkey` param. */
export function passkeyFlagParam(passkeyAvailable: boolean): "1" | "0" {
	return passkeyAvailable ? "1" : "0";
}

/** `/auth/verify-device?verificationId=…` — the pending new-device verification. */
export const VerifyDeviceRouteParamsSchema = z.object({ verificationId: z.string().min(1) });

/** A step screen opened without (or with broken) params: a stale or crafted link. */
export const EXPIRED_STEP_MESSAGE = "This sign-in step is no longer valid. Please sign in again.";
