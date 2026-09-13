import { z } from "zod";

import { AuthorizationPolicyScopeSchema, AuthorizationPolicyStatusSchema, PolicyBuilderPayloadSchema } from "./organization";

/** Cedar authorization request entity bundle. */
export const CedarAuthorizationRequestSchema = z
	.object({
		principal: z.string(),
		action: z.string(),
		resource: z.string(),
		context: z.record(z.string(), z.union([z.string(), z.boolean(), z.number().int()])),
	})
	.strict();

export type CedarAuthorizationRequest = z.output<typeof CedarAuthorizationRequestSchema>;

export const CedarAuthorizationDecisionSchema = z
	.object({
		decision: z.enum(["Allow", "Deny"]),
		diagnostics: z.array(z.string()),
		policyVersion: z.number().int().nonnegative(),
		evaluatedAt: z.number().int().nonnegative(),
	})
	.strict();

export type CedarAuthorizationDecision = z.output<typeof CedarAuthorizationDecisionSchema>;

export const CreatePolicyDraftSchema = z
	.object({
		scope: AuthorizationPolicyScopeSchema,
		name: z.string().min(1).max(120),
		description: z.string().max(2000).optional(),
		builderPayload: PolicyBuilderPayloadSchema,
	})
	.strict();

export type CreatePolicyDraftInput = z.output<typeof CreatePolicyDraftSchema>;

export const PolicySimulationResultSchema = z
	.object({
		passed: z.boolean(),
		warnings: z.array(z.string()),
		errors: z.array(z.string()),
		affectedPrincipalCount: z.number().int().nonnegative(),
		wouldLockOutOwners: z.boolean(),
	})
	.strict();

export type PolicySimulationResult = z.output<typeof PolicySimulationResultSchema>;

export const PublishedPolicyBundleSchema = z
	.object({
		organizationId: z.uuid().nullable(),
		scope: AuthorizationPolicyScopeSchema,
		version: z.number().int().positive(),
		cedarSource: z.string(),
		sqlPredicate: z.string().nullable(),
		contentHash: z.string(),
		publishedAt: z.number().int().nonnegative(),
	})
	.strict();

export type PublishedPolicyBundle = z.output<typeof PublishedPolicyBundleSchema>;

export const PolicyPublishRequestSchema = z
	.object({
		draftId: z.uuid(),
		approvalNote: z.string().max(500).optional(),
	})
	.strict();

export type PolicyPublishRequestInput = z.output<typeof PolicyPublishRequestSchema>;

export { AuthorizationPolicyScopeSchema, AuthorizationPolicyStatusSchema };
