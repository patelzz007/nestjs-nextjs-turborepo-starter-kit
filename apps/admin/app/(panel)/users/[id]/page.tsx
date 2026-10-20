import { UuidParamSchema } from "@workspace/shared";
import { notFound } from "next/navigation";

import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedData, resolvePrefetchedQuery } from "@/lib/server/prefetch";
import { GRANTS_URL_STATE, toPermissionsQuery } from "@/contexts/authorization/url-state/access";

import UserDetailView from "../../../../contexts/identity/components/user-detail";

export const dynamic = "force-dynamic";

/**
 * `/users/[id]` — server prefetch for user detail + the grant tree's page of the permission catalog. The API's
 * envelopes are passed as they are; a failed prefetch is logged and the
 * client query takes over (a missing user renders the 404 page).
 */
export default async function UserDetailPage({
	params,
	searchParams,
}: {
	readonly params: Promise<{ readonly id: string }>;
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	// Validated with the API's own param schema: a malformed id is a 404, never an API call.
	const parsedId = UuidParamSchema.safeParse((await params).id);
	if (!parsedId.success) {
		notFound();
	}
	const userId: string = parsedId.data;
	const grantsState = GRANTS_URL_STATE.parse(await searchParams);
	const server = createAdminServerCaller();

	const [userResult, grantsResult] = await Promise.all([
		prefetch({ page: "/users/[id]", resource: "user detail" }, () => server.auth.adminUserDetail.query({ userId })),
		prefetch({ page: "/users/[id]", resource: "permissions" }, () => server.admin.permissions.list.query(toPermissionsQuery(grantsState))),
	]);

	return (
		<UserDetailView
			userId={userId}
			initialUser={resolvePrefetchedData(userResult)}
			initialGrantsPage={resolvePrefetchedQuery(GRANTS_URL_STATE.serialize(grantsState), grantsResult)}
		/>
	);
}
