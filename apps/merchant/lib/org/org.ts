/** Cookie + header key for the active merchant organization. */
export const MERCHANT_ORG_COOKIE_NAME = "merchantOrgId";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function merchantOrgHeaders(orgId: string | undefined): Readonly<Record<string, string>> | undefined {
	if (orgId === undefined) {
		return undefined;
	}
	return { "X-Merchant-Org-Id": orgId };
}

/** Client-side: persist selected store for SSR + API headers. */
export function writeMerchantOrgCookie(orgId: string): void {
	document.cookie = `${MERCHANT_ORG_COOKIE_NAME}=${encodeURIComponent(orgId)}; path=/; max-age=${String(COOKIE_MAX_AGE_SECONDS)}; samesite=lax`;
}

/** Client-side: read selected store from cookie (SSR-hydrated preference). */
export function readMerchantOrgCookie(): string | undefined {
	if (typeof document === "undefined") {
		return undefined;
	}
	const prefix = `${MERCHANT_ORG_COOKIE_NAME}=`;
	const match = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
	if (match === undefined) {
		return undefined;
	}
	const value = match.slice(prefix.length);
	return value.length > 0 ? decodeURIComponent(value) : undefined;
}
