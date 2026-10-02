import { createAdminServerCaller } from "@/lib/admin-server-api";
import { toPrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { toUsersListQuery, USERS_TABLE_URL_STATE } from "@/lib/url-state/users";

import UsersAllTable from "./users-all-table";

export const dynamic = "force-dynamic";

/**
 * `/users` — the Users section index: admin user list with links to per-user
 * RBAC management. The table's state lives in the URL; the server parses it
 * and prefetches exactly the page the URL asks for, so a shared or reloaded
 * link renders that page (search, filter, sort, page) in the initial HTML.
 */
export default async function UsersPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
	const urlState = USERS_TABLE_URL_STATE.parse(await searchParams);
	const server = createAdminServerCaller();
	const [result] = await Promise.allSettled([server.auth.adminUsers.query(toUsersListQuery(urlState))]);

	return <UsersAllTable initialPage={toPrefetchedQuery(USERS_TABLE_URL_STATE.serialize(urlState), result)} />;
}
