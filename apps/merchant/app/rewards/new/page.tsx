import { readOrganizationSlugCookie } from "@/lib/merchant-server-api";
import { organizationPath } from "@/lib/org/slug";
import { redirect } from "next/navigation";

/** Legacy `/rewards/new` entry — forwards to the active organization create-reward route. */
export default async function MerchantCreateRewardRedirectPage(): Promise<never> {
	const organizationSlug = await readOrganizationSlugCookie();

	if (organizationSlug !== undefined && organizationSlug.length > 0) {
		redirect(organizationPath(organizationSlug, "rewards/new"));
	}

	redirect("/");
}
