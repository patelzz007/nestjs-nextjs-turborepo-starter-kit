import type { CedarDecision } from "@workspace/shared";

/**
 * The single policy-engine port. Runtime authorization
 * (`CedarPolicyEvaluatorService`) and the control-plane simulation
 * (`PolicySimulationService`) both decide through it, so a simulation can
 * never disagree with the runtime; draft validation uses it too.
 */

/** The principal: an organization member and the attributes policies may read. */
export interface PolicyPrincipal {
	readonly userId: string;
	readonly role: string;
	readonly locationScope: string;
	readonly locationIds: readonly string[];
}

export interface PolicyRequest {
	readonly organizationId: string;
	readonly principal: PolicyPrincipal;
	/** Bare action id, e.g. `rewardhub:manage_team` (declared in the Cedar schema). */
	readonly action: string;
	/** The store the request is about, when it is store-scoped. */
	readonly locationId?: string;
}

/** The published (or candidate) policy sources of one organization's bundle. */
export interface PolicyBundle {
	/** Highest published version in the bundle (reported on decisions and audit rows). */
	readonly version: number;
	readonly sources: readonly string[];
}

export type PolicyDiagnostic = "explicit_permit" | "explicit_forbid" | "default_deny" | "evaluation_error";

export interface PolicyEngineDecision {
	readonly decision: CedarDecision;
	readonly diagnostic: PolicyDiagnostic;
}

export type PolicyValidationResult = { readonly valid: true } | { readonly valid: false; readonly errors: readonly string[] };

export interface PolicyEngine {
	/** Parse and strictly validate policy source against the schema. */
	validate(policySource: string): PolicyValidationResult;
	/** Decide one request against a bundle. Throws {@link PolicyEngineError} when the engine cannot answer. */
	decide(bundle: PolicyBundle, request: PolicyRequest): PolicyEngineDecision;
}

/** Nest injection token of the configured {@link PolicyEngine}. */
export const POLICY_ENGINE: unique symbol = Symbol("POLICY_ENGINE");

/** The engine rejected the request or the policy set (malformed input, unknown action, unparsable policy). */
export class PolicyEngineError extends Error {
	public constructor(
		message: string,
		public readonly details: readonly string[],
	) {
		super(`${message}: ${details.join("; ")}`);
		this.name = "PolicyEngineError";
	}
}
