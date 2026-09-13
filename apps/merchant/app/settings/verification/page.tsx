import { readOrganizationSlugCookie } from "@/lib/merchant-server-api";
import { organizationPath } from "@/lib/org/slug";
import { redirect } from "next/navigation";

/** Legacy `/settings/verification` entry — forwards to the active organization KYB route. */
export default async function MerchantVerificationRedirectPage(): Promise<never> {
	const organizationSlug = await readOrganizationSlugCookie();

	if (organizationSlug !== undefined && organizationSlug.length > 0) {
		redirect(organizationPath(organizationSlug, "settings/verification"));
	}

	redirect("/");
}
