import { z } from "zod";

import { PermissionActionSchema, PermissionResourceSchema } from "../schemas/domain/platform/enums";

const ResourceIdSchema = z.string().min(1).max(64);

/**
 * One capability question from the UI. Resource attributes are deliberately
 * not accepted: the backend never trusts client-supplied authorization input,
 * it resolves ownership and tenant data from server-side state.
 */
export const AuthorizationCheckSchema = z
	.object({
		action: PermissionActionSchema,
		resource: PermissionResourceSchema,
		resourceId: ResourceIdSchema.optional(),
	})
	.strict();

export type AuthorizationCheck = z.output<typeof AuthorizationCheckSchema>;

export const AuthorizationDecisionsRequestSchema = z
	.object({
		checks: z.array(AuthorizationCheckSchema).min(1).max(50),
	})
	.strict();

export type AuthorizationDecisionsRequest = z.output<typeof AuthorizationDecisionsRequestSchema>;

export const AuthorizationCheckResultSchema = AuthorizationCheckSchema.extend({
	allowed: z.boolean(),
}).strict();

export type AuthorizationCheckResult = z.output<typeof AuthorizationCheckResultSchema>;

export const AuthorizationDecisionsResponseSchema = z
	.object({
		results: z.array(AuthorizationCheckResultSchema),
	})
	.strict();

export type AuthorizationDecisionsResponse = z.output<typeof AuthorizationDecisionsResponseSchema>;

/** Admin explain query — the subject defaults to the caller. */
export const AuthorizationExplainQuerySchema = z
	.object({
		action: PermissionActionSchema,
		resource: PermissionResourceSchema,
		resourceId: ResourceIdSchema.optional(),
		userId: ResourceIdSchema.optional(),
		organizationId: ResourceIdSchema.optional(),
		storeId: ResourceIdSchema.optional(),
		locationId: ResourceIdSchema.optional(),
	})
	.strict();

export type AuthorizationExplainQuery = z.output<typeof AuthorizationExplainQuerySchema>;
