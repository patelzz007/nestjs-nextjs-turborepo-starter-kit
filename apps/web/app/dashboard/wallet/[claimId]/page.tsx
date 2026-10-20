import { FeatureUnavailableNotice } from "@/contexts/identity/components/access-fallback";
import { AccessGate } from "@/contexts/identity/components/access-gate";
import { ClaimQrView } from "@/contexts/claims/components/qr-view";
import { settleServerQuery } from "@workspace/client/lib/api/server-query-outcome";
import { guardWebPage } from "@/contexts/identity/lib/page-guard";
import { loginPath, walletClaimPath } from "@/lib/routes";
import { createWebServerCaller } from "@/lib/web-server-api";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { notFound, redirect } from "next/navigation";
import * as React from "react";

export const dynamic = "force-dynamic";

const QR_FEATURE = "this redemption code";

/**
 * `/dashboard/wallet/[claimId]` — a claimed reward's redemption QR code.
 *
 * The server render reads the claim (`claims.get`) and renders its card with a
 * sized QR skeleton. It never issues codes: `claims.qr` is a command that
 * rotates the stored code hashes, so a link prefetch or a re-render would
 * invalidate the code a customer is already showing. `ClaimQrView` issues the
 * codes in the browser, once, after mount.
 */
export default async function WalletClaimPage({ params }: { readonly params: Promise<{ claimId: string }> }): Promise<React.JSX.Element> {
	const { claimId } = await params;
	const returnPath = walletClaimPath(claimId);
	await guardWebPage(returnPath);

	// A malformed id names no claim — the same schema the API validates the path with.
	const input = apiRouter.claims.get.inputSchema.safeParse({ claimId });
	if (!input.success) {
		notFound();
	}

	const [result] = await Promise.allSettled([createWebServerCaller().claims.get.query(input.data)]);
	const claim = settleServerQuery(result, { label: "claims.get", expected: ["unauthenticated", "forbidden", "not-found"] });

	if (claim.kind === "unauthenticated") {
		redirect(loginPath(returnPath));
	}
	if (claim.kind === "not-found") {
		notFound();
	}
	if (claim.kind === "forbidden") {
		return <FeatureUnavailableNotice feature={QR_FEATURE} />;
	}

	return (
		<AccessGate feature={QR_FEATURE}>
			<ClaimQrView claimId={input.data.claimId} initialClaim={claim.data} />
		</AccessGate>
	);
}
