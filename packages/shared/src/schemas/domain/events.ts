import { z } from "zod";

import { EmailLogStatusSchema } from "../email/email";

/** Completed credential/identity flow (signup, login, password reset, …). */
export const AuthFlowEventSchema = z
	.object({
		flow: z.enum(["signup", "login", "forgot-password", "reset-password", "verify-email"]),
		/** The user the flow acted on — null when the flow could not identify one. */
		userId: z.string().nullable(),
		/** Login origin ("web" | "admin") — null for flows without a client type. */
		clientType: z.string().nullable(),
		status: z.enum(["succeeded", "failed"]),
		error: z.string().nullable(),
		/** Wall-clock duration of the whole flow in ms. */
		durationMs: z.number().int().nonnegative(),
	})
	.strict();

export type AuthFlowEvent = z.output<typeof AuthFlowEventSchema>;

/** Completed session action (refresh, logout-device, logout-all). */
export const SessionActionEventSchema = z
	.object({
		action: z.enum(["refresh", "logout-device", "logout-all"]),
		userId: z.string(),
		status: z.enum(["succeeded", "failed"]),
		error: z.string().nullable(),
		/** Wall-clock duration of the whole action in ms. */
		durationMs: z.number().int().nonnegative(),
	})
	.strict();

export type SessionActionEvent = z.output<typeof SessionActionEventSchema>;

/** Completed impersonation action (start / stop). */
export const ImpersonationActionEventSchema = z
	.object({
		action: z.enum(["start", "stop"]),
		superAdminId: z.string(),
		targetUserId: z.string(),
		status: z.enum(["succeeded", "failed"]),
		error: z.string().nullable(),
		/** Wall-clock duration of the whole action in ms. */
		durationMs: z.number().int().nonnegative(),
	})
	.strict();

export type ImpersonationActionEvent = z.output<typeof ImpersonationActionEventSchema>;

/** Payload for an EmailLog row creation (send attempt). */
export const EmailLogUpdatedEventSchema = z
	.object({
		templateKey: z.string(),
		status: EmailLogStatusSchema,
		to: z.string(),
		resendId: z.string().nullable(),
		error: z.string().nullable(),
		/** Send duration in ms (null for noop/log-only modes that never hit the network). */
		durationMs: z.number().int().nonnegative().nullable(),
	})
	.strict();

export type EmailLogUpdatedEvent = z.output<typeof EmailLogUpdatedEventSchema>;
