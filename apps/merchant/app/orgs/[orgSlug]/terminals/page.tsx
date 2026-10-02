import { TerminalsPageView } from "@/components/terminals/terminals-page-view";
import { loadMerchantServerContext, readOrganizationLocationCookie } from "@/lib/merchant-server-api";
import { guardOrgPage } from "@/lib/org/org-page-guard";
import { MERCHANT_TERMINALS_PAGE_SIZE, type MerchantTerminalSettings, type MerchantTerminalSummary } from "@workspace/shared";
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
	const locationId = await readOrganizationLocationCookie();

	// Both reads are independent — fetch them together; either may fail without blocking the page (the client refetches).
	const [terminalsResult, settingsResult] = await Promise.allSettled([
		server.organizations.terminals.list.query({ orgSlug, page: 1, limit: MERCHANT_TERMINALS_PAGE_SIZE, locationId }),
		server.organizations.terminals.settings.query({ orgSlug }),
	]);
	const initialTerminals: readonly MerchantTerminalSummary[] | undefined = terminalsResult.status === "fulfilled" ? terminalsResult.value.data : undefined;
	const initialSettings: MerchantTerminalSettings | undefined = settingsResult.status === "fulfilled" ? settingsResult.value.data : undefined;

	return <TerminalsPageView orgSlug={orgSlug} initialTerminals={initialTerminals} initialSettings={initialSettings} />;
}
