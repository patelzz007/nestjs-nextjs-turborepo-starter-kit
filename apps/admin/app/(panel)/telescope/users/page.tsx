import { createServerCaller } from "@workspace/client/lib/api/server-api";

import TelescopeUsersView from "./users-table";

export const dynamic = "force-dynamic";

/** `/telescope/users` — fetches the default first page server-side. */
export default async function TelescopeUsersPage(): Promise<React.JSX.Element> {
	const server = createServerCaller();
	const data = await server.telescope.users.query({ page: 1, pageSize: 20, range: "24h", sort: "count" });

	return <TelescopeUsersView initialEnvelope={data} />;
}
