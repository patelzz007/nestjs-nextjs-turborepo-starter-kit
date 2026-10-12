import { ClaimQrSkeleton } from "@/components/loading/claim-qr-skeleton";
import * as React from "react";

/** `/rewardhub/wallet/[claimId]` while the server loads the redemption code. */
export default function WalletClaimLoading(): React.JSX.Element {
	return <ClaimQrSkeleton />;
}
