import { WalletPageSkeleton } from "@/components/loading/wallet-skeleton";
import * as React from "react";

/** `/dashboard/wallet` while the server prefetches the claims page and the "ready to redeem" count. */
export default function DashboardWalletLoading(): React.JSX.Element {
	return <WalletPageSkeleton />;
}
