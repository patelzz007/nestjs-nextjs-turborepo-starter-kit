import { TerminalsPageView } from "@/components/terminals/terminals-page-view";
import { toLocationQueryInput } from "@/features/tenant-context/selectors";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import type { LocationScopedPrefetch } from "@/lib/org/location-prefetch";
import { guardOrgPage } from "@/lib/org/org-page-guard";
import { loadServerLocationScope } from "@/lib/org/server-location-scope";
import { prefetchedDataOrUndefined } from "@/lib/server/server-query-outcome";
import { MERCHANT_TERMINALS_PAGE_SIZE, type Envelope, type MerchantTerminalSummary } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantTerminalsPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

export default async function MerchantTerminalsPage({ params }: MerchantTerminalsPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/terminals");
	if (denied !== null) {
		return denied;
	}
	// `guardOrgPage` already denied any role without `merchant:manage_api_keys`.
	const { server } = await loadMerchantServerContext();
	// The same store filter the client's first render derives, so the list lands under its query key.
	const locationId = toLocationQueryInput((await loadServerLocationScope(orgSlug)).effectiveLocationId);

	// Both reads are independent — fetch them together. An access answer leaves the data to the client
	// query; an outage is logged and rethrown to `error.tsx`. The API's envelopes are passed as they are.
	const [terminalsResult, settingsResult] = await Promise.allSettled([
		server.organizations.terminals.list.query({ orgSlug, page: 1, limit: MERCHANT_TERMINALS_PAGE_SIZE, locationId }),
		server.organizations.terminals.settings.query({ orgSlug }),
	]);
	const terminals = prefetchedDataOrUndefined(terminalsResult, "organizations.terminals.list");
	const initialTerminals: LocationScopedPrefetch<Envelope<MerchantTerminalSummary[]>> | undefined = terminals === undefined ? undefined : { locationId, data: terminals };
	const initialSettings = prefetchedDataOrUndefined(settingsResult, "organizations.terminals.settings");

	return <TerminalsPageView orgSlug={orgSlug} initialTerminals={initialTerminals} initialSettings={initialSettings} />;
}
