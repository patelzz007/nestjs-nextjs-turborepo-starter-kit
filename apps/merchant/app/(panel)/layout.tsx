import { MerchantShell } from "@/components/merchant-shell";
import { getMerchantServerSession } from "@/lib/auth-server";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import * as React from "react";

export const dynamic = "force-dynamic";

export default async function MerchantPanelLayout({ children }: { readonly children: React.ReactNode }): Promise<React.JSX.Element> {
	const merchantContext = await loadMerchantServerContext();
	const session = await getMerchantServerSession();

	return (
		<MerchantShell
			initialMemberships={merchantContext.memberships}
			initialMerchantOrgId={merchantContext.merchantOrgId}
			initialUser={session.user}
			initialIsImpersonating={session.isImpersonating}>
			{children}
		</MerchantShell>
	);
}
