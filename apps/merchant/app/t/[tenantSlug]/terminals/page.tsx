import { TerminalsPageView } from "@/contexts/pos/components/terminals/terminals-page-view";
import { toLocationQueryInput } from "@/features/tenant-context/selectors";
import { loadTenantServerCaller } from "@/contexts/tenancy/lib/tenant/tenant-server-caller";
import type { LocationScopedPrefetch } from "@/contexts/tenancy/lib/tenant/location-prefetch";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import { loadServerLocationScope } from "@/contexts/tenancy/lib/tenant/server-location-scope";
import { prefetchedDataOrUndefined } from "@/lib/server/server-query-outcome";
import { MERCHANT_TERMINALS_PAGE_SIZE, type Envelope, type MerchantTerminalSummary } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantTerminalsPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

export default async function MerchantTerminalsPage({ params }: MerchantTerminalsPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/terminals");
	if (denied !== null) {
		return denied;
	}
	// `guardTenantPage` already denied any role without `merchant:manage_api_keys`.
	const server = await loadTenantServerCaller(tenantSlug);
	// The same store filter the client's first render derives, so the list lands under its query key.
	const locationId = toLocationQueryInput((await loadServerLocationScope(tenantSlug)).effectiveLocationId);

	// Both reads are independent — fetch them together. An access answer leaves the data to the client
	// query; an outage is logged and rethrown to `error.tsx`. The API's envelopes are passed as they are.
	const [terminalsResult, settingsResult] = await Promise.allSettled([
		server.tenants.terminals.list.query({ tenantSlug, page: 1, limit: MERCHANT_TERMINALS_PAGE_SIZE, locationId }),
		server.tenants.terminals.settings.query({ tenantSlug }),
	]);
	const terminals = prefetchedDataOrUndefined(terminalsResult, "tenants.terminals.list");
	const initialTerminals: LocationScopedPrefetch<Envelope<MerchantTerminalSummary[]>> | undefined = terminals === undefined ? undefined : { locationId, data: terminals };
	const initialSettings = prefetchedDataOrUndefined(settingsResult, "tenants.terminals.settings");

	return <TerminalsPageView tenantSlug={tenantSlug} initialTerminals={initialTerminals} initialSettings={initialSettings} />;
}
