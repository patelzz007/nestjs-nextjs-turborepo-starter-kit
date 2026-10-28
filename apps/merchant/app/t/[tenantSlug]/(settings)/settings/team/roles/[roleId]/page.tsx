import { TeamRoleDetailPageView } from "@/contexts/tenancy/components/access/team-role-detail-page-view";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface TeamRolePageProps {
	readonly params: Promise<{ tenantSlug: string; roleId: string }>;
}

/** One tenant role, read-only, with reset and delete. */
export default async function TeamRolePage({ params }: TeamRolePageProps): Promise<React.JSX.Element> {
	const { tenantSlug, roleId } = await params;
	const denied = await guardTenantPage(tenantSlug, "/settings/team/roles/[roleId]");
	if (denied !== null) {
		return denied;
	}
	return <TeamRoleDetailPageView tenantSlug={tenantSlug} roleId={roleId} />;
}
