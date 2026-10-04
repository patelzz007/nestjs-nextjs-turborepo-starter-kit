import { z } from "zod";

import { AuthorizationPolicyScopeSchema, AuthorizationPolicyStatusSchema, OrganizationMembershipRoleSchema, PolicyBuilderPayloadSchema } from "./organization";

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

/**
 * `POST /policies/drafts` body. A `TENANT` draft names the organization it
 * governs; platform scopes (`PLATFORM_GUARDRAIL`, `PLATFORM`) apply to every
 * organization and must not name one.
 */
export const CreatePolicyDraftSchema = z
	.object({
		scope: AuthorizationPolicyScopeSchema,
		organizationId: z.uuid().optional(),
		name: z.string().min(1).max(120),
		description: z.string().max(2000).optional(),
		builderPayload: PolicyBuilderPayloadSchema,
	})
	.strict()
	.superRefine((draft, context): void => {
		const isTenantScope = draft.scope === AuthorizationPolicyScopeSchema.enum.TENANT;
		if (isTenantScope && draft.organizationId === undefined) {
			context.addIssue({ code: "custom", path: ["organizationId"], message: "is required for a TENANT policy draft" });
		}
		if (!isTenantScope && draft.organizationId !== undefined) {
			context.addIssue({ code: "custom", path: ["organizationId"], message: "must be omitted for a platform-scope policy draft" });
		}
	});

export type CreatePolicyDraftInput = z.output<typeof CreatePolicyDraftSchema>;

export const CedarDecisionSchema = z.enum(["Allow", "Deny"]);

export type CedarDecision = z.output<typeof CedarDecisionSchema>;

/** One (principal, action) whose decision differs between the published policy set and the draft. */
export const PolicyDecisionChangeSchema = z.object({
	organizationId: z.uuid(),
	userId: z.uuid(),
	membershipRole: OrganizationMembershipRoleSchema,
	action: z.string(),
	before: CedarDecisionSchema,
	after: CedarDecisionSchema,
});

export type PolicyDecisionChange = z.output<typeof PolicyDecisionChangeSchema>;

/**
 * `POST /policies/drafts/:draftId/simulate` payload: the draft evaluated
 * against the currently published policy set over the real principals in its
 * scope. `decisionChanges` lists at most a bounded sample (see
 * `decisionChangesTruncated`); `affectedPrincipalCount` counts every principal
 * with at least one changed decision. Response schema: open (ADR 022).
 */
export const PolicySimulationResultSchema = z.object({
	simulationId: z.uuid(),
	passed: z.boolean(),
	warnings: z.array(z.string()),
	errors: z.array(z.string()),
	evaluatedPrincipalCount: z.number().int().nonnegative(),
	affectedPrincipalCount: z.number().int().nonnegative(),
	wouldLockOutOwners: z.boolean(),
	decisionChanges: z.array(PolicyDecisionChangeSchema),
	decisionChangesTruncated: z.boolean(),
});

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

/** `POST /policies/drafts` payload — the id of the new draft. Response schema: open (ADR 022). */
export const PolicyDraftCreatedResponseSchema = z.object({
	draftId: z.uuid(),
});

export type PolicyDraftCreatedResponse = z.output<typeof PolicyDraftCreatedResponseSchema>;

/** `POST /policies/publish` payload — the published bundle version. Response schema: open (ADR 022). */
export const PolicyPublishResponseSchema = z.object({
	version: z.number().int().positive(),
});

export type PolicyPublishResponse = z.output<typeof PolicyPublishResponseSchema>;

export { AuthorizationPolicyScopeSchema, AuthorizationPolicyStatusSchema };
