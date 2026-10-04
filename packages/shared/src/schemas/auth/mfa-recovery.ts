import { z } from "zod";

import { EpochMsSchema } from "../api/common";
import { defineListQuery, listFilter } from "../api/list-query";

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

export const MfaRecoveryStatusResponseSchema = z.object({
	status: MfaRecoveryRequestStatusSchema,
	scheduledUnlockAt: EpochMsSchema.optional(),
	message: z.string(),
});

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
export const AdminMfaRecoveryRequestSchema = z.object({
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
});

export type AdminMfaRecoveryRequest = z.output<typeof AdminMfaRecoveryRequestSchema>;

/** `GET /auth/admin/mfa/recovery/requests` list query — see docs/technical/api/list-queries.md. */
export const adminMfaRecoveryListQuery = defineListQuery({
	sortable: ["requestedAt", "createdAt"],
	defaultSort: [{ field: "requestedAt", direction: "desc" }],
	filter: {
		status: listFilter.enumeration(MfaRecoveryRecordStatusSchema, { eq: true, in: true }),
		userId: listFilter.uuid({ eq: true }),
	},
	params: {},
});
export const AdminMfaRecoveryListQuerySchema = adminMfaRecoveryListQuery.schema;
export type AdminMfaRecoveryListQuery = z.output<typeof AdminMfaRecoveryListQuerySchema>;
export type AdminMfaRecoveryListSortField = (typeof adminMfaRecoveryListQuery.sortable)[number];
