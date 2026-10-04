import type { AuthorizationPolicyScope } from "@prisma/client";

import type { PolicyBundle } from "../engine/policy-engine.port";

/** One published (or candidate) policy version that contributes to bundles. */
export interface PolicyBundleSource {
	readonly organizationId: string | null;
	readonly scope: AuthorizationPolicyScope;
	readonly version: number;
	readonly cedarSource: string;
}

/** Version reported when no policy version is published for an organization. */
export const NO_PUBLISHED_POLICY_VERSION = 1;

/**
 * Whether a published version is part of an organization's runtime bundle:
 * the organization's own versions plus the platform guardrails. Platform-wide
 * `PLATFORM` versions are NOT part of any bundle. The runtime's bundle query
 * (`CedarPolicyEvaluatorService`) and the simulation both apply this rule.
 */
export function isVersionInOrganizationBundle(source: Pick<PolicyBundleSource, "organizationId" | "scope">, organizationId: string): boolean {
	if (source.organizationId === organizationId) {
		return true;
	}
	return source.organizationId === null && source.scope === "PLATFORM_GUARDRAIL";
}

/** The bundle the engine evaluates, from the versions that are in it. */
export function composePolicyBundle(sources: readonly Pick<PolicyBundleSource, "version" | "cedarSource">[]): PolicyBundle {
	let version = NO_PUBLISHED_POLICY_VERSION;
	for (const source of sources) {
		version = Math.max(version, source.version);
	}
	return { version, sources: sources.map((source) => source.cedarSource) };
}
