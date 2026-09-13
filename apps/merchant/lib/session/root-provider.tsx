"use client";

import { MerchantSessionBootstrap } from "@/components/merchant-session-bootstrap";
import { isMerchantAuthPath } from "@/lib/auth/routes";
import { writeMerchantOrgCookie } from "@/lib/org/org";
import { organizationPath, writeOrganizationSlugCookie } from "@/lib/org/slug";
import { ClientAuthWrapper } from "@workspace/client/lib/auth/session/client-auth-wrapper";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

export interface SetMerchantOrgIdOptions {
	/** When true, re-runs server components after switching org. Defaults to false. */
	readonly refresh?: boolean;
}

export interface MerchantOrgContextValue {
	readonly merchantOrgId: string | undefined;
	readonly organizationSlug: string | undefined;
	readonly setMerchantOrgId: (orgId: string, options?: SetMerchantOrgIdOptions) => void;
	readonly setOrganizationSlug: (slug: string, options?: SetMerchantOrgIdOptions) => void;
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
	readonly initialOrganizationSlug?: string;
}

/**
 * Merchant portal root — wires `X-Merchant-Org-Id` into every API call via AuthProvider extra headers.
 * Org selection is stored in a cookie so server components can prefetch with the same context.
 */
export function MerchantRootProvider({ children, initialMerchantOrgId, initialOrganizationSlug }: MerchantRootProviderProps): React.JSX.Element {
	const router = useRouter();
	const pathname = usePathname();
	const [merchantOrgId, setMerchantOrgIdState] = React.useState<string | undefined>(initialMerchantOrgId);
	const [organizationSlug, setOrganizationSlugState] = React.useState<string | undefined>(initialOrganizationSlug);

	React.useEffect((): void => {
		if (initialMerchantOrgId !== undefined) {
			writeMerchantOrgCookie(initialMerchantOrgId);
		}
		if (initialOrganizationSlug !== undefined) {
			writeOrganizationSlugCookie(initialOrganizationSlug);
		}
	}, [initialMerchantOrgId, initialOrganizationSlug]);

	const setMerchantOrgId = React.useCallback(
		(orgId: string, options?: SetMerchantOrgIdOptions): void => {
			if (merchantOrgId === orgId) {
				return;
			}
			setMerchantOrgIdState(orgId);
			writeMerchantOrgCookie(orgId);
			if (options?.refresh === true) {
				router.refresh();
			}
		},
		[merchantOrgId, router],
	);

	const setOrganizationSlug = React.useCallback(
		(slug: string, options?: SetMerchantOrgIdOptions): void => {
			if (organizationSlug === slug) {
				return;
			}
			setOrganizationSlugState(slug);
			writeOrganizationSlugCookie(slug);
			router.push(organizationPath(slug, "dashboard"));
			if (options?.refresh === true) {
				router.refresh();
			}
		},
		[organizationSlug, router],
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
			organizationSlug,
			setMerchantOrgId,
			setOrganizationSlug,
		}),
		[merchantOrgId, organizationSlug, setMerchantOrgId, setOrganizationSlug],
	);

	const shouldRedirectOnUnauthorized = React.useCallback((): boolean => {
		return !isMerchantAuthPath(pathname);
	}, [pathname]);

	const revalidateSessionEnabled = !isMerchantAuthPath(pathname);

	return (
		<ClientAuthWrapper
			cookieNames={MERCHANT_COOKIE_NAMES}
			clientType="merchant"
			extraHeaders={extraHeaders}
			shouldRedirectOnUnauthorized={shouldRedirectOnUnauthorized}
			revalidateSessionEnabled={revalidateSessionEnabled}>
			<MerchantSessionBootstrap />
			<MerchantOrgContext.Provider value={contextValue}>{children}</MerchantOrgContext.Provider>
		</ClientAuthWrapper>
	);
}
