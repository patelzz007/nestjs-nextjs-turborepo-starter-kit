import { z } from "zod";

import { EpochMsSchema } from "../api/common";
import { PaginationSchema } from "../api/pagination";

export const MfaRecoveryRequestStatusSchema = z.enum(["PENDING", "APPROVED", "DENIED", "COMPLETED", "NONE"]);

/** Stored recovery request status (excludes the synthetic `NONE` user-facing value). */
export const MfaRecoveryRecordStatusSchema = z.enum(["PENDING", "APPROVED", "DENIED", "COMPLETED"]);

export type MfaRecoveryRecordStatus = z.output<typeof MfaRecoveryRecordStatusSchema>;

export type MfaRecoveryRequestStatus = z.output<typeof MfaRecoveryRequestStatusSchema>;

export const InitiateMfaRecoverySchema = z
	.object({
		reason: z.string().optional(),
	})
	.strict();

export type InitiateMfaRecoveryInput = z.output<typeof InitiateMfaRecoverySchema>;

export const MfaRecoveryStatusResponseSchema = z
	.object({
		status: MfaRecoveryRequestStatusSchema,
		scheduledUnlockAt: EpochMsSchema.optional(),
		message: z.string(),
	})
	.strict();

export type MfaRecoveryStatusResponse = z.output<typeof MfaRecoveryStatusResponseSchema>;

export const AdminReviewMfaRecoverySchema = z
	.object({
		requestId: z.uuid(),
		action: z.enum(["approve", "deny"]),
		notes: z.string().optional(),
	})
	.strict();

export type AdminReviewMfaRecoveryInput = z.output<typeof AdminReviewMfaRecoverySchema>;

/** Admin-visible MFA recovery request with user identity. */
export const AdminMfaRecoveryRequestSchema = z
	.object({
		id: z.uuid(),
		userId: z.uuid(),
		userEmail: z.string(),
		userFullName: z.string(),
		status: MfaRecoveryRecordStatusSchema,
		requestedAt: EpochMsSchema,
		reviewedBy: z.uuid().nullable(),
		reviewedAt: EpochMsSchema.nullable(),
		scheduledUnlockAt: EpochMsSchema.nullable(),
		completedAt: EpochMsSchema.nullable(),
		notes: z.string().nullable(),
	})
	.strict();

export type AdminMfaRecoveryRequest = z.output<typeof AdminMfaRecoveryRequestSchema>;

export const AdminMfaRecoveryListQuerySchema = PaginationSchema.extend({
	limit: z.coerce.number().int().min(1).max(100).optional().default(20),
	status: MfaRecoveryRecordStatusSchema.optional(),
	userId: z.uuid().optional(),
}).strict();

export type AdminMfaRecoveryListQuery = z.output<typeof AdminMfaRecoveryListQuerySchema>;
