import { SupportAccessConsole } from "@/contexts/authorization";
import { SUPPORT_ACCESS_URL_STATE, toSupportAccessListQuery } from "@/contexts/authorization/url-state/support-access";
import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedQuery } from "@/lib/server/prefetch";

export const dynamic = "force-dynamic";

/**
 * `/users/support-access` — super-admin just-in-time access to merchants: request a grant (the
 * merchant's owner approves it), and every grant with its state. The list's filter and page live
 * in the URL; the server parses them and prefetches that page.
 */
export default async function SupportAccessPage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const urlState = SUPPORT_ACCESS_URL_STATE.parse(await searchParams);
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/users/support-access", resource: "support access grants" }, () =>
		server.supportAccess.list.query(toSupportAccessListQuery(urlState)),
	);

	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">Support access</h1>
				<p className="text-sm text-muted-foreground">Time-boxed access to a merchant&apos;s data for a support case, approved by the merchant&apos;s owner.</p>
			</header>
			<SupportAccessConsole initialPage={resolvePrefetchedQuery(SUPPORT_ACCESS_URL_STATE.serialize(urlState), result)} />
		</div>
	);
}
