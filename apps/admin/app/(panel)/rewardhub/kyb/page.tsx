import KybReviewPanel from "./kyb-review-panel";

export const dynamic = "force-dynamic";

/** `/rewardhub/kyb` — update merchant KYB verification status. */
export default async function RewardHubKybPage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const params = await searchParams;
	const merchantOrgIdParam = params.merchantOrgId;
	const initialMerchantOrgId = typeof merchantOrgIdParam === "string" ? merchantOrgIdParam : undefined;

	return <KybReviewPanel initialMerchantOrgId={initialMerchantOrgId} />;
}
