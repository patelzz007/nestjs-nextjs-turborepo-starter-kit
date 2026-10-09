import * as LocalAuthentication from "expo-local-authentication";

import { memorySecureStore } from "../../../test/secure-store-memory";
import { forgetEnrollment, isEnrollmentUnchanged, turnAppLockOff, turnAppLockOn } from "./app-lock-enrollment";
import { authenticateDeviceOwner, fingerprintOf, readDeviceAuthenticationCapability } from "./device-owner-authentication";

jest.mock("expo-local-authentication", () => ({
	SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
	AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
	getEnrolledLevelAsync: jest.fn(),
	supportedAuthenticationTypesAsync: jest.fn(),
	authenticateAsync: jest.fn(),
}));

const mocked = jest.mocked(LocalAuthentication);

function deviceWith(level: LocalAuthentication.SecurityLevel, types: LocalAuthentication.AuthenticationType[]): void {
	mocked.getEnrolledLevelAsync.mockResolvedValue(level);
	mocked.supportedAuthenticationTypesAsync.mockResolvedValue(types);
}

const FINGERPRINT_PHONE = (): void => {
	deviceWith(LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG, [LocalAuthentication.AuthenticationType.FINGERPRINT]);
};

describe("fingerprintOf", () => {
	it("combines the level with the sorted authentication types", () => {
		expect(
			fingerprintOf(LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG, [
				LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
				LocalAuthentication.AuthenticationType.FINGERPRINT,
			]),
		).toBe("3:1,2");
		expect(fingerprintOf(LocalAuthentication.SecurityLevel.SECRET, [])).toBe("1:");
	});
});

describe("readDeviceAuthenticationCapability", () => {
	it("needs at least a device passcode", async () => {
		deviceWith(LocalAuthentication.SecurityLevel.NONE, []);
		await expect(readDeviceAuthenticationCapability()).resolves.toEqual({ canAuthenticate: false, fingerprint: "0:" });
		deviceWith(LocalAuthentication.SecurityLevel.SECRET, []);
		await expect(readDeviceAuthenticationCapability()).resolves.toEqual({ canAuthenticate: true, fingerprint: "1:" });
	});
});

describe("authenticateDeviceOwner", () => {
	it("allows the device passcode as fallback", async () => {
		mocked.authenticateAsync.mockResolvedValue({ success: true });
		await expect(authenticateDeviceOwner("Unlock")).resolves.toEqual({ ok: true });
		expect(mocked.authenticateAsync).toHaveBeenCalledWith({ promptMessage: "Unlock", disableDeviceFallback: false });
	});

	it.each([
		["user_cancel", "cancelled"],
		["system_cancel", "cancelled"],
		["app_cancel", "cancelled"],
		["not_enrolled", "unavailable"],
		["passcode_not_set", "unavailable"],
		["not_available", "unavailable"],
		["lockout", "failed"],
		["authentication_failed", "failed"],
	] satisfies [LocalAuthentication.LocalAuthenticationError, string][])("maps %s to %s", async (error, reason) => {
		mocked.authenticateAsync.mockResolvedValue({ success: false, error });
		await expect(authenticateDeviceOwner("Unlock")).resolves.toEqual({ ok: false, reason });
	});
});

describe("turning the app lock on and off (§11.2)", () => {
	it("turns on after one successful check and stores the enrollment fingerprint", async () => {
		FINGERPRINT_PHONE();
		mocked.authenticateAsync.mockResolvedValue({ success: true });

		await expect(turnAppLockOn("Confirm")).resolves.toEqual({ ok: true });
		expect(mocked.authenticateAsync).toHaveBeenCalledTimes(1);
		expect(memorySecureStore.peek("prefs.appLock.enrolledBiometrics")).toBe(JSON.stringify("3:1"));
	});

	it("does not turn on when the check fails, or the device has no passcode", async () => {
		FINGERPRINT_PHONE();
		mocked.authenticateAsync.mockResolvedValue({ success: false, error: "user_cancel" });
		await expect(turnAppLockOn("Confirm")).resolves.toEqual({ ok: false, reason: "cancelled" });

		deviceWith(LocalAuthentication.SecurityLevel.NONE, []);
		await expect(turnAppLockOn("Confirm")).resolves.toEqual({ ok: false, reason: "unavailable" });
		expect(memorySecureStore.peek("prefs.appLock.enrolledBiometrics")).toBeNull();
	});

	it("turns off after one successful check and forgets the fingerprint", async () => {
		memorySecureStore.seed("prefs.appLock.enrolledBiometrics", JSON.stringify("3:1"));
		mocked.authenticateAsync.mockResolvedValue({ success: true });

		await expect(turnAppLockOff("Confirm")).resolves.toEqual({ ok: true });
		expect(memorySecureStore.peek("prefs.appLock.enrolledBiometrics")).toBeNull();
	});

	it("stays on when the check to turn it off fails", async () => {
		memorySecureStore.seed("prefs.appLock.enrolledBiometrics", JSON.stringify("3:1"));
		mocked.authenticateAsync.mockResolvedValue({ success: false, error: "authentication_failed" });

		await expect(turnAppLockOff("Confirm")).resolves.toEqual({ ok: false, reason: "failed" });
		expect(memorySecureStore.peek("prefs.appLock.enrolledBiometrics")).toBe(JSON.stringify("3:1"));
	});
});

describe("isEnrollmentUnchanged — biometrics removed or changed", () => {
	beforeEach(() => {
		memorySecureStore.seed("prefs.appLock.enrolledBiometrics", JSON.stringify("3:1"));
	});

	it("is true while the enrollment matches", async () => {
		FINGERPRINT_PHONE();
		await expect(isEnrollmentUnchanged()).resolves.toBe(true);
	});

	it.each([
		["biometrics removed (passcode only)", LocalAuthentication.SecurityLevel.SECRET, []],
		["fingerprint replaced by face", LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG, [LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION]],
		["passcode removed", LocalAuthentication.SecurityLevel.NONE, []],
	] satisfies [string, LocalAuthentication.SecurityLevel, LocalAuthentication.AuthenticationType[]][])("is false when %s", async (_what, level, types) => {
		deviceWith(level, types);
		await expect(isEnrollmentUnchanged()).resolves.toBe(false);
	});

	it("is false without a stored fingerprint, or when the OS cannot be asked", async () => {
		await forgetEnrollment();
		FINGERPRINT_PHONE();
		await expect(isEnrollmentUnchanged()).resolves.toBe(false);

		memorySecureStore.seed("prefs.appLock.enrolledBiometrics", JSON.stringify("3:1"));
		mocked.getEnrolledLevelAsync.mockRejectedValue(new Error("unavailable"));
		await expect(isEnrollmentUnchanged()).resolves.toBe(false);
	});
});
