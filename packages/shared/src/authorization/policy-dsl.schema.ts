import { z } from "zod";

/**
 * The authorization request and decision vocabulary shared by the API and its clients (zod, no
 * arbitrary JavaScript). The JSON condition language that lived here was removed with the JSON
 * policy engine (ADR 067 Phase 4).
 */

export const PermissionScopeSchema = z.enum(["GLOBAL", "TENANT", "LOCATION", "RESOURCE", "OWN"]);

export type PermissionScope = z.infer<typeof PermissionScopeSchema>;

export const AclEffectSchema = z.enum(["ALLOW", "DENY"]);

export type AclEffect = z.infer<typeof AclEffectSchema>;

export const AuthorizationDecisionSchema = z.enum(["ALLOW", "DENY"]);

export type AuthorizationDecision = z.infer<typeof AuthorizationDecisionSchema>;

/** An attribute value in an authorization request or its evaluation details: a closed set of JSON scalars and scalar lists. */
export const AuthorizationAttributeValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()])), z.null()]);

export type AuthorizationAttributeValue = z.infer<typeof AuthorizationAttributeValueSchema>;

export const AuthorizationAttributesSchema = z.record(z.string(), AuthorizationAttributeValueSchema);

export type AuthorizationAttributes = z.infer<typeof AuthorizationAttributesSchema>;

/**
 * Authorization context - the subject performing an action.
 *
 * `tenantId` / `locationId` must only ever be populated from a
 * server-verified membership (see `AuthorizationContextResolver`); the kernel
 * re-verifies them before any TENANT / LOCATION scoped grant applies.
 */
export const AuthorizationContextSchema = z
	.object({
		userId: z.string(),
		tenantId: z.string().optional(),
		locationId: z.string().optional(),
		roles: z.array(z.string()).optional(),
		attributes: AuthorizationAttributesSchema.optional(),
		isSuperAdmin: z.boolean().optional(),
	})
	.strict();

export type AuthorizationContext = z.infer<typeof AuthorizationContextSchema>;

/**
 * Authorization request - what action is being attempted.
 */
export const AuthorizationRequestSchema = z
	.object({
		subject: AuthorizationContextSchema,
		action: z.string(),
		resource: z.string(),
		resourceId: z.string().optional(),
		resourceAttributes: AuthorizationAttributesSchema.optional(),
	})
	.strict();

export type AuthorizationRequest = z.infer<typeof AuthorizationRequestSchema>;

/**
 * One step of an authorization evaluation (part of the explain response — open, ADR 022).
 */
export const AuthorizationEvaluationStepSchema = z.object({
	source: z.enum(["superadmin", "validation", "tenant", "override", "acl", "role", "grant", "share", "scope", "policy", "ownership", "relationship", "default"]),
	effect: z.enum(["ALLOW", "DENY", "NO_MATCH"]),
	reason: z.string().optional(),
	details: AuthorizationAttributesSchema.optional(),
});

export type AuthorizationEvaluationStep = z.infer<typeof AuthorizationEvaluationStepSchema>;

/**
 * Also the `GET /authorization/decisions/explain` response, so it is open
 * (strip unknown keys — ADR 022): the strict subject / request schemas are
 * re-declared from their `shape` here rather than nested as-is.
 */
export const AuthorizationResultSchema = z.object({
	decision: AuthorizationDecisionSchema,
	request: z.object({
		...AuthorizationRequestSchema.shape,
		subject: z.object(AuthorizationContextSchema.shape),
	}),
	evaluation: z.array(AuthorizationEvaluationStepSchema),
	durationMs: z.number().int().nonnegative().optional(),
});

export type AuthorizationResult = z.infer<typeof AuthorizationResultSchema>;

/**
 * Authorization Audit Log Request Schema
 * Used for recording authorization decisions in the audit log.
 */
export const AuthorizationAuditLogRequestSchema = z
	.object({
		actorId: z.string().optional(),
		tenantId: z.string().optional(),
		locationId: z.string().optional(),
		action: z.string(),
		resource: z.string(),
		resourceId: z.string().optional(),
		decision: AuthorizationDecisionSchema,
		reason: z.string().optional(),
		policyIds: z.array(z.string()).optional(),
		aclIds: z.array(z.string()).optional(),
		evaluation: z.array(AuthorizationEvaluationStepSchema).optional(),
		ipAddress: z.string().optional(),
		userAgent: z.string().optional(),
		requestId: z.string().optional(),
		durationMs: z.number().int().nonnegative().optional(),
	})
	.strict();

export type AuthorizationAuditLogRequest = z.output<typeof AuthorizationAuditLogRequestSchema>;
