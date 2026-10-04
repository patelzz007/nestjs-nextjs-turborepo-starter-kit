import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

import AccessControlPanel from "./access-control-panel";

export const dynamic = "force-dynamic";

/**
 * `/settings/access` — roles & permissions catalog + global permission checker.
 * Both catalogs are prefetched; a failure is logged and the client query of
 * that tab loads it (and shows its error state if it fails again).
 */
export default async function AccessControlPage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const [rolesResult, permissionsResult] = await Promise.all([
		prefetch({ page: "/settings/access", resource: "roles" }, () => server.admin.roles.list.query({})),
		prefetch({ page: "/settings/access", resource: "permissions" }, () => server.admin.permissions.list.query({})),
	]);

	return <AccessControlPanel initialRoles={resolvePrefetchedData(rolesResult)} initialPermissions={resolvePrefetchedData(permissionsResult)} />;
}
