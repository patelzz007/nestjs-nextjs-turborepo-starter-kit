import { MerchantShell } from "@/components/merchant-shell";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import * as React from "react";

export const dynamic = "force-dynamic";

export default async function MerchantPanelLayout({ children }: { readonly children: React.ReactNode }): Promise<React.JSX.Element> {
	const { memberships, merchantOrgId } = await loadMerchantServerContext();

	return (
		<MerchantShell initialMemberships={memberships} initialMerchantOrgId={merchantOrgId}>
			{children}
		</MerchantShell>
	);
}
