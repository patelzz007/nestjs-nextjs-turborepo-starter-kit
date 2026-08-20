import { createServerCaller } from "@workspace/client/lib/api/server-api";

import TelescopeMailView from "./mail-table";

export const dynamic = "force-dynamic";

/** `/telescope/mail` — fetches the captured mail list server-side. */
export default async function TelescopeMailPage(): Promise<React.JSX.Element> {
	const server = createServerCaller();
	const data = await server.telescope.mail.query(undefined);

	return <TelescopeMailView initialData={data.data} />;
}
