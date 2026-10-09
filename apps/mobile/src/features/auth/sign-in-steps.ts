// The params and copy shared by the sign-in step screens (§10.2, §10.3).

import { z } from "zod";

/** `/two-factor?tempToken=…` — the short-lived challenge reference from `POST /auth/login`. */
export const TwoFactorRouteParamsSchema = z.object({ tempToken: z.string().min(1) });

/** `/verify-device?verificationId=…` — the pending new-device verification. */
export const VerifyDeviceRouteParamsSchema = z.object({ verificationId: z.string().min(1) });

/** A step screen opened without (or with broken) params: a stale or crafted link. */
export const EXPIRED_STEP_MESSAGE = "This sign-in step is no longer valid. Please sign in again.";
