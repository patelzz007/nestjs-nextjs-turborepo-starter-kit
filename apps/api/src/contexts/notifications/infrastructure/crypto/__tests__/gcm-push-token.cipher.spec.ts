import { describe, expect, it } from "vitest";

import { GcmPushTokenCipher, PushTokenCipherUnavailableError } from "../gcm-push-token.cipher";

const KEY_V1 = Buffer.alloc(32, 1).toString("base64");
const KEY_V2 = Buffer.alloc(32, 2).toString("base64");
const TOKEN = "fcm-token-abc";

describe("GcmPushTokenCipher", () => {
	it("seals with the highest version, bound to the device", () => {
		const cipher = new GcmPushTokenCipher({ 1: KEY_V1, 2: KEY_V2 });
		const sealed = cipher.encrypt(TOKEN, "device-1");
		expect(sealed.startsWith("v2:")).toBe(true);
		expect(sealed).not.toContain(TOKEN);
		expect(cipher.decrypt(sealed, "device-1")).toBe(TOKEN);
		expect(() => cipher.decrypt(sealed, "device-2")).toThrow();
	});

	// The key-rotation rehearsal (enhancement 1.8): add version 2, keep version 1 until nothing uses it.
	it("still opens tokens sealed before a rotation, and seals new ones with the new version", () => {
		const sealedUnderV1 = new GcmPushTokenCipher({ 1: KEY_V1 }).encrypt(TOKEN, "device-1");
		const rotated = new GcmPushTokenCipher({ 1: KEY_V1, 2: KEY_V2 });
		expect(rotated.decrypt(sealedUnderV1, "device-1")).toBe(TOKEN);
		expect(rotated.encrypt(TOKEN, "device-1").startsWith("v2:")).toBe(true);
	});

	it("can't open a token whose version was retired too early, and is unavailable without keys", () => {
		const sealedUnderV1 = new GcmPushTokenCipher({ 1: KEY_V1 }).encrypt(TOKEN, "device-1");
		expect(() => new GcmPushTokenCipher({ 2: KEY_V2 }).decrypt(sealedUnderV1, "device-1")).toThrow(PushTokenCipherUnavailableError);
		const none = new GcmPushTokenCipher(null);
		expect(none.available).toBe(false);
		expect(() => none.encrypt(TOKEN, "device-1")).toThrow(PushTokenCipherUnavailableError);
	});
});
