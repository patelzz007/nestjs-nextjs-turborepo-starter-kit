// ============================================
// app-lock-enrollment.ts - turning the lock on and off, and noticing changed biometrics
// ============================================
// Turning the lock on or off takes ONE successful owner check (§11.2). Turning
// it on stores the fingerprint of the device's enrolled authentication; on every
// later lock the fingerprint is compared, and a difference turns the lock off and
// requires a password sign-in (see device-owner-authentication.ts for what the
// fingerprint can and cannot detect). The lock is device-only: no API call, no
// audit event.

import { deleteSecureValue, readSecureValue, SECURE_STORE_ENTRIES, writeSecureValue } from "../../lib/secure-store";
import { authenticateDeviceOwner, readDeviceAuthenticationCapability, type DeviceOwnerCheckResult } from "./device-owner-authentication";

export type AppLockChangeResult = DeviceOwnerCheckResult;

/** One owner check, then the current enrollment fingerprint is stored. */
export async function turnAppLockOn(promptMessage: string): Promise<AppLockChangeResult> {
	const capability = await readDeviceAuthenticationCapability();
	if (!capability.canAuthenticate) {
		return { ok: false, reason: "unavailable" };
	}
	const check = await authenticateDeviceOwner(promptMessage);
	if (!check.ok) {
		return check;
	}
	await writeSecureValue(SECURE_STORE_ENTRIES.appLockBiometricFingerprint, capability.fingerprint);
	return { ok: true };
}

/** One owner check, then the stored fingerprint is removed. */
export async function turnAppLockOff(promptMessage: string): Promise<AppLockChangeResult> {
	const check = await authenticateDeviceOwner(promptMessage);
	if (check.ok) {
		await deleteSecureValue(SECURE_STORE_ENTRIES.appLockBiometricFingerprint);
	}
	return check;
}

/**
 * `true` while the device's enrolled authentication matches what it was when
 * the lock was turned on. A missing or unreadable fingerprint counts as changed:
 * the lock never lets a session through on a guess.
 */
export async function isEnrollmentUnchanged(): Promise<boolean> {
	try {
		const [stored, current] = await Promise.all([readSecureValue(SECURE_STORE_ENTRIES.appLockBiometricFingerprint), readDeviceAuthenticationCapability()]);
		return current.canAuthenticate && stored === current.fingerprint;
	} catch {
		return false;
	}
}

/** Forgets the lock's fingerprint (the lock was reset or turned off). */
export async function forgetEnrollment(): Promise<void> {
	await deleteSecureValue(SECURE_STORE_ENTRIES.appLockBiometricFingerprint);
}
