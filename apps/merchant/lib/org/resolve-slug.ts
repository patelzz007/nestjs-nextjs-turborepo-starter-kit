import type { MerchantMembershipResponse } from "@workspace/shared";
import { OrganizationSlugSchema, UuidParamSchema } from "@workspace/shared";

export interface ResolvedOrganizationTenant {
	readonly slug: string | null;
	readonly merchantOrgId: string;
	readonly organizationId: string;
}

/** True when `value` is a human slug — not a UUID accidentally used as a tenant path segment. */
export function isCanonicalOrganizationSlug(value: string): boolean {
	if (UuidParamSchema.safeParse(value).success) {
		return false;
	}
	return OrganizationSlugSchema.safeParse(value).success;
}

function toResolvedTenant(membership: MerchantMembershipResponse, requireSlug: boolean): ResolvedOrganizationTenant | undefined {
	const organizationId = membership.organizationId;
	if (organizationId === null) {
		return undefined;
	}

	const slug = membership.organizationSlug;
	if (slug !== null && !isCanonicalOrganizationSlug(slug)) {
		return undefined;
	}

	if (requireSlug && slug === null) {
		return undefined;
	}

	return {
		slug,
		merchantOrgId: membership.merchantOrgId,
		organizationId,
	};
}

/**
 * Resolves `/orgs/:segment` to a canonical slug.
 * `segment` may be a slug, organization id, or merchant org id.
 */
export function resolveOrganizationTenantFromUrlSegment(memberships: readonly MerchantMembershipResponse[], segment: string): ResolvedOrganizationTenant | undefined {
	if (isCanonicalOrganizationSlug(segment)) {
		const bySlug = memberships.find((row) => row.organizationSlug === segment);
		if (bySlug !== undefined) {
			return toResolvedTenant(bySlug, true);
		}
		return undefined;
	}

	if (!UuidParamSchema.safeParse(segment).success) {
		return undefined;
	}

	const byOrganizationId = memberships.find((row) => row.organizationId === segment);
	if (byOrganizationId !== undefined) {
		return toResolvedTenant(byOrganizationId, false);
	}

	const byMerchantOrgId = memberships.find((row) => row.merchantOrgId === segment);
	if (byMerchantOrgId !== undefined) {
		return toResolvedTenant(byMerchantOrgId, false);
	}

	return undefined;
}

export function resolveOrganizationSlugForMerchantOrg(memberships: readonly MerchantMembershipResponse[], merchantOrgId: string | undefined): string | undefined {
	const activeMembership = merchantOrgId !== undefined ? memberships.find((row) => row.merchantOrgId === merchantOrgId) : memberships[0];
	if (activeMembership === undefined) {
		return undefined;
	}
	return toResolvedTenant(activeMembership, true)?.slug ?? undefined;
}
