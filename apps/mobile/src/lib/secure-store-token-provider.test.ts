import { memorySecureStore } from "../../test/secure-store-memory";
import { RefreshTokenLockedError, SecureStoreTokenProvider } from "./secure-store-token-provider";

const PAIR = { accessToken: "access-1", refreshToken: "refresh-1" };

describe("SecureStoreTokenProvider", () => {
	it("saves both tokens (refresh first) and reports the new access token", async () => {
		const onTokensSaved = jest.fn();
		const provider = new SecureStoreTokenProvider({ canReadRefreshToken: (): boolean => true, onTokensSaved });

		await provider.saveTokens(PAIR);

		expect(memorySecureStore.setItemAsync.mock.calls.map(([key]): string => key)).toEqual(["auth.refreshToken", "auth.accessToken"]);
		expect(onTokensSaved).toHaveBeenCalledWith("access-1");
		await expect(provider.getAccessToken()).resolves.toBe("access-1");
		await expect(provider.getRefreshToken()).resolves.toBe("refresh-1");
	});

	it("never reads the refresh token while the app lock is pending", async () => {
		const provider = new SecureStoreTokenProvider({ canReadRefreshToken: (): boolean => false });
		await provider.saveTokens(PAIR);
		memorySecureStore.getItemAsync.mockClear();

		await expect(provider.getRefreshToken()).rejects.toBeInstanceOf(RefreshTokenLockedError);
		expect(memorySecureStore.getItemAsync).not.toHaveBeenCalled();
	});

	it("clears both tokens", async () => {
		const provider = new SecureStoreTokenProvider({ canReadRefreshToken: (): boolean => true });
		await provider.saveTokens(PAIR);

		await provider.clearTokens();

		expect(memorySecureStore.peek("auth.accessToken")).toBeNull();
		expect(memorySecureStore.peek("auth.refreshToken")).toBeNull();
	});

	it("reads a corrupt stored token as signed out", async () => {
		memorySecureStore.seed("auth.accessToken", JSON.stringify(""));
		const provider = new SecureStoreTokenProvider({ canReadRefreshToken: (): boolean => true });

		await expect(provider.getAccessToken()).resolves.toBeNull();
	});
});
