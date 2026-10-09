// What one device session row shows (§10.11): the server's label, the app, the
// platform line, and the details — every value as plain text.

import type { Session } from "@workspace/shared";

import type { DetailItem } from "../../components/detail-list";
import { formatDateTime, formatRelativeTime } from "../../lib/time-format";
import { CLIENT_TYPE_LABELS, SIGN_IN_METHOD_LABELS, UNKNOWN_CLIENT_TYPE_LABEL } from "./labels";

/** "Chrome 141" from "Chrome" + "141.0.0.0". */
function withMajorVersion(name: string | null, version: string | null): string | null {
	if (name === null) {
		return null;
	}
	const major = version?.split(".").at(0);
	return major === undefined || major.length === 0 ? name : `${name} ${major}`;
}

function joinPresent(parts: readonly (string | null)[]): string {
	return parts.filter((part): part is string => part !== null && part.length > 0).join(" · ");
}

export function clientTypeLabelOf(session: Session): string {
	return session.clientType === null ? UNKNOWN_CLIENT_TYPE_LABEL : CLIENT_TYPE_LABELS[session.clientType];
}

/** The model and OS of a phone; the browser and OS of a browser session. */
export function platformLineOf(session: Session): string {
	if (session.clientType === "mobile") {
		return joinPresent([session.deviceModel, withMajorVersion(session.osName, session.osVersion)]);
	}
	return joinPresent([withMajorVersion(session.browserName, session.browserVersion), withMajorVersion(session.osName, session.osVersion)]);
}

/** The detail lines of a row; a detail the API does not know (`null`) is left out. */
export function sessionDetailItems(session: Session, nowMs: number): DetailItem[] {
	const items: DetailItem[] = [];
	if (session.appVersion !== null) {
		items.push({ label: "App", value: `App ${session.appVersion}` });
	}
	if (session.signInMethod !== null) {
		items.push({ label: "Signed in with", value: SIGN_IN_METHOD_LABELS[session.signInMethod] });
	}
	if (session.ipAddress !== null) {
		items.push({ label: "Sign-in IP", value: session.ipAddress });
	}
	if (session.lastIpAddress !== null) {
		items.push({ label: "Last seen from", value: session.lastIpAddress });
	}
	if (session.location !== null) {
		items.push({
			label: "Location",
			value: [session.location.city, session.location.region, session.location.country].filter((part): part is string => part !== null).join(", "),
		});
	}
	items.push({ label: "Signed in", value: formatDateTime(session.createdAt) });
	items.push({ label: "Last active", value: formatRelativeTime(session.lastActiveAt, nowMs) });
	items.push({ label: "Expires", value: formatRelativeTime(session.expiresAt, nowMs) });
	return items;
}
