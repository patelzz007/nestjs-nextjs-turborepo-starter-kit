import { OrgDashboardPageView } from "@/components/org/org-dashboard-page-view";
import { loadMerchantServerContext, loadOrganizationContext } from "@/lib/merchant-server-api";
import { guardOrgPage } from "@/lib/org/org-page-guard";
import { resolveOrganizationTenantFromUrlSegment } from "@/lib/org/resolve-slug";
import type { OrganizationContextResponse } from "@workspace/shared";

interface OrgDashboardPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

export const dynamic = "force-dynamic";

export default async function OrgDashboardPage({ params }: OrgDashboardPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/dashboard");
	if (denied !== null) {
		return denied;
	}
	const ctx = await loadMerchantServerContext();
	const resolvedTenant = resolveOrganizationTenantFromUrlSegment(ctx.memberships, orgSlug);
	const contextRouteKey = resolvedTenant?.slug ?? orgSlug;

	// Shared (per request) with the org layout, which loads the same context for the tenant-context seed.
	const context: OrganizationContextResponse | null = (await loadOrganizationContext(contextRouteKey)) ?? null;
	const contextError = context === null;

	const displaySlug = context?.organization.slug ?? resolvedTenant?.slug ?? orgSlug;

	return <OrgDashboardPageView orgSlug={displaySlug} context={context} contextError={contextError} />;
}
