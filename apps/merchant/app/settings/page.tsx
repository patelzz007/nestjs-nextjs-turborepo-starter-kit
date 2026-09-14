import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import { organizationPath } from "@/lib/org/slug";
import { redirect } from "next/navigation";

/** Legacy `/settings` entry — forwards to the active organization settings route. */
export default async function MerchantSettingsRedirectPage(): Promise<never> {
	const ctx = await loadMerchantServerContext();
	const organizationSlug = ctx.organizationSlug ?? ctx.memberships[0]?.organizationSlug;

	if (organizationSlug !== undefined && organizationSlug.length > 0) {
		redirect(organizationPath(organizationSlug, "settings"));
	}

	redirect("/");
}
