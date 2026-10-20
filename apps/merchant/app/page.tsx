import { resolveMerchantEntryTenantSlug } from "@/lib/merchant-server-api";
import { tenantRoutes, ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Post-login entry — route users into their first tenant workspace. */
export default async function MerchantHomePage(): Promise<React.ReactNode> {
	const slug = await resolveMerchantEntryTenantSlug();

	if (slug !== undefined) {
		redirect(tenantRoutes(slug).dashboard);
	}

	redirect(ROUTES.onboarding);
}
