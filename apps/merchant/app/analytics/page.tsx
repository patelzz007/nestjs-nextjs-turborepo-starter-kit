import { readOrganizationSlugCookie } from "@/lib/merchant-server-api";
import { organizationPath } from "@/lib/org/slug";
import { redirect } from "next/navigation";

/** Legacy `/analytics` entry — forwards to the active organization analytics route. */
export default async function MerchantAnalyticsRedirectPage(): Promise<never> {
	const organizationSlug = await readOrganizationSlugCookie();

	if (organizationSlug !== undefined && organizationSlug.length > 0) {
		redirect(organizationPath(organizationSlug, "analytics"));
	}

	redirect("/");
}
