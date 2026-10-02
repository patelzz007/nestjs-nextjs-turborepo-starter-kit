import { createAdminServerCaller } from "@/lib/admin-server-api";

import EmailLogView, { EMAIL_LOG_PAGE_SIZE } from "./email-log-table";

export const dynamic = "force-dynamic";

/** `/emails/log` — fetches the sent-email log server-side; live SSE updates stay client-side. */
export default async function EmailLogPage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const data = await server.email.logList.query({ page: 1, limit: EMAIL_LOG_PAGE_SIZE });

	return <EmailLogView initialEnvelope={data} />;
}
