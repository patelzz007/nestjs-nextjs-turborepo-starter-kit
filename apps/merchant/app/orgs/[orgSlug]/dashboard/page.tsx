import { OrgDashboardPageView } from "@/components/org/org-dashboard-page-view";
import { loadOrganizationContext } from "@/lib/merchant-server-api";
import { guardOrgPage } from "@/lib/org/org-page-guard";
import type { OrganizationContextResponse } from "@workspace/shared";

interface OrgDashboardPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

export const dynamic = "force-dynamic";

/**
 * Organization dashboard. The org layout has already redirected any id or
 * foreign segment to a canonical slug of the member's own organization, and
 * the guard has confirmed the membership — so `orgSlug` IS the organization.
 */
export default async function OrgDashboardPage({ params }: OrgDashboardPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/dashboard");
	if (denied !== null) {
		return denied;
	}

	// Shared (per request) with the org layout, which loads the same context for the tenant-context seed.
	// `undefined` only when the API refused it (the membership ended mid-request); outages reach `error.tsx`.
	const context: OrganizationContextResponse | null = (await loadOrganizationContext(orgSlug))?.data ?? null;

	return <OrgDashboardPageView orgSlug={orgSlug} context={context} contextError={context === null} />;
}
