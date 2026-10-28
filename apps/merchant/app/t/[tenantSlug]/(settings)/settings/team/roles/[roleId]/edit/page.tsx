import { TeamRoleEditorPageView } from "@/contexts/tenancy/components/access/team-role-editor-page-view";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface EditTeamRolePageProps {
	readonly params: Promise<{ tenantSlug: string; roleId: string }>;
}

/** The editor of one tenant role (never the Owner role). */
export default async function EditTeamRolePage({ params }: EditTeamRolePageProps): Promise<React.JSX.Element> {
	const { tenantSlug, roleId } = await params;
	const denied = await guardTenantPage(tenantSlug, "/settings/team/roles/[roleId]/edit");
	if (denied !== null) {
		return denied;
	}
	return <TeamRoleEditorPageView tenantSlug={tenantSlug} roleId={roleId} />;
}
