import { createServerCaller } from "@workspace/client/lib/api/server-api";

import EmailLogView from "./email-log-table";

export const dynamic = "force-dynamic";

/** `/email-log` — fetches the sent-email log server-side; live SSE updates stay client-side. */
export default async function EmailLogPage(): Promise<React.JSX.Element> {
	const server = createServerCaller();
	const data = await server.email.logList.query({ limit: 100 });

	return <EmailLogView initialEnvelope={data} />;
}
