import { resolveMerchantEntryOrganizationSlug } from "@/lib/merchant-server-api";
import { orgRoutes, ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Personal-account entry — resolves the organization server-side, then opens `/orgs/{slug}/account`. */
export default async function MerchantAccountEntryPage(): Promise<React.ReactNode> {
	const slug = await resolveMerchantEntryOrganizationSlug();

	if (slug !== undefined) {
		redirect(orgRoutes(slug).account);
	}

	redirect(ROUTES.onboarding);
}
