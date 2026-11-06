import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import { tenantRoutes } from "@/lib/routes";
import { redirect } from "next/navigation";
import { appRoute } from "@workspace/client/lib/navigation/app-route";

interface TenantDashboardPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** Tenant root — the dashboard is the tenant's landing page. */
export default async function TenantDashboardPage({ params }: TenantDashboardPageProps): Promise<React.ReactNode> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/");
	if (denied !== null) {
		return denied;
	}
	redirect(appRoute(tenantRoutes(tenantSlug).dashboard));
}
