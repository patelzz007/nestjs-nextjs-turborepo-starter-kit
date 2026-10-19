import { OrgTenantBootstrap } from "@/contexts/organizations/components/org/org-tenant-bootstrap";
import { MerchantShell } from "@/components/merchant-shell";
import { getMerchantServerSession } from "@/contexts/identity/lib/server";
import { loadMerchantServerContext, loadOrganizationContext, loadPreferredOrganizationSlug, readSidebarOpen } from "@/lib/merchant-server-api";
import { isCanonicalOrganizationSlug } from "@/contexts/organizations/lib/org/resolve-slug";
import { loadServerLocationScope, type ServerLocationScope } from "@/contexts/organizations/lib/org/server-location-scope";
import { orgRoutes, ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";

interface OrgLayoutProps {
	readonly children: React.ReactNode;
	readonly params: Promise<{ orgSlug: string }>;
}

export const dynamic = "force-dynamic";

/**
 * The `/orgs/[orgSlug]` shell. The URL owns the tenant, and the organization context (which answers only a
 * member) says whether the segment is one of the member's organizations:
 * - an organization-id segment of one of the member's organizations redirects to its canonical slug;
 * - a segment that is none of the member's organizations redirects to the member's PREFERRED
 *   organization — the `organizationSlug` cookie, followed only when the API confirms the membership —
 *   or, without a valid preference, renders (the page guard denies) / sends a member-less user to onboarding.
 */
export default async function OrgLayout({ children, params }: OrgLayoutProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const [ctx, session, urlContext, sidebarOpen] = await Promise.all([
		loadMerchantServerContext(),
		getMerchantServerSession(),
		loadOrganizationContext(orgSlug),
		readSidebarOpen(),
	]);
	const resolvedTenant = urlContext?.data.organization;

	if (!isCanonicalOrganizationSlug(orgSlug) && resolvedTenant !== undefined) {
		redirect(orgRoutes(resolvedTenant.slug).dashboard);
	}

	// The preference is looked up only when the URL's organization did not resolve: an ordinary
	// navigation makes no call for it, and cannot fail because of a store the URL does not name.
	if (resolvedTenant === undefined) {
		const preferredSlug: string | undefined = await loadPreferredOrganizationSlug();
		if (!isCanonicalOrganizationSlug(orgSlug)) {
			redirect(preferredSlug !== undefined ? orgRoutes(preferredSlug).dashboard : ROUTES.onboarding);
		}
		if (preferredSlug !== undefined && preferredSlug !== orgSlug) {
			redirect(orgRoutes(preferredSlug).dashboard);
		}
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
			initialIsImpersonating={session.isImpersonating}
			initialSidebarOpen={sidebarOpen}>
			{resolvedTenant !== undefined ? <OrgTenantBootstrap orgSlug={resolvedTenant.slug} /> : null}
			{children}
		</MerchantShell>
	);
}
