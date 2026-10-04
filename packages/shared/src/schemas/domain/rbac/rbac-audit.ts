import { z } from "zod";

import { BaseResponseSchema } from "../../api/common";
import { defineListQuery, listFilter } from "../../api/list-query";

/** `GET /admin/audit` list query (newest first) — see docs/technical/api/list-queries.md. */
export const auditLogListQuery = defineListQuery({
	sortable: ["createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		action: listFilter.string({ eq: true, in: true }),
		actorId: listFilter.uuid({ eq: true }),
		targetUserId: listFilter.uuid({ eq: true }),
		targetRoleId: listFilter.uuid({ eq: true }),
		createdAt: listFilter.epochMs({ gte: true, lte: true }),
	},
	params: {},
});
export const AuditLogQuerySchema = auditLogListQuery.schema;
export type AuditLogQueryInput = z.output<typeof AuditLogQuerySchema>;
export type AuditLogListSortField = (typeof auditLogListQuery.sortable)[number];

/** Longest allowlisted system-operation name the API stores as an audit actor. */
const MAX_SYSTEM_OPERATION_NAME_LENGTH = 100;

/**
 * Who performed an RBAC change. A user is identified by their id (plus the
 * SuperAdmin behind an impersonation session, when there was one); a scheduled
 * job by the allowlisted system operation it ran under — e.g.
 * `maintenance.permission_expiry` — never by a placeholder such as "system".
 * Open variants (ADR 022): unknown keys are stripped, never rejected.
 */
export const AuditLogActorSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("USER"),
		userId: z.string(),
		impersonatorId: z.string().nullable(),
	}),
	z.object({
		kind: z.literal("SYSTEM_OPERATION"),
		operation: z.string().min(1).max(MAX_SYSTEM_OPERATION_NAME_LENGTH),
	}),
]);

export type AuditLogActor = z.output<typeof AuditLogActorSchema>;

/** Audit log entry (`GET /admin/audit` list item). Open response schema (ADR 022) — `BaseResponseSchema` is strict, so its fields are spread. */
export const AuditLogEntrySchema = z.object({
	createdAt: BaseResponseSchema.shape.createdAt,
	updatedAt: BaseResponseSchema.shape.updatedAt,
	id: z.string(),
	actor: AuditLogActorSchema,
	targetUserId: z.string().nullable(),
	targetRoleId: z.string().nullable(),
	permissionId: z.string().nullable(),
	action: z.string(),
	detail: z.string().nullable(),
});

export type AuditLogEntry = z.output<typeof AuditLogEntrySchema>;
