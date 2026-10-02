import { AccessGate } from "@/components/auth/access-gate";
import { ClaimQrView } from "@/components/rewardhub/claims/qr-view";
import { createWebServerCaller } from "@/lib/web-server-api";
import type { RewardClaimQrResponse } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

/** `/rewardhub/wallet/[claimId]` — a claimed reward's redemption QR code. */
export default async function WalletClaimPage({ params }: { readonly params: Promise<{ claimId: string }> }): Promise<React.JSX.Element> {
	const { claimId } = await params;
	const server = createWebServerCaller();

	let initialQr: RewardClaimQrResponse | undefined;
	try {
		const response = await server.claims.qr.query({ claimId });
		initialQr = response.data;
	} catch {
		initialQr = undefined;
	}

	return (
		<AccessGate feature="this redemption code">
			<ClaimQrView claimId={claimId} initialQr={initialQr} />
		</AccessGate>
	);
}
