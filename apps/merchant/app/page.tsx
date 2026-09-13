import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import { organizationPath } from "@/lib/org/slug";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Post-login entry — route users into their first organization workspace. */
export default async function MerchantHomePage(): Promise<never> {
	const ctx = await loadMerchantServerContext();
	const slug = ctx.organizationSlug ?? ctx.memberships[0]?.organizationSlug;

	if (slug !== undefined) {
		redirect(organizationPath(slug, "dashboard"));
	}

	redirect("/onboarding");
}
