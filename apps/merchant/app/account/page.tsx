import { resolveMerchantEntryTenantSlug } from "@/lib/merchant-server-api";
import { tenantRoutes, ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { appRoute } from "@workspace/client/lib/navigation/app-route";

export const dynamic = "force-dynamic";

/** Personal-account entry — resolves the tenant server-side, then opens `/t/{slug}/account`. */
export default async function MerchantAccountEntryPage(): Promise<React.ReactNode> {
	const slug = await resolveMerchantEntryTenantSlug();

	if (slug !== undefined) {
		redirect(appRoute(tenantRoutes(slug).account));
	}

	redirect(appRoute(ROUTES.onboarding));
}
