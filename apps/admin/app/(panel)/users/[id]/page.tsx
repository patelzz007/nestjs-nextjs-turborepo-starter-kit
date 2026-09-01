import { createAdminServerCaller } from "@/lib/admin-server-api";

import UserDetailView from "./user-detail";

export const dynamic = "force-dynamic";

/**
 * `/users/[id]` — server prefetch for user detail + RBAC catalogs.
 */
export default async function UserDetailPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const { id: userId } = await params;
	const server = createAdminServerCaller();

	const [userResult, rolesResult, permissionsResult] = await Promise.allSettled([
		server.auth.adminUserDetail.query({ userId }),
		server.admin.roles.list.query({}),
		server.admin.permissions.list.query({}),
	]);

	const initialUser = userResult.status === "fulfilled" ? userResult.value.data : undefined;
	const initialRoles = rolesResult.status === "fulfilled" ? rolesResult.value.data.items : undefined;
	const initialPermissions = permissionsResult.status === "fulfilled" ? permissionsResult.value.data.items : undefined;

	return <UserDetailView userId={userId} initialUser={initialUser} initialRoles={initialRoles} initialPermissions={initialPermissions} />;
}
