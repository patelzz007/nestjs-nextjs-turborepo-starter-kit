import { resolveMerchantEntryTenantSlug } from "@/lib/merchant-server-api";
import { tenantRoutes, ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";
import { appRoute } from "@workspace/client/lib/navigation/app-route";

export const dynamic = "force-dynamic";

/** Post-login entry — route users into their first tenant workspace. */
export default async function MerchantHomePage(): Promise<React.ReactNode> {
	const slug = await resolveMerchantEntryTenantSlug();

	if (slug !== undefined) {
		redirect(appRoute(tenantRoutes(slug).dashboard));
	}

	redirect(appRoute(ROUTES.onboarding));
}
