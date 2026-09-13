import { z } from "zod";

import { BaseResponseSchema } from "../../api/common";

export const AuditLogQuerySchema = z
	.object({
		actorId: z.uuid().optional().meta({
			description: "Filter by actor ID",
		}),
		targetUserId: z.uuid().optional().meta({
			description: "Filter by target user ID",
		}),
		targetRoleId: z.uuid().optional().meta({
			description: "Filter by target role ID",
		}),
		action: z.string().optional().meta({
			description: "Filter by action type",
		}),
		page: z.coerce.number().int().min(1).optional().default(1).meta({
			description: "Page number (1-based)",
		}),
		limit: z.coerce.number().int().min(1).max(100).optional().default(20).meta({
			description: "Results per page",
		}),
	})
	.strict();

export type AuditLogQueryInput = z.output<typeof AuditLogQuerySchema>;

/** Audit log entry. */
export const AuditLogEntrySchema = BaseResponseSchema.omit({ isDeleted: true, deletedAt: true })
	.extend({
		id: z.string(),
		actorId: z.string().nullable(),
		targetUserId: z.string().nullable(),
		targetRoleId: z.string().nullable(),
		permissionId: z.string().nullable(),
		action: z.string(),
		detail: z.string().nullable(),
	})
	.strict();

export type AuditLogEntry = z.output<typeof AuditLogEntrySchema>;
