import { OrganizationLocationsPageView } from "@/components/org/organization-locations-page-view";
import { guardOrgPage } from "@/lib/org/org-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface OrganizationLocationsPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

/** Store locations — readable with `merchant:view_locations`; requests need `merchant:manage_locations`. */
export default async function OrganizationLocationsPage({ params }: OrganizationLocationsPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/settings/locations");
	if (denied !== null) {
		return denied;
	}

	return <OrganizationLocationsPageView orgSlug={orgSlug} />;
}
