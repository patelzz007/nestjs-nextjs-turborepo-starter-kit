import type { AuthClientType } from "@workspace/shared";

/** The session fields a display label is built from (`null` on a session stored before device details existed). */
export interface SessionDeviceLabelFields {
	readonly clientType: AuthClientType | null;
	readonly browserName: string | null;
	readonly browserVersion: string | null;
	readonly osName: string | null;
	readonly deviceModel: string | null;
	readonly deviceName: string | null;
}

/** The label of a session that tells nothing about its device. */
export const UNKNOWN_DEVICE_LABEL = "Unknown device";

/** The label of a mobile session whose device reported neither a name nor a model. */
const MOBILE_APP_LABEL = "Mobile app";

const MAJOR_VERSION_PATTERN = /^(?<major>\d+)/;

/** `141.0.7390.54` → `141`; anything without a leading number → nothing. */
function majorVersion(version: string | null): string | null {
	if (version === null) {
		return null;
	}
	return MAJOR_VERSION_PATTERN.exec(version)?.groups?.major ?? null;
}

/** `Chrome 141` / `Chrome`. */
function browserLabel(fields: SessionDeviceLabelFields): string | null {
	if (fields.browserName === null) {
		return null;
	}
	const major: string | null = majorVersion(fields.browserVersion);
	return major === null ? fields.browserName : `${fields.browserName} ${major}`;
}

/**
 * The display label of a device session, built by the server so every client
 * shows the same name:
 * - mobile app: the device's own name, else its model, else `<OS> app`;
 * - browsers: `Chrome 141 on macOS`, or whichever half is known; a model or
 *   `Unknown device` when the User-Agent told nothing.
 */
export function buildSessionDeviceLabel(fields: SessionDeviceLabelFields): string {
	if (fields.clientType === "mobile") {
		return fields.deviceName ?? fields.deviceModel ?? (fields.osName === null ? MOBILE_APP_LABEL : `${fields.osName} app`);
	}
	const browser: string | null = browserLabel(fields);
	if (browser !== null && fields.osName !== null) {
		return `${browser} on ${fields.osName}`;
	}
	return browser ?? fields.osName ?? fields.deviceModel ?? UNKNOWN_DEVICE_LABEL;
}
