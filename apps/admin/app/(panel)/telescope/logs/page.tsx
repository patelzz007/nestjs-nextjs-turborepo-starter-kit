import { createServerCaller } from "@workspace/client/lib/api/server-api";

import TelescopeLogsView from "./logs-table";

export const dynamic = "force-dynamic";

/** `/telescope/logs` — fetches the default first page server-side. */
export default async function TelescopeLogsPage(): Promise<React.JSX.Element> {
	const server = createServerCaller();
	const data = await server.telescope.logs.query({ page: 1, pageSize: 20 });

	return <TelescopeLogsView initialEnvelope={data} />;
}
