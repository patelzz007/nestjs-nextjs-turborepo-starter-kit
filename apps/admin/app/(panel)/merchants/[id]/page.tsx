import { UuidParamSchema } from "@workspace/shared";
import { notFound } from "next/navigation";

import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

import MerchantDetailView from "../../../../contexts/tenancy/components/merchant-detail";

export const dynamic = "force-dynamic";

/**
 * `/merchants/[id]` — one merchant: its summary and lifecycle (suspend, reinstate, appeals). Both
 * envelopes are prefetched on the server; a failed prefetch is logged and the client query takes over.
 */
export default async function MerchantDetailPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	// Validated with the API's own param schema: a malformed id is a 404, never an API call.
	const parsedId = UuidParamSchema.safeParse((await params).id);
	if (!parsedId.success) {
		notFound();
	}
	const tenantId: string = parsedId.data;
	const server = createAdminServerCaller();
	const [merchantResult, lifecycleResult] = await Promise.all([
		prefetch({ page: "/merchants/[id]", resource: "merchant detail" }, () => server.rewardsAdmin.getTenant.query({ tenantId })),
		prefetch({ page: "/merchants/[id]", resource: "merchant lifecycle" }, () => server.rewardsAdmin.getTenantLifecycle.query({ tenantId })),
	]);

	return <MerchantDetailView tenantId={tenantId} initialMerchant={resolvePrefetchedData(merchantResult)} initialLifecycle={resolvePrefetchedData(lifecycleResult)} />;
}
