import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import { tenantRoutes } from "@/lib/routes";
import { redirect } from "next/navigation";
import type * as React from "react";

export const dynamic = "force-dynamic";

interface TeamRolesPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** The roles are the Roles tab of Team & permissions; this address (kept for links and bookmarks) opens it. */
export default async function TeamRolesPage({ params }: TeamRolesPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/settings/team/roles");
	if (denied !== null) {
		return denied;
	}
	redirect(`${tenantRoutes(tenantSlug).settings.team}?tab=roles`);
}
