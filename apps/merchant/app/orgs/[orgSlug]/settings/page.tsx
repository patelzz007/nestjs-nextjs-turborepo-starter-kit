import { OrganizationSettingsIndexView } from "@/components/org/organization-settings-index-view";
import { guardOrgPage } from "@/lib/org/org-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface OrganizationSettingsPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

/** Organization settings section index — links to team, locations, and business verification. */
export default async function OrganizationSettingsPage({ params }: OrganizationSettingsPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/settings");
	if (denied !== null) {
		return denied;
	}

	return <OrganizationSettingsIndexView orgSlug={orgSlug} />;
}
