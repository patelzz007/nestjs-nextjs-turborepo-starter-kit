/** Where opening a notification leads: a page of this app, an https page elsewhere, or nowhere. */
export type NotificationLinkTarget = { readonly kind: "internal"; readonly href: string } | { readonly kind: "external"; readonly href: string } | null;

const SAFE_EXTERNAL_PROTOCOL = "https:";

/**
 * Reads a notification's stored `link`. An app path (`/rewards/…`) stays in the app, and so does an `https`
 * URL of this app's own origin (`currentOrigin`: an operations alert's link to the admin panel, opened in
 * the admin panel); any other `https` URL opens in a new tab; anything else (a protocol-relative `//host`,
 * `javascript:`, plain text) leads nowhere.
 */
export function notificationLinkTarget(link: string | null, currentOrigin: string | null = null): NotificationLinkTarget {
	if (link === null || link.length === 0) {
		return null;
	}
	if (link.startsWith("/")) {
		return link.startsWith("//") ? null : { kind: "internal", href: link };
	}
	if (!URL.canParse(link)) {
		return null;
	}
	const url = new URL(link);
	if (url.protocol !== SAFE_EXTERNAL_PROTOCOL) {
		return null;
	}
	return url.origin === currentOrigin ? { kind: "internal", href: `${url.pathname}${url.search}${url.hash}` } : { kind: "external", href: link };
}
