import { memorySecureStore } from "../../test/secure-store-memory";
import { deleteSecureValue, readSecureValue, readSecureValueOrDefault, SECURE_STORE_ENTRIES, SecureStoreUnavailableError, writeSecureValue } from "./secure-store";

describe("the Secure Store registry", () => {
	it("declares one key per value (§9.7), all made of characters Secure Store accepts", () => {
		const keys = Object.values(SECURE_STORE_ENTRIES).map((entry): string => entry.key);
		expect(keys).toEqual([
			"auth.accessToken",
			"auth.refreshToken",
			"prefs.theme",
			"prefs.appLock.enabled",
			"prefs.appLock.timeoutMs",
			"prefs.appLock.enrolledBiometrics",
			"prefs.onboarding.completed",
		]);
		expect(new Set(keys).size).toBe(keys.length);
		for (const key of keys) {
			expect(key).toMatch(/^[\w.-]+$/);
		}
	});
});

describe("readSecureValue", () => {
	it("reads a stored value through its schema", async () => {
		await writeSecureValue(SECURE_STORE_ENTRIES.theme, "dark");
		await expect(readSecureValue(SECURE_STORE_ENTRIES.theme)).resolves.toBe("dark");
	});

	it("reads an absent value as null", async () => {
		await expect(readSecureValue(SECURE_STORE_ENTRIES.refreshToken)).resolves.toBeNull();
	});

	it.each([
		["not JSON", "{oops"],
		["a value outside the schema", JSON.stringify("sepia")],
		["the wrong JSON type", JSON.stringify(42)],
		["an object", JSON.stringify({ theme: "dark" })],
	])("treats %s as absent and removes it", async (_what, raw) => {
		memorySecureStore.seed("prefs.theme", raw);

		await expect(readSecureValue(SECURE_STORE_ENTRIES.theme)).resolves.toBeNull();
		expect(memorySecureStore.peek("prefs.theme")).toBeNull();
	});

	it("reports an unreadable store as SecureStoreUnavailableError", async () => {
		memorySecureStore.getItemAsync.mockRejectedValueOnce(new Error("keychain locked"));

		await expect(readSecureValue(SECURE_STORE_ENTRIES.accessToken)).rejects.toBeInstanceOf(SecureStoreUnavailableError);
	});
});

describe("readSecureValueOrDefault", () => {
	it("returns the default for an absent value without writing it", async () => {
		await expect(readSecureValueOrDefault(SECURE_STORE_ENTRIES.appLockEnabled, false)).resolves.toBe(false);
		expect(memorySecureStore.peek("prefs.appLock.enabled")).toBeNull();
	});

	it("overwrites a corrupt value with the default", async () => {
		memorySecureStore.seed("prefs.appLock.timeoutMs", JSON.stringify(12_345));

		await expect(readSecureValueOrDefault(SECURE_STORE_ENTRIES.appLockTimeoutMs, 60_000)).resolves.toBe(60_000);
		expect(memorySecureStore.peek("prefs.appLock.timeoutMs")).toBe("60000");
	});

	it("falls back to the default, untouched, when the store cannot be read", async () => {
		memorySecureStore.seed("prefs.theme", JSON.stringify("dark"));
		memorySecureStore.getItemAsync.mockRejectedValueOnce("unavailable");

		await expect(readSecureValueOrDefault(SECURE_STORE_ENTRIES.theme, "system")).resolves.toBe("system");
		expect(memorySecureStore.peek("prefs.theme")).toBe(JSON.stringify("dark"));
	});
});

describe("writeSecureValue / deleteSecureValue", () => {
	it("stores JSON and refuses a value its schema rejects", async () => {
		await writeSecureValue(SECURE_STORE_ENTRIES.appLockEnabled, true);
		expect(memorySecureStore.peek("prefs.appLock.enabled")).toBe("true");

		await expect(writeSecureValue(SECURE_STORE_ENTRIES.accessToken, "")).rejects.toThrow();
		expect(memorySecureStore.peek("auth.accessToken")).toBeNull();
	});

	it("deletes a value", async () => {
		await writeSecureValue(SECURE_STORE_ENTRIES.refreshToken, "refresh-1");
		await deleteSecureValue(SECURE_STORE_ENTRIES.refreshToken);
		expect(memorySecureStore.peek("auth.refreshToken")).toBeNull();
	});

	it("reports failing writes and deletes as SecureStoreUnavailableError", async () => {
		memorySecureStore.setItemAsync.mockRejectedValueOnce(new Error("full"));
		await expect(writeSecureValue(SECURE_STORE_ENTRIES.theme, "light")).rejects.toBeInstanceOf(SecureStoreUnavailableError);

		memorySecureStore.deleteItemAsync.mockRejectedValueOnce(new Error("locked"));
		await expect(deleteSecureValue(SECURE_STORE_ENTRIES.theme)).rejects.toBeInstanceOf(SecureStoreUnavailableError);
	});
});
