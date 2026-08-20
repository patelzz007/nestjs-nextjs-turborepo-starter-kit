import { TelescopeSqlListQuerySchema, type TelescopeSqlListQuery } from "@workspace/shared";

import { createServerCaller } from "@workspace/client/lib/api/server-api";

import TelescopeSqlView from "./sql-table";

export const dynamic = "force-dynamic";

/** `/telescope/sql` — fetches the default first page server-side. */
export default async function TelescopeSqlPage(): Promise<React.JSX.Element> {
	const query: TelescopeSqlListQuery = TelescopeSqlListQuerySchema.parse({ page: 1, pageSize: 20, sort: "duration", minDurationMs: "100" });
	const server = createServerCaller();
	const data = await server.telescope.sql.query(query);

	return <TelescopeSqlView initialEnvelope={data} />;
}
