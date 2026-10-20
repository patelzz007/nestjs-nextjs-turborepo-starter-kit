import { OrgDashboardPageView } from "@/contexts/tenancy/components/org/org-dashboard-page-view";
import { loadTenantContext } from "@/lib/merchant-server-api";
import { guardOrgPage } from "@/contexts/tenancy/lib/org/org-page-guard";
import type { TenantContextResponse } from "@workspace/shared";

interface OrgDashboardPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

export const dynamic = "force-dynamic";

/**
 * Tenant dashboard. The org layout has already redirected any id or
 * foreign segment to a canonical slug of the member's own tenant, and
 * the guard has confirmed the membership — so `orgSlug` IS the tenant.
 */
export default async function OrgDashboardPage({ params }: OrgDashboardPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardOrgPage(tenantSlug, "/dashboard");
	if (denied !== null) {
		return denied;
	}

	// Shared (per request) with the org layout, which loads the same context for the tenant-context seed.
	// `undefined` only when the API refused it (the membership ended mid-request); outages reach `error.tsx`.
	const context: TenantContextResponse | null = (await loadTenantContext(tenantSlug))?.data ?? null;

	return <OrgDashboardPageView tenantSlug={tenantSlug} context={context} contextError={context === null} />;
}
