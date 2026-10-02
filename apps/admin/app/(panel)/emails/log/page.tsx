import { createAdminServerCaller } from "@/lib/admin-server-api";
import { toPrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { EMAIL_LOG_URL_STATE, toEmailLogListQuery } from "@/lib/url-state/email-log";

import EmailLogView from "./email-log-table";

export const dynamic = "force-dynamic";

/**
 * `/emails/log` — parses the table's URL state and fetches that page of the
 * sent-email log server-side; live SSE updates stay client-side.
 */
export default async function EmailLogPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
	const urlState = EMAIL_LOG_URL_STATE.parse(await searchParams);
	const server = createAdminServerCaller();
	const [result] = await Promise.allSettled([server.email.logList.query(toEmailLogListQuery(urlState))]);

	return <EmailLogView initialPage={toPrefetchedQuery(EMAIL_LOG_URL_STATE.serialize(urlState), result)} />;
}
