import { createAdminServerCaller } from "@/lib/admin-server-api";
import { readPaginatedTotal } from "@/lib/api-envelope";

import MerchantsAllTable from "./merchants-all-table";

export const dynamic = "force-dynamic";

/** `/rewardhub/merchants` — merchant organization directory. */
export default async function RewardHubMerchantsPage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const result = await Promise.allSettled([server.rewardsAdmin.listMerchants.query({ page: 1, limit: 20 })]);

	const first = result[0];
	const initialMerchants = first.status === "fulfilled" ? first.value.data : undefined;
	const initialTotal = first.status === "fulfilled" ? readPaginatedTotal(first.value.meta, first.value.data.length) : undefined;

	return <MerchantsAllTable initialMerchants={initialMerchants} initialTotal={initialTotal} />;
}
