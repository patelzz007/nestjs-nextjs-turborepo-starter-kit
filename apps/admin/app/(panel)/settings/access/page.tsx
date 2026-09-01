import { createAdminServerCaller } from "@/lib/admin-server-api";

import AccessControlPanel from "./access-control-panel";

export const dynamic = "force-dynamic";

/** `/settings/access` — roles & permissions catalog + global permission checker. */
export default async function AccessControlPage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const [rolesResult, permissionsResult] = await Promise.allSettled([server.admin.roles.list.query({}), server.admin.permissions.list.query({})]);

	const initialRoles = rolesResult.status === "fulfilled" ? rolesResult.value.data.items : undefined;
	const initialPermissions = permissionsResult.status === "fulfilled" ? permissionsResult.value.data.items : undefined;

	return <AccessControlPanel initialRoles={initialRoles} initialPermissions={initialPermissions} />;
}
