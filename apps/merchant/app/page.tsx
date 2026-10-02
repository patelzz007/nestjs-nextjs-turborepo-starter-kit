import { resolveMerchantEntryOrganizationSlug } from "@/lib/merchant-server-api";
import { orgRoutes, ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Post-login entry — route users into their first organization workspace. */
export default async function MerchantHomePage(): Promise<React.ReactNode> {
	const slug = await resolveMerchantEntryOrganizationSlug();

	if (slug !== undefined) {
		redirect(orgRoutes(slug).dashboard);
	}

	redirect(ROUTES.onboarding);
}
