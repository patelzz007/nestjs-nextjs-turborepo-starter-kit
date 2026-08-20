import { createServerCaller } from "@workspace/client/lib/api/server-api";

import TelescopeSchedulesView from "./schedules-list";

export const dynamic = "force-dynamic";

/** `/telescope/schedules` — fetches the registered schedule list server-side. */
export default async function TelescopeSchedulesPage(): Promise<React.JSX.Element> {
	const server = createServerCaller();
	const data = await server.telescope.schedules.query(undefined);

	return <TelescopeSchedulesView initialEnvelope={data} />;
}
