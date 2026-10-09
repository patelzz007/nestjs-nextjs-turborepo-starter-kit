import type { AuthClientType, SessionSignInMethod } from "@workspace/shared";

/**
 * Every string of the "Signed-in devices" section (docs/technical/mobile/mobile-app.md §8.8).
 * One object, so a locale is one more value of this type — the components never hardcode copy.
 */
export interface SignedInDevicesLabels {
	readonly title: string;
	readonly description: string;
	readonly listLabel: string;
	readonly loading: string;
	readonly loadErrorTitle: string;
	readonly loadErrorDescription: string;
	readonly retry: string;
	readonly empty: string;
	readonly thisDevice: string;
	readonly revoke: string;
	/** Accessible name of a row's revoke button, naming the device. */
	readonly revokeDevice: (deviceLabel: string) => string;
	readonly revokeTitle: (deviceLabel: string) => string;
	readonly revokeDescription: string;
	readonly revokeConfirm: string;
	readonly revokePending: string;
	readonly revokedTitle: string;
	readonly revokedDescription: (deviceLabel: string) => string;
	readonly signOutEverywhere: string;
	readonly signOutEverywhereTitle: string;
	readonly signOutEverywhereDescription: string;
	readonly signOutEverywhereConfirm: string;
	readonly signOutEverywherePending: string;
	readonly signOutEverywhereFailedTitle: string;
	readonly signOutEverywhereFailedDescription: string;
	readonly fields: {
		readonly signInMethod: string;
		readonly app: string;
		readonly ipAddress: string;
		readonly lastIpAddress: string;
		readonly location: string;
		readonly signedIn: string;
		readonly lastActive: string;
		readonly expires: string;
	};
	/** The app a session belongs to; `unknownClientType` for a session stored before client types were recorded. */
	readonly clientTypes: Readonly<Record<AuthClientType, string>>;
	readonly unknownClientType: string;
	readonly signInMethods: Readonly<Record<SessionSignInMethod, string>>;
	/** `App 1.4.0`. */
	readonly appVersion: (version: string) => string;
	/** `Chrome 141 · macOS 16.1` — the browser and OS line of a browser session. */
	readonly platform: (browser: string | null, os: string | null) => string;
}

function joinPresent(parts: readonly (string | null)[], separator: string): string {
	return parts.filter((part): part is string => part !== null && part.length > 0).join(separator);
}

/** English copy (the default). */
export const SIGNED_IN_DEVICES_LABELS: SignedInDevicesLabels = {
	title: "Signed-in devices",
	description: "Every browser and phone signed in to your account. Sign out any you don't recognize — it takes effect immediately.",
	listLabel: "Signed-in devices",
	loading: "Loading your devices…",
	loadErrorTitle: "We couldn't load your devices",
	loadErrorDescription: "Check your connection and try again.",
	retry: "Try again",
	empty: "No devices are signed in to your account.",
	thisDevice: "This device",
	revoke: "Revoke",
	revokeDevice: (deviceLabel: string): string => `Revoke ${deviceLabel}`,
	revokeTitle: (deviceLabel: string): string => `Sign out “${deviceLabel}”?`,
	revokeDescription: "The device is signed out on its next request and has to sign in again to use your account.",
	revokeConfirm: "Sign out device",
	revokePending: "Signing out…",
	revokedTitle: "Device signed out",
	revokedDescription: (deviceLabel: string): string => `${deviceLabel} has been signed out.`,
	signOutEverywhere: "Sign out everywhere",
	signOutEverywhereTitle: "Sign out of every device?",
	signOutEverywhereDescription: "This signs out every browser and the mobile app — including this device. You'll need to sign in again everywhere.",
	signOutEverywhereConfirm: "Sign out everywhere",
	signOutEverywherePending: "Signing out…",
	signOutEverywhereFailedTitle: "Could not sign out everywhere",
	signOutEverywhereFailedDescription: "Your devices are still signed in. Please try again.",
	fields: {
		signInMethod: "Signed in with",
		app: "App",
		ipAddress: "Sign-in IP",
		lastIpAddress: "Last seen from",
		location: "Location",
		signedIn: "Signed in",
		lastActive: "Last active",
		expires: "Expires",
	},
	clientTypes: { web: "Web", merchant: "Merchant", admin: "Admin", mobile: "Mobile app" },
	unknownClientType: "Unknown app",
	signInMethods: {
		PASSWORD: "Password",
		PASSWORD_NEW_DEVICE_CODE: "Password + new-device code",
		PASSWORD_TOTP: "Password + 2FA",
		PASSWORD_TOTP_NEW_DEVICE_CODE: "Password + 2FA + new-device code",
		PASSWORD_BACKUP_CODE: "Password + backup code",
		PASSWORD_BACKUP_CODE_NEW_DEVICE_CODE: "Password + backup code + new-device code",
		TEAM_INVITE_REGISTRATION: "Team invitation",
		TEAM_INVITE_REGISTRATION_NEW_DEVICE_CODE: "Team invitation + new-device code",
	},
	appVersion: (version: string): string => `App ${version}`,
	platform: (browser: string | null, os: string | null): string => joinPresent([browser, os], " · "),
};
