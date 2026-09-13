"use client";

import { MerchantSessionBootstrap } from "@/components/merchant-session-bootstrap";
import { isMerchantAuthPath } from "@/lib/auth/routes";
import { clearOrganizationLocationCookie } from "@/lib/org/location";
import { organizationPath, writeOrganizationSlugCookie } from "@/lib/org/slug";
import { ClientAuthWrapper } from "@workspace/client/lib/auth/session/client-auth-wrapper";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

export interface SetOrganizationSlugOptions {
	/** When true, re-runs server components after switching org. Defaults to false. */
	readonly refresh?: boolean;
}

export interface MerchantOrgContextValue {
	readonly organizationSlug: string | undefined;
	readonly setOrganizationSlug: (slug: string, options?: SetOrganizationSlugOptions) => void;
	/** Sync org slug from URL/layout without navigating away from the current page. */
	readonly syncOrganizationSlug: (slug: string) => void;
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
	readonly initialOrganizationSlug?: string;
}

/** Merchant portal root — org context is URL-scoped via organizationSlug cookie. */
export function MerchantRootProvider({ children, initialOrganizationSlug }: MerchantRootProviderProps): React.JSX.Element {
	const router = useRouter();
	const pathname = usePathname();
	const [organizationSlug, setOrganizationSlugState] = React.useState<string | undefined>(initialOrganizationSlug);

	React.useEffect((): void => {
		if (initialOrganizationSlug !== undefined) {
			writeOrganizationSlugCookie(initialOrganizationSlug);
		}
	}, [initialOrganizationSlug]);

	const syncOrganizationSlug = React.useCallback(
		(slug: string): void => {
			if (organizationSlug === slug) {
				return;
			}
			setOrganizationSlugState(slug);
			writeOrganizationSlugCookie(slug);
		},
		[organizationSlug],
	);

	const setOrganizationSlug = React.useCallback(
		(slug: string, options?: SetOrganizationSlugOptions): void => {
			if (organizationSlug === slug) {
				return;
			}
			setOrganizationSlugState(slug);
			writeOrganizationSlugCookie(slug);
			clearOrganizationLocationCookie();
			router.push(organizationPath(slug, "dashboard"));
			if (options?.refresh === true) {
				router.refresh();
			}
		},
		[organizationSlug, router],
	);

	const contextValue = React.useMemo(
		(): MerchantOrgContextValue => ({
			organizationSlug,
			setOrganizationSlug,
			syncOrganizationSlug,
		}),
		[organizationSlug, setOrganizationSlug, syncOrganizationSlug],
	);

	const shouldRedirectOnUnauthorized = React.useCallback((): boolean => {
		return !isMerchantAuthPath(pathname);
	}, [pathname]);

	const revalidateSessionEnabled = !isMerchantAuthPath(pathname);

	return (
		<ClientAuthWrapper
			cookieNames={MERCHANT_COOKIE_NAMES}
			clientType="merchant"
			shouldRedirectOnUnauthorized={shouldRedirectOnUnauthorized}
			revalidateSessionEnabled={revalidateSessionEnabled}>
			<MerchantSessionBootstrap />
			<MerchantOrgContext.Provider value={contextValue}>{children}</MerchantOrgContext.Provider>
		</ClientAuthWrapper>
	);
}
