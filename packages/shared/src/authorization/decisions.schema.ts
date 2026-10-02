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

/**
 * One answered check. Response schema: open (strip unknown keys — ADR 022), so
 * it re-declares the strict request schema's fields instead of extending it.
 */
export const AuthorizationCheckResultSchema = z.object({
	...AuthorizationCheckSchema.shape,
	allowed: z.boolean(),
});

export type AuthorizationCheckResult = z.output<typeof AuthorizationCheckResultSchema>;

/** `POST /authorization/decisions` payload. */
export const AuthorizationDecisionsResponseSchema = z.object({
	results: z.array(AuthorizationCheckResultSchema),
});

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
