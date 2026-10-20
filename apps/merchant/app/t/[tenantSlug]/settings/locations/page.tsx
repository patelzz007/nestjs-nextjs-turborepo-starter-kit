import { LocationsPageView } from "@/contexts/tenancy/components/org/tenant-locations-page-view";
import { guardOrgPage } from "@/contexts/tenancy/lib/org/org-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface LocationsPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** Store locations — readable with `merchant:view_locations`; requests need `merchant:manage_locations`. */
export default async function LocationsPage({ params }: LocationsPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardOrgPage(tenantSlug, "/settings/locations");
	if (denied !== null) {
		return denied;
	}

	return <LocationsPageView tenantSlug={tenantSlug} />;
}
