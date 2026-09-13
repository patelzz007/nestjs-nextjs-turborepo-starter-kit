import { readOrganizationSlugCookie } from "@/lib/merchant-server-api";
import { organizationPath } from "@/lib/org/slug";
import { redirect } from "next/navigation";

/** Legacy `/settings/team` entry — forwards to the active organization team route. */
export default async function MerchantTeamRedirectPage(): Promise<never> {
	const organizationSlug = await readOrganizationSlugCookie();

	if (organizationSlug !== undefined && organizationSlug.length > 0) {
		redirect(organizationPath(organizationSlug, "settings/team"));
	}

	redirect("/");
}
