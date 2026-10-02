import { OrganizationTeamPageView } from "@/components/org/organization-team-page-view";
import { guardOrgPage } from "@/lib/org/org-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface OrganizationTeamPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

/** Team roster and invitations — `merchant:manage_team`. */
export default async function OrganizationTeamPage({ params }: OrganizationTeamPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/settings/team");
	if (denied !== null) {
		return denied;
	}

	return <OrganizationTeamPageView orgSlug={orgSlug} />;
}
