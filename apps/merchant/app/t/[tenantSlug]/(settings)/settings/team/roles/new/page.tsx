import { TeamRoleEditorPageView } from "@/contexts/tenancy/components/access/team-role-editor-page-view";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface NewTeamRolePageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** A new tenant role. */
export default async function NewTeamRolePage({ params }: NewTeamRolePageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/settings/team/roles/new");
	if (denied !== null) {
		return denied;
	}
	return <TeamRoleEditorPageView tenantSlug={tenantSlug} />;
}
