import { createAdminServerCaller } from "@/lib/admin-server-api";
import { readPaginatedTotal } from "@/lib/api-envelope";

import UsersAllTable from "../../users/all/users-all-table";

export const dynamic = "force-dynamic";

/** `/rewardhub/users` — platform user directory for Reward Hub admins. */
export default async function RewardHubUsersPage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const result = await Promise.allSettled([server.auth.adminUsers.query({ page: 1, limit: 20 })]);

	const first = result[0];
	const initialUsers = first.status === "fulfilled" ? first.value.data : undefined;
	const initialTotal = first.status === "fulfilled" ? readPaginatedTotal(first.value.meta, first.value.data.length) : undefined;

	return (
		<UsersAllTable
			initialUsers={initialUsers}
			initialTotal={initialTotal}
			heading="Platform users"
			description="Consumers, merchants, and admins registered on the platform."
		/>
	);
}
