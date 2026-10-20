import { OrgTenantBootstrap } from "@/contexts/tenancy/components/org/org-tenant-bootstrap";
import { MerchantShell } from "@/components/merchant-shell";
import { getMerchantServerSession } from "@/contexts/identity/lib/server";
import { loadMerchantServerContext, loadTenantContext, loadPreferredTenantSlug, readSidebarOpen } from "@/lib/merchant-server-api";
import { isCanonicalTenantSlug } from "@/contexts/tenancy/lib/org/resolve-slug";
import { loadServerLocationScope, type ServerLocationScope } from "@/contexts/tenancy/lib/org/server-location-scope";
import { tenantRoutes, ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";

interface OrgLayoutProps {
	readonly children: React.ReactNode;
	readonly params: Promise<{ tenantSlug: string }>;
}

export const dynamic = "force-dynamic";

/**
 * The `/t/[tenantSlug]` shell. The URL owns the tenant, and the tenant context (which answers only a
 * member) says whether the segment is one of the member's tenants:
 * - a tenant-id segment of one of the member's tenants redirects to its canonical slug;
 * - a segment that is none of the member's tenants redirects to the member's PREFERRED
 *   tenant — the `tenantSlug` cookie, followed only when the API confirms the membership —
 *   or, without a valid preference, renders (the page guard denies) / sends a member-less user to onboarding.
 */
export default async function OrgLayout({ children, params }: OrgLayoutProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const [ctx, session, urlContext, sidebarOpen] = await Promise.all([
		loadMerchantServerContext(),
		getMerchantServerSession(),
		loadTenantContext(tenantSlug),
		readSidebarOpen(),
	]);
	const resolvedTenant = urlContext?.data.tenant;

	if (!isCanonicalTenantSlug(tenantSlug) && resolvedTenant !== undefined) {
		redirect(tenantRoutes(resolvedTenant.slug).dashboard);
	}

	// The preference is looked up only when the URL's tenant did not resolve: an ordinary
	// navigation makes no call for it, and cannot fail because of a store the URL does not name.
	if (resolvedTenant === undefined) {
		const preferredSlug: string | undefined = await loadPreferredTenantSlug();
		if (!isCanonicalTenantSlug(tenantSlug)) {
			redirect(preferredSlug !== undefined ? tenantRoutes(preferredSlug).dashboard : ROUTES.onboarding);
		}
		if (preferredSlug !== undefined && preferredSlug !== tenantSlug) {
			redirect(tenantRoutes(preferredSlug).dashboard);
		}
	}

	// Seeds the tenant context (store filter + accessible locations) so the first client render
	// asks for exactly the store the pages prefetch. Skipped for a non-member: the page guard denies.
	const locationScope: ServerLocationScope | undefined = resolvedTenant !== undefined ? await loadServerLocationScope(tenantSlug) : undefined;

	return (
		<MerchantShell
			tenantSlug={tenantSlug}
			initialLocationId={locationScope?.selectedLocationId ?? null}
			initialTenantContext={locationScope?.tenantContext}
			initialMemberships={ctx.membershipsEnvelope}
			initialUser={session.user}
			initialIsImpersonating={session.isImpersonating}
			initialSidebarOpen={sidebarOpen}>
			{resolvedTenant !== undefined ? <OrgTenantBootstrap tenantSlug={resolvedTenant.slug} /> : null}
			{children}
		</MerchantShell>
	);
}
