import { settleServerQuery } from "@workspace/client/lib/api/server-query-outcome";
import { notFound, redirect } from "next/navigation";
import * as React from "react";

import { guardWebPage } from "@/contexts/identity/lib/page-guard";
import { TierPageView } from "@/contexts/tiers/components/tier-page-view";
import { loginPath, ROUTES } from "@/lib/routes";
import { createWebServerCaller } from "@/lib/web-server-api";

export const dynamic = "force-dynamic";

/** `/dashboard/tier` — the customer's own tier (ADR 085). While tiers are off the API answers 404, and so does the page. */
export default async function DashboardTierPage(): Promise<React.JSX.Element> {
	await guardWebPage(ROUTES.dashboard.tier);

	const [result] = await Promise.allSettled([createWebServerCaller().tiers.me.query(undefined)]);
	const page = settleServerQuery(result, { label: "tiers.me", expected: ["unauthenticated", "not-found"] });

	if (page.kind === "unauthenticated") {
		redirect(loginPath(ROUTES.dashboard.tier));
	}
	if (page.kind === "not-found") {
		notFound();
	}
	return <TierPageView page={page.data.data} />;
}
