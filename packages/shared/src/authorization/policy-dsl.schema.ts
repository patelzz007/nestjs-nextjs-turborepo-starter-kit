import { z } from "zod";

/**
 * Authorization Policy DSL - Zod-validated, no arbitrary JavaScript.
 * Inspired by CASL conditions and Oso policies.
 */

export const PolicyOperatorSchema = z.enum([
	"equals",
	"not_equals",
	"in",
	"not_in",
	"contains",
	"not_contains",
	"starts_with",
	"ends_with",
	"greater_than",
	"greater_than_or_equals",
	"less_than",
	"less_than_or_equals",
	"exists",
	"not_exists",
]);

export type PolicyOperator = z.infer<typeof PolicyOperatorSchema>;

export const PolicyValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()])), z.null()]);

export type PolicyValue = z.infer<typeof PolicyValueSchema>;

export const PolicyConditionSchema = z
	.object({
		field: z.string().min(1),
		operator: PolicyOperatorSchema,
		value: PolicyValueSchema.optional(),
		/** Reference to actor attribute like $user.organizationId */
		valueRef: z.string().min(1).optional(),
	})
	.strict();

export type PolicyCondition = z.infer<typeof PolicyConditionSchema>;

export interface PolicyRule {
	all?: PolicyRule[];
	any?: PolicyRule[];
	condition?: PolicyCondition;
}

/**
 * Strict rule shape — unknown keys (e.g. a legacy `{ operator, path }` node)
 * fail validation, so a malformed policy can never parse into an empty rule.
 * Exactly one of `all` / `any` / `condition` must be present.
 */
export const PolicyRuleSchema: z.ZodType<PolicyRule> = z.lazy(() =>
	z
		.object({
			all: z.array(PolicyRuleSchema).min(1).optional(),
			any: z.array(PolicyRuleSchema).min(1).optional(),
			condition: PolicyConditionSchema.optional(),
		})
		.strict()
		.refine((rule) => [rule.all, rule.any, rule.condition].filter((branch) => branch !== undefined).length === 1, {
			message: "A policy rule must define exactly one of all, any, or condition",
		}),
);

/**
 * Complete policy conditions structure.
 * Example:
 * {
 *   "all": [
 *     {
 *       "condition": {
 *         "field": "order.organizationId",
 *         "operator": "equals",
 *         "valueRef": "$user.organizationId"
 *       }
 *     },
 *     {
 *       "condition": {
 *         "field": "order.status",
 *         "operator": "not_equals",
 *         "value": "COMPLETED"
 *       }
 *     }
 *   ]
 * }
 */
export const PolicyConditionsSchema = PolicyRuleSchema;

export type PolicyConditions = z.infer<typeof PolicyConditionsSchema>;

export const PermissionScopeSchema = z.enum(["GLOBAL", "ORGANIZATION", "STORE", "LOCATION", "RESOURCE", "OWN"]);

export type PermissionScope = z.infer<typeof PermissionScopeSchema>;

export const AclEffectSchema = z.enum(["ALLOW", "DENY"]);

export type AclEffect = z.infer<typeof AclEffectSchema>;

export const PolicyEffectSchema = z.enum(["ALLOW", "DENY"]);

export type PolicyEffect = z.infer<typeof PolicyEffectSchema>;

export const AuthorizationDecisionSchema = z.enum(["ALLOW", "DENY"]);

export type AuthorizationDecision = z.infer<typeof AuthorizationDecisionSchema>;

/**
 * Attribute value usable in policy conditions and evaluation details —
 * the same closed value set as {@link PolicyValueSchema}.
 */
export const AuthorizationAttributeValueSchema = PolicyValueSchema;

export type AuthorizationAttributeValue = z.infer<typeof AuthorizationAttributeValueSchema>;

export const AuthorizationAttributesSchema = z.record(z.string(), AuthorizationAttributeValueSchema);

export type AuthorizationAttributes = z.infer<typeof AuthorizationAttributesSchema>;

/**
 * Authorization context - the subject performing an action.
 *
 * `organizationId` / `storeId` / `locationId` must only ever be populated from a
 * server-verified membership (see `AuthorizationContextResolver`); the kernel
 * re-verifies them before any ORGANIZATION / LOCATION scoped grant applies.
 */
