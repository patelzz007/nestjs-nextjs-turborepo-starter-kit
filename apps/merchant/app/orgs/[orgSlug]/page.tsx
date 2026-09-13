import { redirect } from "next/navigation";

interface OrgDashboardPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

export default async function OrgDashboardPage({ params }: OrgDashboardPageProps): Promise<never> {
	const { orgSlug } = await params;
	redirect(`/orgs/${orgSlug}/dashboard`);
}
