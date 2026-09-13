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

export function resolveOrganizationSlugFromContext(memberships: readonly OrganizationRewardMembershipResponse[], preferredSlug: string | undefined): string | undefined {
	if (preferredSlug !== undefined && memberships.some((row) => row.organizationSlug === preferredSlug)) {
		return preferredSlug;
	}
	return memberships[0]?.organizationSlug;
}
