import { describe, expect, it } from "vitest";

import { FirebaseInstallationIdSchema, RegisterPushDeviceSchema } from "../notifications";

/** A Firebase Installation ID as Firebase generates it: 22 URL-safe base64 characters, `c`–`f` first. */
const FID = "fH3kVq9TzR1aB2cD3eF4g_";
const ANDROID = { token: "fcm-token", platform: "ANDROID", surface: "CUSTOMER", deviceLabel: "Pixel 9", appVersion: "1.4.0" };

describe("FirebaseInstallationIdSchema (enhancement 5.3)", () => {
	it("accepts a generated FID and refuses anything else", () => {
		expect(FirebaseInstallationIdSchema.safeParse(FID).success).toBe(true);
		expect(FirebaseInstallationIdSchema.safeParse("aH3kVq9TzR1aB2cD3eF4g_").success).toBe(false);
		expect(FirebaseInstallationIdSchema.safeParse(`${FID}x`).success).toBe(false);
		expect(FirebaseInstallationIdSchema.safeParse("fH3kVq9TzR1aB2cD3eF4g=").success).toBe(false);
	});
});

describe("RegisterPushDeviceSchema", () => {
	it("keeps an Android install's FID", () => {
		expect(RegisterPushDeviceSchema.parse({ ...ANDROID, installationId: FID }).installationId).toBe(FID);
	});

	it("reads an older app build that doesn't report one as none (the token is used)", () => {
		expect(RegisterPushDeviceSchema.parse(ANDROID).installationId).toBeNull();
	});

	it("refuses an FID on iOS, which APNs addresses by token", () => {
		expect(RegisterPushDeviceSchema.safeParse({ ...ANDROID, platform: "IOS", installationId: FID }).success).toBe(false);
		expect(RegisterPushDeviceSchema.safeParse({ ...ANDROID, platform: "IOS", installationId: null }).success).toBe(true);
	});
});
