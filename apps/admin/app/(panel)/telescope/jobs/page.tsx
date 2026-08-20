import { createServerCaller } from "@workspace/client/lib/api/server-api";

import TelescopeJobsView from "./jobs-table";

export const dynamic = "force-dynamic";

/** `/telescope/jobs` — fetches the default first page server-side. */
export default async function TelescopeJobsPage(): Promise<React.JSX.Element> {
	const server = createServerCaller();
	const data = await server.telescope.jobs.query({ page: 1, pageSize: 20 });

	return <TelescopeJobsView initialEnvelope={data} />;
}
