import type { CedarAuthorizationDecision } from "@workspace/shared";

import type { PolicyPrincipal } from "./policy-engine.port";

/** One runtime authorization question: may this member perform `action` on the tenant? */
export interface CedarEvaluationInput {
	readonly tenantId: string;
	readonly principal: PolicyPrincipal;
	/** Bare action id declared in the Cedar schema, e.g. `tenant:manage_team`. */
	readonly action: string;
	/** The store the request is about, when it is store-scoped. */
	readonly locationId?: string;
}

/**
 * Cedar decisions against each tenant's published policy bundle (cached per process, dropped on
 * every instance when a policy is published). Used by tenants (merchant capabilities, membership,
 * locations), encryption (the policy version stamped on tenant keys) and support access.
 */
export interface CedarPolicyEvaluatorPort {
	getActivePolicyVersion(tenantId: string): Promise<number>;
	evaluate(input: CedarEvaluationInput): Promise<CedarAuthorizationDecision>;
}
