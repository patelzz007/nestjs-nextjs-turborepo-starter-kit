import { OrganizationBrandingPageView } from "@/components/org/organization-branding-page-view";
import { guardOrgPage } from "@/lib/org/org-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface OrganizationBrandingPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

/** Store branding — the logo is readable with `merchant:view_locations`; changing it needs `merchant:manage_locations` (enforced by the API). */
export default async function OrganizationBrandingPage({ params }: OrganizationBrandingPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/settings/branding");
	if (denied !== null) {
		return denied;
	}

	return <OrganizationBrandingPageView orgSlug={orgSlug} />;
}
