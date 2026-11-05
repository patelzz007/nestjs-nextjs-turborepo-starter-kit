import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";

/** Days between asking for an erasure and it being carried out (ADR 077, Q10). */
export const ACCOUNT_ERASURE_GRACE_DAYS = 30;

/** Support must say why they erase an account (ADR 077, Q13): bounds for that reason. */
export const ACCOUNT_ERASURE_REASON_MIN_LENGTH = 10;
export const ACCOUNT_ERASURE_REASON_MAX_LENGTH = 500;

export const AccountErasureStatusSchema = z.enum(["PENDING", "CANCELLED", "COMPLETED"]);
export type AccountErasureStatus = z.output<typeof AccountErasureStatusSchema>;

/** The body of `POST /me/erasure`: the person confirms with their password. */
export const RequestOwnAccountErasureSchema = z.object({ password: z.string().min(1).max(256) }).strict();
export type RequestOwnAccountErasure = z.output<typeof RequestOwnAccountErasureSchema>;

/** The body of `POST /admin/users/:userId/erasure`: support records why. */
export const RequestAccountErasureBySupportSchema = z
	.object({ reason: z.string().trim().min(ACCOUNT_ERASURE_REASON_MIN_LENGTH).max(ACCOUNT_ERASURE_REASON_MAX_LENGTH) })
	.strict();
export type RequestAccountErasureBySupport = z.output<typeof RequestAccountErasureBySupportSchema>;

export const AccountErasureUserParamsSchema = z.object({ userId: z.uuid() }).strict();

/** An erasure request as the person (or support) sees it. */
export const AccountErasureResponseSchema = z.object({
	id: z.string(),
	userId: z.string(),
	status: AccountErasureStatusSchema,
	/** Who asked: the person themselves, or support on their behalf. */
	requestedBy: z.enum(["self", "support"]),
	/** Support's recorded reason; null when the person asked. */
	reason: z.string().nullable(),
	requestedAt: EpochMsSchema,
	/** When it will be (or was) carried out: the end of the grace period. */
	scheduledFor: EpochMsSchema,
	cancelledAt: EpochMsSchema.nullable(),
	completedAt: EpochMsSchema.nullable(),
});
export type AccountErasureResponse = z.output<typeof AccountErasureResponseSchema>;

/** `GET /me/erasure`: the open (or most recent) request, or none. */
export const OwnAccountErasureResponseSchema = z.object({ erasure: AccountErasureResponseSchema.nullable() });
export type OwnAccountErasureResponse = z.output<typeof OwnAccountErasureResponseSchema>;
