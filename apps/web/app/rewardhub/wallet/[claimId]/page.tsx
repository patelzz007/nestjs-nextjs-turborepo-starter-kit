import { FeatureUnavailableNotice } from "@/components/auth/access-fallback";
import { AccessGate } from "@/components/auth/access-gate";
import { ClaimQrView } from "@/components/rewardhub/claims/qr-view";
import { settleServerQuery } from "@workspace/client/lib/api/server-query-outcome";
import { guardWebPage } from "@/lib/auth/page-guard";
import { loginPath, walletClaimPath } from "@/lib/routes";
import { createWebServerCaller } from "@/lib/web-server-api";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { notFound, redirect } from "next/navigation";
import * as React from "react";

export const dynamic = "force-dynamic";

const QR_FEATURE = "this redemption code";

/** `/rewardhub/wallet/[claimId]` — a claimed reward's redemption QR code. */
export default async function WalletClaimPage({ params }: { readonly params: Promise<{ claimId: string }> }): Promise<React.JSX.Element> {
	const { claimId } = await params;
	const returnPath = walletClaimPath(claimId);
	await guardWebPage(returnPath);

	// A malformed id names no claim — the same schema the API validates the path with.
	const input = apiRouter.claims.qr.inputSchema.safeParse({ claimId });
	if (!input.success) {
		notFound();
	}

	const [result] = await Promise.allSettled([createWebServerCaller().claims.qr.query(input.data)]);
	const qr = settleServerQuery(result, { label: "claims.qr", expected: ["unauthenticated", "forbidden", "not-found"] });

	if (qr.kind === "unauthenticated") {
		redirect(loginPath(returnPath));
	}
	if (qr.kind === "not-found") {
		notFound();
	}
	if (qr.kind === "forbidden") {
		return <FeatureUnavailableNotice feature={QR_FEATURE} />;
	}

	return (
		<AccessGate feature={QR_FEATURE}>
			<ClaimQrView claimId={input.data.claimId} initialQr={qr.data} />
		</AccessGate>
	);
}
