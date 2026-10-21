import { hasCapability, type CapabilitySlug } from "@workspace/shared";

import { isTenantPageRuleSatisfied, ORG_PAGE_RULES, type TenantPageDenialCopy, type TenantPageRoute } from "@/lib/navigation/tenant-route-authorization";
import { resolveMerchantCapabilities, type MerchantRoleHolder } from "@/lib/session/server-capabilities";

/** Outcome of the server-side tenant page check. */
export type TenantPageAccess = { readonly allowed: true } | { readonly allowed: false; readonly denial: TenantPageDenialCopy | undefined };

/**
 * Whether the signed-in user may open `route` with `membership` — their own membership in the URL's
 * tenant (`undefined` when they have none: gated routes fail closed). Open routes are allowed.
 */
export function decideTenantPageAccess(membership: MerchantRoleHolder | undefined, route: TenantPageRoute): TenantPageAccess {
	const rule = ORG_PAGE_RULES[route];
	if (rule.kind === "open") {
		return { allowed: true };
	}

	const capabilities = resolveMerchantCapabilities(membership);
	const isGranted = (capability: CapabilitySlug): boolean => hasCapability(capabilities, capability);
	return isTenantPageRuleSatisfied(rule, isGranted) ? { allowed: true } : { allowed: false, denial: rule.denial };
}
