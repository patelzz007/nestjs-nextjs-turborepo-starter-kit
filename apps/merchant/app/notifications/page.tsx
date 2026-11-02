import { resolveMerchantEntryTenantSlug } from "@/lib/merchant-server-api";
import { tenantRoutes, ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Inbox entry (the API's notification links) — resolves the tenant server-side, then opens `/t/{slug}/notifications`. */
export default async function MerchantNotificationsEntryPage(): Promise<React.ReactNode> {
	const slug = await resolveMerchantEntryTenantSlug();

	if (slug !== undefined) {
		redirect(tenantRoutes(slug).notifications);
	}

	redirect(ROUTES.onboarding);
}
