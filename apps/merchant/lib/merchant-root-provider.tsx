"use client";

import { MerchantSessionBootstrap } from "@/components/merchant-session-bootstrap";
import { writeMerchantOrgCookie } from "@/lib/merchant-org";
import { ClientAuthWrapper } from "@workspace/client/lib/auth/client-auth-wrapper";
import { useRouter } from "next/navigation";
import * as React from "react";

export interface MerchantOrgContextValue {
	readonly merchantOrgId: string | undefined;
	readonly setMerchantOrgId: (orgId: string) => void;
}

const MerchantOrgContext = React.createContext<MerchantOrgContextValue | null>(null);

const MERCHANT_COOKIE_NAMES = {
	accessToken: "merchantAccessToken",
	refreshToken: "merchantRefreshToken",
};

export function useMerchantOrg(): MerchantOrgContextValue {
	const context = React.useContext(MerchantOrgContext);
	if (context === null) {
		throw new Error("useMerchantOrg must be used within MerchantRootProvider");
	}
	return context;
}

export interface MerchantRootProviderProps {
	readonly children: React.ReactNode;
	readonly initialMerchantOrgId?: string;
}

/**
 * Merchant portal root — wires `X-Merchant-Org-Id` into every API call via AuthProvider extra headers.
 * Org selection is stored in a cookie so server components can prefetch with the same context.
 */
export function MerchantRootProvider({ children, initialMerchantOrgId }: MerchantRootProviderProps): React.JSX.Element {
	const router = useRouter();
	const [merchantOrgId, setMerchantOrgIdState] = React.useState<string | undefined>(initialMerchantOrgId);

	React.useEffect((): void => {
		if (initialMerchantOrgId !== undefined) {
			writeMerchantOrgCookie(initialMerchantOrgId);
		}
	}, [initialMerchantOrgId]);

	const setMerchantOrgId = React.useCallback(
		(orgId: string): void => {
			setMerchantOrgIdState(orgId);
			writeMerchantOrgCookie(orgId);
			router.refresh();
		},
		[router],
	);

	const extraHeaders = React.useMemo((): Record<string, string> | undefined => {
		if (merchantOrgId === undefined) {
			return undefined;
		}
		return { "X-Merchant-Org-Id": merchantOrgId };
	}, [merchantOrgId]);

	const contextValue = React.useMemo(
		(): MerchantOrgContextValue => ({
			merchantOrgId,
			setMerchantOrgId,
		}),
		[merchantOrgId, setMerchantOrgId],
	);

	return (
		<ClientAuthWrapper cookieNames={MERCHANT_COOKIE_NAMES} clientType="merchant" extraHeaders={extraHeaders}>
			<MerchantSessionBootstrap />
			<MerchantOrgContext.Provider value={contextValue}>{children}</MerchantOrgContext.Provider>
		</ClientAuthWrapper>
	);
}
