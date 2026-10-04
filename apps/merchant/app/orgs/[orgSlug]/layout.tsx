import { OrgTenantBootstrap } from "@/components/org/org-tenant-bootstrap";
import { MerchantShell } from "@/components/merchant-shell";
import { getMerchantServerSession } from "@/lib/auth/server";
import { loadMerchantServerContext, readOrganizationSlugCookie } from "@/lib/merchant-server-api";
import { isCanonicalOrganizationSlug, resolveOrganizationTenantFromUrlSegment, resolvePreferredMembershipSlug } from "@/lib/org/resolve-slug";
import { loadServerLocationScope, type ServerLocationScope } from "@/lib/org/server-location-scope";
import { orgRoutes, ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";

interface OrgLayoutProps {
	readonly children: React.ReactNode;
	readonly params: Promise<{ orgSlug: string }>;
}

export const dynamic = "force-dynamic";

/**
 * The `/orgs/[orgSlug]` shell. The URL owns the tenant:
 * - an organization-id segment of one of the member's organizations redirects to its canonical slug;
 * - a segment that is none of the member's organizations redirects to the member's PREFERRED
 *   organization — the `organizationSlug` cookie, followed only when it names one of their own
 *   memberships — or, without a valid preference, renders (the page guard denies) / sends a
 *   member-less user to onboarding.
 */
export default async function OrgLayout({ children, params }: OrgLayoutProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const [ctx, session, storedSlug] = await Promise.all([loadMerchantServerContext(), getMerchantServerSession(), readOrganizationSlugCookie()]);
	const resolvedTenant = resolveOrganizationTenantFromUrlSegment(ctx.memberships, orgSlug);
	const preferredSlug = resolvePreferredMembershipSlug(ctx.memberships, storedSlug);

	if (!isCanonicalOrganizationSlug(orgSlug)) {
		if (resolvedTenant !== undefined) {
			redirect(orgRoutes(resolvedTenant.slug).dashboard);
		}
		redirect(preferredSlug !== undefined ? orgRoutes(preferredSlug).dashboard : ROUTES.onboarding);
	}

	if (resolvedTenant === undefined && preferredSlug !== undefined && preferredSlug !== orgSlug) {
		redirect(orgRoutes(preferredSlug).dashboard);
	}

	// Seeds the tenant context (store filter + accessible locations) so the first client render
	// asks for exactly the store the pages prefetch. Skipped for a non-member: the page guard denies.
	const locationScope: ServerLocationScope | undefined = resolvedTenant !== undefined ? await loadServerLocationScope(orgSlug) : undefined;

	return (
		<MerchantShell
			orgSlug={orgSlug}
			initialLocationId={locationScope?.selectedLocationId ?? null}
			initialOrganizationContext={locationScope?.organizationContext}
			initialMemberships={ctx.membershipsEnvelope}
			initialUser={session.user}
			initialIsImpersonating={session.isImpersonating}>
			{resolvedTenant !== undefined ? <OrgTenantBootstrap orgSlug={resolvedTenant.slug} /> : null}
			{children}
		</MerchantShell>
	);
}
