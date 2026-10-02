import { MfaRecoveryQueue } from "@/components/security/mfa-recovery-queue";
import { createAdminServerCaller } from "@/lib/admin-server-api";
import { toPrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { MFA_RECOVERY_URL_STATE, toMfaRecoveryListQuery } from "@/lib/url-state/mfa-recovery";

export const dynamic = "force-dynamic";

/**
 * `/users/mfa-recovery` — super-admin queue of user requests to reset
 * two-factor authentication. The queue's state (status filter, page, the
 * request under review) lives in the URL; the server parses it and prefetches
 * that page of the queue.
 */
export default async function MfaRecoveryAdminPage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const urlState = MFA_RECOVERY_URL_STATE.parse(await searchParams);
	const server = createAdminServerCaller();
	const [result] = await Promise.allSettled([server.auth.adminMfaRecoveryRequests.query(toMfaRecoveryListQuery(urlState))]);
	const stateKey: string = MFA_RECOVERY_URL_STATE.serialize({ ...urlState, requestId: undefined });

	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">MFA recovery</h1>
				<p className="text-sm text-muted-foreground">Approve or deny user requests to reset two-factor authentication after they lose their authenticator and backup codes.</p>
			</header>
			<MfaRecoveryQueue initialPage={toPrefetchedQuery(stateKey, result)} />
		</div>
	);
}
