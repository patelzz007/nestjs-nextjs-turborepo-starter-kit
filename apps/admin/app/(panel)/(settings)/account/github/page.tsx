import { SettingsSectionHeader } from "@workspace/ui/components/settings-shell";
import { GithubTokenPanel } from "@/contexts/integrations-github";
import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

export const dynamic = "force-dynamic";

/**
 * `/account/github` — the signed-in admin's own GitHub token: `GET /github/account` prefetched on
 * the server, linked with `PUT` and removed with `DELETE /github/account`.
 */
export default async function AccountGithubPage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/account/github", resource: "GitHub token" }, () => server.githubPullRequests.account.query(undefined));

	return (
		<div className="space-y-6">
			<SettingsSectionHeader
				title="GitHub token"
				description="Link the token the pull-request screens use. It is checked with GitHub, stored encrypted, and never shown again."
			/>
			<GithubTokenPanel initialAccount={resolvePrefetchedData(result)} />
		</div>
	);
}
