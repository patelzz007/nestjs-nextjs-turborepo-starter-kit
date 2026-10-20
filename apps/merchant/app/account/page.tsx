import { resolveMerchantEntryTenantSlug } from "@/lib/merchant-server-api";
import { tenantRoutes, ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Personal-account entry — resolves the tenant server-side, then opens `/t/{slug}/account`. */
export default async function MerchantAccountEntryPage(): Promise<React.ReactNode> {
	const slug = await resolveMerchantEntryTenantSlug();

	if (slug !== undefined) {
		redirect(tenantRoutes(slug).account);
	}

	redirect(ROUTES.onboarding);
}