export const AuthorizationContextSchema = z
	.object({
		userId: z.string(),
		organizationId: z.string().optional(),
		/** Active store — only honoured after the kernel verifies a store membership. */
		storeId: z.string().optional(),
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
 * Authorization evaluation result with explanation.
 */
export const AuthorizationEvaluationStepSchema = z
	.object({
		source: z.enum(["superadmin", "validation", "tenant", "override", "acl", "role", "scope", "policy", "ownership", "relationship", "default"]),
		effect: z.enum(["ALLOW", "DENY", "NO_MATCH"]),
		reason: z.string().optional(),
		details: AuthorizationAttributesSchema.optional(),
	})
	.strict();

export type AuthorizationEvaluationStep = z.infer<typeof AuthorizationEvaluationStepSchema>;

export const AuthorizationResultSchema = z
	.object({
		decision: AuthorizationDecisionSchema,
		request: AuthorizationRequestSchema,
		evaluation: z.array(AuthorizationEvaluationStepSchema),
		durationMs: z.number().int().nonnegative().optional(),
	})
	.strict();

export type AuthorizationResult = z.infer<typeof AuthorizationResultSchema>;

/**
 * Authorization Audit Log Request Schema
 * Used for recording authorization decisions in the audit log.
 */
export const AuthorizationAuditLogRequestSchema = z
	.object({
		actorId: z.string().optional(),
		organizationId: z.string().optional(),
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

// ── Authorization row filters (Prisma WHERE fragments) ─────────────────────

/** Restricts rows to resources belonging to one user (ownership scope). */
export const OwnershipRowFilterSchema = z
	.object({
		userId: z.string(),
	})
	.strict();

export type OwnershipRowFilter = z.output<typeof OwnershipRowFilterSchema>;

/**
 * Restricts rows to a tenant scope: the organization (optionally narrowed to
 * one location) or a single location. When both are present they are
 * conjunctive — a location condition never widens past the org boundary.
 */
export const TenantRowFilterSchema = z.union([
	z
		.object({
			organizationId: z.string(),
			storeId: z.string(),
		})
		.strict(),
	z
		.object({
			organizationId: z.string(),
			locationId: z.string().optional(),
		})
		.strict(),
	z
		.object({
			locationId: z.string(),
		})
		.strict(),
]);

export type TenantRowFilter = z.output<typeof TenantRowFilterSchema>;

/** Restricts rows to an explicit id allow-list (resource-specific ACL ALLOW entries). */
export const IdAllowListRowFilterSchema = z
	.object({
		id: z.object({ in: z.array(z.string()).min(1) }).strict(),
	})
	.strict();

export type IdAllowListRowFilter = z.output<typeof IdAllowListRowFilterSchema>;

/** One row-visibility alternative granted by a scope, ownership, or ACL entry. */
export const RowScopeAlternativeSchema = z.union([TenantRowFilterSchema, OwnershipRowFilterSchema, IdAllowListRowFilterSchema]);

export type RowScopeAlternative = z.output<typeof RowScopeAlternativeSchema>;

/** Several row-visibility alternatives combined with OR. */
export const ScopedRowFilterSchema = z
	.object({
		OR: z.array(RowScopeAlternativeSchema).min(2),
	})
	.strict();

export type ScopedRowFilter = z.output<typeof ScopedRowFilterSchema>;

/** Empty WHERE clause — unrestricted row access (SuperAdmin / GLOBAL grant; RLS still applies). */
export const UnrestrictedRowFilterSchema = z.object({}).strict();

export type UnrestrictedRowFilter = z.output<typeof UnrestrictedRowFilterSchema>;

/** Matches no rows — the subject holds no grant for the action (default deny). */
export const DenyAllRowFilterSchema = z
	.object({
		id: z.object({ in: z.tuple([]) }).strict(),
	})
	.strict();

export type DenyAllRowFilter = z.output<typeof DenyAllRowFilterSchema>;

/** Base filters that can be narrowed by explicit ACL denials. */
export const BaseRowFilterSchema = z.union([UnrestrictedRowFilterSchema, TenantRowFilterSchema, OwnershipRowFilterSchema, IdAllowListRowFilterSchema, ScopedRowFilterSchema]);

export type BaseRowFilter = z.output<typeof BaseRowFilterSchema>;

/** A base filter minus resources explicitly denied through resource-specific ACL DENY entries. */
export const ExcludingRowFilterSchema = z
	.object({
		AND: z.tuple([
			BaseRowFilterSchema,
			z
				.object({
					NOT: IdAllowListRowFilterSchema,
				})
				.strict(),
		]),
	})
	.strict();

export type ExcludingRowFilter = z.output<typeof ExcludingRowFilterSchema>;

/** Every WHERE fragment the kernel's `filter()` can produce. */
export const AuthorizationRowFilterSchema = z.union([BaseRowFilterSchema, DenyAllRowFilterSchema, ExcludingRowFilterSchema]);

export type AuthorizationRowFilter = z.output<typeof AuthorizationRowFilterSchema>;
