import { OrgDashboardPageView } from "@/components/org/org-dashboard-page-view";
import { OrgSlugBootstrap } from "@/components/org/org-slug-bootstrap";
import { MerchantShell } from "@/components/merchant-shell";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import { resolveOrganizationTenantFromUrlSegment } from "@/lib/org/resolve-slug";
import type { OrganizationContextResponse } from "@workspace/shared";

interface OrgDashboardPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

export const dynamic = "force-dynamic";

export default async function OrgDashboardPage({ params }: OrgDashboardPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const ctx = await loadMerchantServerContext();
	const resolvedTenant = resolveOrganizationTenantFromUrlSegment(ctx.memberships, orgSlug);
	const contextRouteKey = resolvedTenant?.slug ?? orgSlug;

	let context: OrganizationContextResponse | null = null;
	let contextError = false;

	try {
		const response = await ctx.server.organizations.context.query({ orgSlug: contextRouteKey });
		context = response.data;
	} catch {
		contextError = true;
	}

	const displaySlug = context?.organization.slug ?? resolvedTenant?.slug ?? orgSlug;

	return (
		<MerchantShell initialMemberships={ctx.memberships} initialMerchantOrgId={resolvedTenant?.merchantOrgId ?? ctx.merchantOrgId}>
			<OrgSlugBootstrap orgSlug={displaySlug} />
			<OrgDashboardPageView orgSlug={displaySlug} context={context} contextError={contextError} />
		</MerchantShell>
	);
}
