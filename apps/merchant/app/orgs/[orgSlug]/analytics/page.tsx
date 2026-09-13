import { MerchantAnalyticsPageView } from "@/components/analytics/merchant-analytics-page-view";
import { loadMerchantServerContext, readOrganizationLocationCookie } from "@/lib/merchant-server-api";
import type { MerchantAnalyticsResponse } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantAnalyticsPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

export default async function MerchantAnalyticsPage({ params }: MerchantAnalyticsPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const { server } = await loadMerchantServerContext();
	const locationId = await readOrganizationLocationCookie();

	let initialAnalytics: MerchantAnalyticsResponse | undefined;
	try {
		const response = await server.organizations.analytics.query({ orgSlug, locationId });
		initialAnalytics = response.data;
	} catch {
		initialAnalytics = undefined;
	}

	return <MerchantAnalyticsPageView orgSlug={orgSlug} initialAnalytics={initialAnalytics} />;
}
