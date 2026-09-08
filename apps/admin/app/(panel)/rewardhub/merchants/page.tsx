import { createAdminServerCaller } from "@/lib/admin-server-api";
import { readPaginatedHasNext, readPaginatedTotal, readPaginatedTotalPages } from "@/lib/api-envelope";

import MerchantsAllTable from "./merchants-all-table";

export const dynamic = "force-dynamic";

export default async function RewardHubMerchantsPage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const result = await Promise.allSettled([server.rewardsAdmin.listMerchants.query({ page: 1, limit: 20 })]);

	const first = result[0];
	const initialMerchants = first.status === "fulfilled" ? first.value.data : undefined;
	const initialTotal = first.status === "fulfilled" ? readPaginatedTotal(first.value.meta) : undefined;
	const initialTotalPages = first.status === "fulfilled" ? readPaginatedTotalPages(first.value.meta) : undefined;
	const initialHasNext = first.status === "fulfilled" ? readPaginatedHasNext(first.value.meta) : undefined;

	return <MerchantsAllTable initialMerchants={initialMerchants} initialTotal={initialTotal} initialTotalPages={initialTotalPages} initialHasNext={initialHasNext} />;
}
