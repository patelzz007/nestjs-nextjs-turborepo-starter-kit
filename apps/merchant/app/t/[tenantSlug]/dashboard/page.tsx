import { TenantDashboardPageView } from "@/contexts/tenancy/components/tenant/tenant-dashboard-page-view";
import { loadTenantContext } from "@/lib/merchant-server-api";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import type { TenantContextResponse } from "@workspace/shared";

interface TenantDashboardPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

export const dynamic = "force-dynamic";

/**
 * Tenant dashboard. The tenant layout has already redirected any id or
 * foreign segment to a canonical slug of the member's own tenant, and
 * the guard has confirmed the membership — so `tenantSlug` IS the tenant.
 */
export default async function TenantDashboardPage({ params }: TenantDashboardPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/dashboard");
	if (denied !== null) {
		return denied;
	}

	// Shared (per request) with the tenant layout, which loads the same context for the tenant-context seed.
	// `undefined` only when the API refused it (the membership ended mid-request); outages reach `error.tsx`.
	const context: TenantContextResponse | null = (await loadTenantContext(tenantSlug))?.data ?? null;

	return <TenantDashboardPageView tenantSlug={tenantSlug} context={context} contextError={context === null} />;
}
