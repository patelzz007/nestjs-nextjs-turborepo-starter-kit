// Copy of the "Signed-in devices" screen — the same wording as the web
// (packages/client SIGNED_IN_DEVICES_LABELS), which mobile cannot import.

import type { AuthClientType, SessionSignInMethod } from "@workspace/shared";

export const CLIENT_TYPE_LABELS: Readonly<Record<AuthClientType, string>> = { web: "Web", merchant: "Merchant", admin: "Admin", mobile: "Mobile app" };

export const UNKNOWN_CLIENT_TYPE_LABEL = "Unknown app";

export const SIGN_IN_METHOD_LABELS: Readonly<Record<SessionSignInMethod, string>> = {
	PASSWORD: "Password",
	PASSWORD_NEW_DEVICE_CODE: "Password + new-device code",
	PASSWORD_TOTP: "Password + 2FA",
	PASSWORD_TOTP_NEW_DEVICE_CODE: "Password + 2FA + new-device code",
	PASSWORD_BACKUP_CODE: "Password + backup code",
	PASSWORD_BACKUP_CODE_NEW_DEVICE_CODE: "Password + backup code + new-device code",
	TEAM_INVITE_REGISTRATION: "Team invitation",
	TEAM_INVITE_REGISTRATION_NEW_DEVICE_CODE: "Team invitation + new-device code",
};

export const DEVICES_COPY = {
	title: "Signed-in devices",
	description: "Every browser and phone signed in to your account. Sign out any you don't recognize — it takes effect immediately.",
	loading: "Loading your devices…",
	loadError: "We couldn't load your devices. Check your connection and try again.",
	retry: "Try again",
	empty: "No devices are signed in to your account.",
	thisDevice: "This device",
	revoke: "Revoke",
	revokeTitle: (label: string): string => `Sign out “${label}”?`,
	revokeDescription: "The device is signed out on its next request and has to sign in again to use your account.",
	revokeConfirm: "Sign out device",
	revoked: (label: string): string => `${label} has been signed out.`,
	signOutEverywhere: "Sign out everywhere",
	signOutEverywhereTitle: "Sign out of every device?",
	signOutEverywhereDescription: "This signs out every browser and app — including this phone. You'll need to sign in again everywhere.",
	signOutEverywhereFailed: "Your devices are still signed in. Please try again.",
	cancel: "Cancel",
};
