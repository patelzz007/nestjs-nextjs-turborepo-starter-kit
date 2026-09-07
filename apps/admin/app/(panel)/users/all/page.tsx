import { createAdminServerCaller } from "@/lib/admin-server-api";
import { readPaginatedHasNext, readPaginatedTotal, readPaginatedTotalPages } from "@/lib/api-envelope";

import UsersAllTable from "./users-all-table";

export const dynamic = "force-dynamic";

/** `/users/all` — admin user list with links to per-user RBAC management. */
export default async function UsersAllPage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const result = await Promise.allSettled([server.auth.adminUsers.query({ page: 1, limit: 20 })]);

	const first = result[0];
	const initialUsers = first.status === "fulfilled" ? first.value.data : undefined;
	const initialTotal = first.status === "fulfilled" ? readPaginatedTotal(first.value.meta) : undefined;
	const initialTotalPages = first.status === "fulfilled" ? readPaginatedTotalPages(first.value.meta) : undefined;
	const initialHasNext = first.status === "fulfilled" ? readPaginatedHasNext(first.value.meta) : undefined;

	return <UsersAllTable initialUsers={initialUsers} initialTotal={initialTotal} initialTotalPages={initialTotalPages} initialHasNext={initialHasNext} />;
}
