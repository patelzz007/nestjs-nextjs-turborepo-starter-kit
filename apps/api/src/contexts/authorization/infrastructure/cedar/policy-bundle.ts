import type { PolicyBundleSource } from "../../application/ports/policy-control-plane.port";
import type { PolicyBundle } from "../../application/ports/policy-engine.port";

export type { PolicyBundleSource };

/** Version reported when no policy version is published for a tenant. */
export const NO_PUBLISHED_POLICY_VERSION = 1;

/**
 * Whether a published version is part of a tenant's runtime bundle:
 * the tenant's own versions plus the platform guardrails. Platform-wide
 * `PLATFORM` versions are NOT part of any bundle. The runtime's bundle query
 * (`CedarPolicyEvaluatorService`) and the simulation both apply this rule.
 */
export function isVersionInTenantBundle(source: Pick<PolicyBundleSource, "tenantId" | "scope">, tenantId: string): boolean {
	if (source.tenantId === tenantId) {
		return true;
	}
	return source.tenantId === null && source.scope === "PLATFORM_GUARDRAIL";
}

/** The bundle the engine evaluates, from the versions that are in it. */
export function composePolicyBundle(sources: readonly Pick<PolicyBundleSource, "version" | "cedarSource">[]): PolicyBundle {
	let version = NO_PUBLISHED_POLICY_VERSION;
	for (const source of sources) {
		version = Math.max(version, source.version);
	}
	return { version, sources: sources.map((source) => source.cedarSource) };
}
