import { MerchantShell } from "@/components/merchant-shell";
import { getMerchantServerSession } from "@/lib/auth-server";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import { CapabilityMenuResponseSchema, type CapabilityMenuResponse } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

async function loadInitialNavigationMenu(server: Awaited<ReturnType<typeof loadMerchantServerContext>>["server"]): Promise<CapabilityMenuResponse | undefined> {
	try {
		const response = await server.navigation.menu.query({ scope: "MERCHANT" });
		const parsed = CapabilityMenuResponseSchema.safeParse(response.data);
		if (parsed.success) {
			return parsed.data;
		}
	} catch {
		return undefined;
	}
	return undefined;
}

export default async function MerchantPanelLayout({ children }: { readonly children: React.ReactNode }): Promise<React.JSX.Element> {
	const merchantContext = await loadMerchantServerContext();
	const [session, initialNavigationMenu] = await Promise.all([
		getMerchantServerSession(),
		loadInitialNavigationMenu(merchantContext.server),
	]);

	return (
		<MerchantShell
			initialMemberships={merchantContext.memberships}
			initialMerchantOrgId={merchantContext.merchantOrgId}
			initialUser={session.user}
			initialIsImpersonating={session.isImpersonating}
			initialNavigationMenu={initialNavigationMenu}
		>
			{children}
		</MerchantShell>
	);
}
