import { readOrganizationSlugCookie } from "@/lib/merchant-server-api";
import { organizationPath } from "@/lib/org/slug";
import { redirect } from "next/navigation";

/** Legacy `/rewards` entry — forwards to the active organization rewards route. */
export default async function MerchantRewardsRedirectPage(): Promise<never> {
	const organizationSlug = await readOrganizationSlugCookie();

	if (organizationSlug !== undefined && organizationSlug.length > 0) {
		redirect(organizationPath(organizationSlug, "rewards"));
	}

	redirect("/");
}
