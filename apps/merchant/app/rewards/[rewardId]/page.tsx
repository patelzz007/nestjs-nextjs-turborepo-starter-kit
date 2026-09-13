import { readOrganizationSlugCookie } from "@/lib/merchant-server-api";
import { organizationPath } from "@/lib/org/slug";
import { redirect } from "next/navigation";

interface MerchantRewardRedirectPageProps {
	readonly params: Promise<{ rewardId: string }>;
}

/** Legacy `/rewards/:rewardId` entry — forwards to the active organization reward detail route. */
export default async function MerchantRewardRedirectPage({ params }: MerchantRewardRedirectPageProps): Promise<never> {
	const { rewardId } = await params;
	const organizationSlug = await readOrganizationSlugCookie();

	if (organizationSlug !== undefined && organizationSlug.length > 0) {
		redirect(organizationPath(organizationSlug, `rewards/${rewardId}`));
	}

	redirect("/");
}
