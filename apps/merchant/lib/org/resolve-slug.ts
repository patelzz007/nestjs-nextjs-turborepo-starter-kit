import type { OrganizationRewardMembershipResponse } from "@workspace/shared";
import { OrganizationSlugSchema, UuidParamSchema } from "@workspace/shared";

export interface ResolvedOrganizationTenant {
	readonly slug: string;
	readonly organizationId: string;
}

/** True when `value` is a human slug — not a UUID accidentally used as a tenant path segment. */
export function isCanonicalOrganizationSlug(value: string): boolean {
	if (UuidParamSchema.safeParse(value).success) {
		return false;
	}
	return OrganizationSlugSchema.safeParse(value).success;
}

function toResolvedTenant(membership: OrganizationRewardMembershipResponse): ResolvedOrganizationTenant {
	return {
		slug: membership.organizationSlug,
		organizationId: membership.organizationId,
	};
}

/** Resolves `/orgs/:segment` to a canonical slug (segment may be slug or organization id). */
export function resolveOrganizationTenantFromUrlSegment(
	memberships: readonly OrganizationRewardMembershipResponse[],
	segment: string,
): ResolvedOrganizationTenant | undefined {
	if (isCanonicalOrganizationSlug(segment)) {
		const bySlug = memberships.find((row) => row.organizationSlug === segment);
		if (bySlug !== undefined) {
			return toResolvedTenant(bySlug);
		}
		return undefined;
	}

	if (!UuidParamSchema.safeParse(segment).success) {
		return undefined;
	}

	const byOrganizationId = memberships.find((row) => row.organizationId === segment);
	if (byOrganizationId !== undefined) {
		return toResolvedTenant(byOrganizationId);
	}

	return undefined;
}

/**
 * The membership for exactly the organization in the URL (`/orgs/{slug or id}`).
 * Never borrows another organization's role: a URL for an organization the
 * user does not belong to (or no organization at all) resolves to nothing, so
 * every capability derived from it fails closed.
 */
export function resolveUrlOrganizationMembership(
	memberships: readonly OrganizationRewardMembershipResponse[],
	orgSegment: string | undefined,
): OrganizationRewardMembershipResponse | undefined {
	if (orgSegment === undefined) {
		return undefined;
	}
	const tenant = resolveOrganizationTenantFromUrlSegment(memberships, orgSegment);
	return tenant === undefined ? undefined : memberships.find((membership) => membership.organizationId === tenant.organizationId);
}

/**
 * The preferred organization (the `organizationSlug` cookie) when it is a
 * canonical slug of one of the user's memberships, else `undefined`. A cookie
 * is client input: it is never followed unless it names the user's own organization.
 */
export function resolvePreferredMembershipSlug(memberships: readonly OrganizationRewardMembershipResponse[], preferredSlug: string | undefined): string | undefined {
	if (preferredSlug === undefined || !isCanonicalOrganizationSlug(preferredSlug)) {
		return undefined;
	}
	return memberships.some((row) => row.organizationSlug === preferredSlug) ? preferredSlug : undefined;
}

/** The organization an entry page opens: the validated preference, else the first membership. */
export function resolveOrganizationSlugFromContext(memberships: readonly OrganizationRewardMembershipResponse[], preferredSlug: string | undefined): string | undefined {
	return resolvePreferredMembershipSlug(memberships, preferredSlug) ?? memberships.at(0)?.organizationSlug;
}
