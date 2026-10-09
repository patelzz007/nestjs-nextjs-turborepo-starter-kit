// ============================================
// device-owner-authentication.ts - the OS check behind the app lock
// ============================================
// expo-local-authentication in front of Secure Store (§11.4): biometrics (Face
// ID, Touch ID, fingerprint, face) with the OS device passcode as fallback.
// Secure Store's own `requireAuthentication` is NOT used: Expo Go does not
// support it when biometrics are available.
//
// "Enrolled biometrics changed" (§11.2): the OS does not tell an app WHICH
// biometrics are enrolled. What expo-local-authentication exposes is the
// enrolled security level and the supported authentication types; their
// combination is the fingerprint stored when the lock is turned on. It
// changes when biometrics are removed (strong → passcode only), when the kind
// changes (fingerprint → face) or when the passcode is removed. It CANNOT see
// a finger or face ADDED to an existing enrollment — that needs the native
// keystore invalidation APIs, which require a native build (docs/technical/mobile/mobile-app.md §11.6).

import * as LocalAuthentication from "expo-local-authentication";

/** Whether the device can run the owner check at all, and the fingerprint of what is enrolled. */
export interface DeviceAuthenticationCapability {
	/** A passcode or biometrics is set up, so the OS can verify the owner. */
	readonly canAuthenticate: boolean;
	/** `<securityLevel>:<sorted authentication types>`, e.g. `3:1` (strong biometrics, fingerprint). */
	readonly fingerprint: string;
}

export type DeviceOwnerCheckResult = { readonly ok: true } | { readonly ok: false; readonly reason: "cancelled" | "unavailable" | "failed" };

/** Errors the user caused by dismissing the prompt — not a failure to report. */
const CANCELLED_ERRORS: readonly LocalAuthentication.LocalAuthenticationError[] = ["user_cancel", "system_cancel", "app_cancel"];

/** Errors that mean the device cannot check its owner (no passcode, no hardware). */
const UNAVAILABLE_ERRORS: readonly LocalAuthentication.LocalAuthenticationError[] = ["not_enrolled", "not_available", "passcode_not_set"];

/** Builds the fingerprint from what the OS reports (pure; exported for tests). */
export function fingerprintOf(level: LocalAuthentication.SecurityLevel, types: readonly LocalAuthentication.AuthenticationType[]): string {
	return `${String(level)}:${[...types].sort((left, right): number => left - right).join(",")}`;
}

export async function readDeviceAuthenticationCapability(): Promise<DeviceAuthenticationCapability> {
	const [level, types] = await Promise.all([LocalAuthentication.getEnrolledLevelAsync(), LocalAuthentication.supportedAuthenticationTypesAsync()]);
	return { canAuthenticate: level !== LocalAuthentication.SecurityLevel.NONE, fingerprint: fingerprintOf(level, types) };
}

/** Asks the OS to verify the device owner; the passcode is offered when biometrics fail or are absent. */
export async function authenticateDeviceOwner(promptMessage: string): Promise<DeviceOwnerCheckResult> {
	const result = await LocalAuthentication.authenticateAsync({ promptMessage, disableDeviceFallback: false });
	if (result.success) {
		return { ok: true };
	}
	if (CANCELLED_ERRORS.includes(result.error)) {
		return { ok: false, reason: "cancelled" };
	}
	return { ok: false, reason: UNAVAILABLE_ERRORS.includes(result.error) ? "unavailable" : "failed" };
}
