import { z } from "zod";

import { ApiErrorCodeSchema } from "../../api/api-error";
import { EmailLogStatusSchema } from "../../email/email";

/** Whether the flow / action an event reports succeeded. */
const PlatformEventOutcomeSchema = z.enum(["succeeded", "failed"]);

/** Completed credential/identity flow (signup, login, password reset, …). */
export const AuthFlowEventSchema = z
	.object({
		flow: z.enum(["signup", "login", "forgot-password", "reset-password", "change-password", "verify-email"]),
		/** The user the flow acted on — null when the flow could not identify one. */
		userId: z.string().nullable(),
		/** Login origin ("web" | "admin") — null for flows without a client type. */
		clientType: z.string().nullable(),
		status: PlatformEventOutcomeSchema,
		/** Stable error code of a failed flow (e.g. INVALID_CREDENTIALS) — never a human-readable message. */
		error: ApiErrorCodeSchema.nullable(),
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
		status: PlatformEventOutcomeSchema,
		/** Stable error code of a failed flow (e.g. INVALID_CREDENTIALS) — never a human-readable message. */
		error: ApiErrorCodeSchema.nullable(),
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
		status: PlatformEventOutcomeSchema,
		/** Stable error code of a failed flow (e.g. INVALID_CREDENTIALS) — never a human-readable message. */
		error: ApiErrorCodeSchema.nullable(),
		/** Wall-clock duration of the whole action in ms. */
		durationMs: z.number().int().nonnegative(),
	})
	.strict();

export type ImpersonationActionEvent = z.output<typeof ImpersonationActionEventSchema>;

/**
 * Payload for an EmailLog row creation (send attempt).
 *
 * Deliberately carries NO recipient address: this event is stored in
 * `outbox_events` and published to Kafka, where every consumer group and every
 * broker replica would hold a copy of the PII for the topic's whole retention.
 * The address stays in `email_logs` (access-controlled, retention-managed);
 * downstream systems join on `resendId` when they genuinely need it. The
 * schema is strict, so a producer that adds the address back fails validation.
 */
export const EmailLogUpdatedEventSchema = z
	.object({
		templateKey: z.string(),
		status: EmailLogStatusSchema,
		resendId: z.string().nullable(),
		error: z.string().nullable(),
		/** Send duration in ms (null for noop/log-only modes that never hit the network). */
		durationMs: z.number().int().nonnegative().nullable(),
	})
	.strict();

export type EmailLogUpdatedEvent = z.output<typeof EmailLogUpdatedEventSchema>;
