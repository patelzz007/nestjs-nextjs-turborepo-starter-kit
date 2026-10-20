import { TenantBrandingPageView } from "@/contexts/tenancy/components/org/tenant-branding-page-view";
import { guardOrgPage } from "@/contexts/tenancy/lib/org/org-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface TenantBrandingPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** Store branding — the logo is readable with `merchant:view_locations`; changing it needs `merchant:manage_locations` (enforced by the API). */
export default async function TenantBrandingPage({ params }: TenantBrandingPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardOrgPage(tenantSlug, "/settings/branding");
	if (denied !== null) {
		return denied;
	}

	return <TenantBrandingPageView tenantSlug={tenantSlug} />;
}
