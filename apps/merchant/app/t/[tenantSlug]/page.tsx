import { guardOrgPage } from "@/contexts/tenancy/lib/org/org-page-guard";
import { tenantRoutes } from "@/lib/routes";
import { redirect } from "next/navigation";

interface OrgDashboardPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** Tenant root — the dashboard is the org's landing page. */
export default async function OrgDashboardPage({ params }: OrgDashboardPageProps): Promise<React.ReactNode> {
	const { tenantSlug } = await params;
	const denied = await guardOrgPage(tenantSlug, "/");
	if (denied !== null) {
		return denied;
	}
	redirect(tenantRoutes(tenantSlug).dashboard);
}
