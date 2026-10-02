import { createAdminServerCaller } from "@/lib/admin-server-api";
import { toPrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { MERCHANTS_TABLE_URL_STATE, toMerchantsListQuery } from "@/lib/url-state/merchants";

import MerchantsAllTable from "./merchants-all-table";

export const dynamic = "force-dynamic";

/**
 * `/merchants` — the Merchants section index: every merchant organization.
 * The server parses the table's URL state and prefetches that exact page.
 */
export default async function MerchantsPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
	const urlState = MERCHANTS_TABLE_URL_STATE.parse(await searchParams);
	const server = createAdminServerCaller();
	const [result] = await Promise.allSettled([server.rewardsAdmin.listOrganizations.query(toMerchantsListQuery(urlState))]);

	return <MerchantsAllTable initialPage={toPrefetchedQuery(MERCHANTS_TABLE_URL_STATE.serialize(urlState), result)} />;
}
