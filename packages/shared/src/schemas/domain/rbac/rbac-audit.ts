import { z } from "zod";

import { BaseResponseSchema } from "../../api/common";
import { defineListQuery, listFilter } from "../../api/list-query";

/** `GET /admin/audit` list query (newest first) — see docs/list-queries.md. */
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

/** Audit log entry (`GET /admin/audit` list item). Open response schema (ADR 022) — `BaseResponseSchema` is strict, so its fields are spread. */
export const AuditLogEntrySchema = z.object({
	createdAt: BaseResponseSchema.shape.createdAt,
	updatedAt: BaseResponseSchema.shape.updatedAt,
	id: z.string(),
	actorId: z.string().nullable(),
	targetUserId: z.string().nullable(),
	targetRoleId: z.string().nullable(),
	permissionId: z.string().nullable(),
	action: z.string(),
	detail: z.string().nullable(),
});

export type AuditLogEntry = z.output<typeof AuditLogEntrySchema>;
