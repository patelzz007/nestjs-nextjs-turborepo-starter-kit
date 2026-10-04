import { UuidParamSchema } from "@workspace/shared";
import { notFound } from "next/navigation";

import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

import UserDetailView from "./user-detail";

export const dynamic = "force-dynamic";

/**
 * `/users/[id]` — server prefetch for user detail + RBAC catalogs. The API's
 * envelopes are passed as they are; a failed prefetch is logged and the
 * client query takes over (a missing user renders the 404 page).
 */
export default async function UserDetailPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	// Validated with the API's own param schema: a malformed id is a 404, never an API call.
	const parsedId = UuidParamSchema.safeParse((await params).id);
	if (!parsedId.success) {
		notFound();
	}
	const userId: string = parsedId.data;
	const server = createAdminServerCaller();

	const [userResult, rolesResult, permissionsResult] = await Promise.all([
		prefetch({ page: "/users/[id]", resource: "user detail" }, () => server.auth.adminUserDetail.query({ userId })),
		prefetch({ page: "/users/[id]", resource: "roles" }, () => server.admin.roles.list.query({})),
		prefetch({ page: "/users/[id]", resource: "permissions" }, () => server.admin.permissions.list.query({})),
	]);

	return (
		<UserDetailView
			userId={userId}
			initialUser={resolvePrefetchedData(userResult)}
			initialRoles={resolvePrefetchedData(rolesResult)}
			initialPermissions={resolvePrefetchedData(permissionsResult)}
		/>
	);
}
