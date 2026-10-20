import { hasCapability, type CapabilitySlug } from "@workspace/shared";

import { isOrgPageRuleSatisfied, ORG_PAGE_RULES, type OrgPageDenialCopy, type OrgPageRoute } from "@/lib/navigation/org-route-authorization";
import { resolveMerchantCapabilities, type MerchantRoleHolder } from "@/lib/session/server-capabilities";

/** Outcome of the server-side org page check. */
export type OrgPageAccess = { readonly allowed: true } | { readonly allowed: false; readonly denial: OrgPageDenialCopy | undefined };

/**
 * Whether the signed-in user may open `route` with `membership` — their own membership in the URL's
 * tenant (`undefined` when they have none: gated routes fail closed). Open routes are allowed.
 */
export function decideOrgPageAccess(membership: MerchantRoleHolder | undefined, route: OrgPageRoute): OrgPageAccess {
	const rule = ORG_PAGE_RULES[route];
	if (rule.kind === "open") {
		return { allowed: true };
	}

	const capabilities = resolveMerchantCapabilities(membership);
	const isGranted = (capability: CapabilitySlug): boolean => hasCapability(capabilities, capability);
	return isOrgPageRuleSatisfied(rule, isGranted) ? { allowed: true } : { allowed: false, denial: rule.denial };
}
