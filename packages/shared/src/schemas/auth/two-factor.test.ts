import { describe, expect, it } from "vitest";

import { BACKUP_CODE_COUNT, TwoFactorSetupResponseSchema, type TwoFactorSetupResponse } from "./two-factor";

const BACKUP_CODE = "ABCDEFGHJKMNPQRS";

const setup: TwoFactorSetupResponse = {
	secret: "JBSWY3DPEHPK3PXP",
	qrCodeDataUrl: "data:image/png;base64,AAAA",
	otpAuthUrl: "otpauth://totp/Issuer:member%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Issuer",
	backupCodes: Array.from({ length: BACKUP_CODE_COUNT }, (): string => BACKUP_CODE),
};

describe("TwoFactorSetupResponseSchema", () => {
	it("carries the otpauth:// key URI next to the QR code", () => {
		expect(TwoFactorSetupResponseSchema.parse(setup)).toEqual(setup);
	});

	it("requires the key URI (the mobile app has no camera path to the QR code)", () => {
		const withoutUri: Omit<TwoFactorSetupResponse, "otpAuthUrl"> = { secret: setup.secret, qrCodeDataUrl: setup.qrCodeDataUrl, backupCodes: setup.backupCodes };

		expect(TwoFactorSetupResponseSchema.safeParse(withoutUri).success).toBe(false);
	});

	it.each(["https://example.com/?secret=X", "otpauth:/totp/x", "", " otpauth://totp/x"])("rejects %j as a key URI", (otpAuthUrl: string) => {
		expect(TwoFactorSetupResponseSchema.safeParse({ ...setup, otpAuthUrl }).success).toBe(false);
	});

	it("bounds the key URI length", () => {
		expect(TwoFactorSetupResponseSchema.safeParse({ ...setup, otpAuthUrl: `otpauth://totp/${"a".repeat(2048)}` }).success).toBe(false);
	});
});
