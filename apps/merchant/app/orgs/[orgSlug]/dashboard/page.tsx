import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import { organizationPath } from "@/lib/organization-slug";
import { MerchantShell } from "@/components/merchant-shell";
import Link from "next/link";

interface OrgDashboardPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

export default async function OrgDashboardPage({ params }: OrgDashboardPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const ctx = await loadMerchantServerContext();

	return (
		<MerchantShell initialMemberships={ctx.memberships} initialMerchantOrgId={ctx.merchantOrgId}>
			<div className="space-y-4 p-6">
				<h1 className="text-2xl font-semibold">Organization dashboard</h1>
				<p className="text-sm text-muted-foreground">
					Tenant context: <span className="font-mono">{orgSlug}</span>
				</p>
				<nav className="flex flex-wrap gap-3 text-sm">
					<Link href={organizationPath(orgSlug, "rewards")} className="underline">
						Rewards
					</Link>
					<Link href={organizationPath(orgSlug, "settings/team")} className="underline">
						Team
					</Link>
					<Link href={organizationPath(orgSlug, "settings/verification")} className="underline">
						Verification
					</Link>
				</nav>
			</div>
		</MerchantShell>
	);
}
