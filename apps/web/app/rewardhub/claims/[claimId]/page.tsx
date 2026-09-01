import { ClaimQrView } from "@/components/rewardhub/claim-qr-view";
import { createWebServerCaller } from "@/lib/web-server-api";
import type { RewardClaimQrResponse } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

export default async function ClaimQrPage({ params }: { readonly params: Promise<{ claimId: string }> }): Promise<React.JSX.Element> {
	const { claimId } = await params;
	const server = createWebServerCaller();

	let initialQr: RewardClaimQrResponse | undefined;
	try {
		const response = await server.claims.qr.query({ claimId });
		initialQr = response.data;
	} catch {
		initialQr = undefined;
	}

	return <ClaimQrView claimId={claimId} initialQr={initialQr} />;
}
