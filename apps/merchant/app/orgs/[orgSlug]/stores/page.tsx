import { OrganizationStoresPageView } from "@/contexts/organizations/components/org/organization-stores-page-view";
import { guardOrgPage } from "@/contexts/organizations/lib/org/org-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface OrganizationStoresPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

/** Every store the member belongs to — open in `ORG_PAGE_RULES` (the API lists only the caller's own memberships). */
export default async function OrganizationStoresPage({ params }: OrganizationStoresPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/stores");
	if (denied !== null) {
		return denied;
	}

	return <OrganizationStoresPageView orgSlug={orgSlug} />;
}
