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

export const PolicyValueSchema = z.union([
	z.string(),
	z.number(),
	z.boolean(),
	z.array(z.union([z.string(), z.number()])),
	z.null(),
]);

export type PolicyValue = z.infer<typeof PolicyValueSchema>;

export const PolicyConditionSchema = z.object({
	field: z.string(),
	operator: PolicyOperatorSchema,
	value: PolicyValueSchema.optional(),
	/** Reference to actor attribute like $user.organizationId */
	valueRef: z.string().optional(),
});

export type PolicyCondition = z.infer<typeof PolicyConditionSchema>;

export type PolicyRule = {
	all?: PolicyRule[];
	any?: PolicyRule[];
	condition?: PolicyCondition;
};

export const PolicyRuleSchema: z.ZodType<PolicyRule> = z.lazy(() =>
	z.object({
		all: z.array(PolicyRuleSchema).optional(),
		any: z.array(PolicyRuleSchema).optional(),
		condition: PolicyConditionSchema.optional(),
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

export const PermissionScopeSchema = z.enum(["GLOBAL", "ORGANIZATION", "LOCATION", "RESOURCE", "OWN"]);

export type PermissionScope = z.infer<typeof PermissionScopeSchema>;

export const AclEffectSchema = z.enum(["ALLOW", "DENY"]);

export type AclEffect = z.infer<typeof AclEffectSchema>;

export const PolicyEffectSchema = z.enum(["ALLOW", "DENY"]);

export type PolicyEffect = z.infer<typeof PolicyEffectSchema>;

export const AuthorizationDecisionSchema = z.enum(["ALLOW", "DENY"]);

export type AuthorizationDecision = z.infer<typeof AuthorizationDecisionSchema>;

/**
 * Authorization context - the subject performing an action.
 */
export const AuthorizationContextSchema = z
	.object({
		userId: z.string(),
		organizationId: z.string().optional(),
		locationId: z.string().optional(),
		roles: z.array(z.string()).optional(),
		attributes: z.record(z.string(), z.unknown()).optional(),
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
		resourceAttributes: z.record(z.string(), z.unknown()).optional(),
	})
	.strict();

export type AuthorizationRequest = z.infer<typeof AuthorizationRequestSchema>;

/**
 * Authorization evaluation result with explanation.
 */
export const AuthorizationEvaluationStepSchema = z
	.object({
		source: z.enum(["superadmin", "acl", "role", "policy", "ownership", "relationship", "default"]),
		effect: z.enum(["ALLOW", "DENY", "NO_MATCH"]),
		reason: z.string().optional(),
		details: z.record(z.string(), z.unknown()).optional(),
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
