import { createServerCaller } from "@workspace/client/lib/api/server-api";

import TelescopeExceptionsView from "./exceptions-table";

export const dynamic = "force-dynamic";

/** `/telescope/exceptions` — fetches the default first page server-side. */
export default async function TelescopeExceptionsPage(): Promise<React.JSX.Element> {
	const server = createServerCaller();
	const data = await server.telescope.exceptions.query({ page: 1, pageSize: 20 });

	return <TelescopeExceptionsView initialEnvelope={data} />;
}
