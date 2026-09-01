import { createAdminServerCaller } from "@/lib/admin-server-api";

import EmailLogView from "./email-log-table";

export const dynamic = "force-dynamic";

/** `/email-log` — fetches the sent-email log server-side; live SSE updates stay client-side. */
export default async function EmailLogPage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const data = await server.email.logList.query({ limit: 100 });

	return <EmailLogView initialEnvelope={data} />;
}
