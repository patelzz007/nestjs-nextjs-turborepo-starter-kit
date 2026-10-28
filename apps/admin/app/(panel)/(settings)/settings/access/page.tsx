import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedQuery } from "@/lib/server/prefetch";
import { PERMISSIONS_URL_STATE, ROLES_URL_STATE, toPermissionsQuery, toRolesQuery } from "@/contexts/authorization/url-state/access";

import AccessControlPanel from "@/contexts/authorization/components/access-control-panel";

export const dynamic = "force-dynamic";

/**
 * `/settings/access` — roles & permissions catalog + global permission checker.
 * The server parses each list's URL state and prefetches that exact page; a failure
 * is logged and the client query of that tab loads it (and shows its error state if it fails again).
 */
export default async function AccessControlPage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const search = await searchParams;
	const rolesState = ROLES_URL_STATE.parse(search);
	const permissionsState = PERMISSIONS_URL_STATE.parse(search);
	const server = createAdminServerCaller();
	const [rolesResult, permissionsResult] = await Promise.all([
		prefetch({ page: "/settings/access", resource: "roles" }, () => server.admin.roles.list.query(toRolesQuery(rolesState))),
		prefetch({ page: "/settings/access", resource: "permissions" }, () => server.admin.permissions.list.query(toPermissionsQuery(permissionsState))),
	]);

	return (
		<AccessControlPanel
			initialRoles={resolvePrefetchedQuery(ROLES_URL_STATE.serialize(rolesState), rolesResult)}
			initialPermissions={resolvePrefetchedQuery(PERMISSIONS_URL_STATE.serialize(permissionsState), permissionsResult)}
		/>
	);
}
