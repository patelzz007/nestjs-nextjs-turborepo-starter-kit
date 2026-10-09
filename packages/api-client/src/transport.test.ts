import { describe, expect, it, vi } from "vitest";

import { AUTHORIZATION_HEADER } from "./http";
import { MemoryTokenProvider } from "./testing";
import { COOKIE_ATTEMPT_AUTHORIZATION, createTokenRequestTransport, tokenAttemptAuthorization, type TokenRequestTransport } from "./transport";

const PAIR = { accessToken: "access-1", refreshToken: "refresh-1" };

function transportWith(tokens: MemoryTokenProvider, onSessionExpired: () => void): TokenRequestTransport {
	return createTokenRequestTransport({ baseUrl: "http://api.test", clientType: "mobile", appVersion: "1.4.0", tokenProvider: tokens, onSessionExpired });
}

describe("attempt authorization", () => {
	it("cookie attempts include the browser's cookies and add no header", () => {
		expect(COOKIE_ATTEMPT_AUTHORIZATION).toEqual({ credentials: "include", headers: {} });
	});

	it("token attempts omit cookies and carry the Bearer token when one is held", () => {
		expect(tokenAttemptAuthorization("abc")).toEqual({ credentials: "omit", headers: { [AUTHORIZATION_HEADER]: "Bearer abc" } });
		expect(tokenAttemptAuthorization(null)).toEqual({ credentials: "omit", headers: {} });
	});
});

describe("createTokenRequestTransport: endSession", () => {
	it("clears the tokens, then reports the expiry", async () => {
		const tokens = new MemoryTokenProvider(PAIR);
		const onSessionExpired = vi.fn<() => void>();

		await transportWith(tokens, onSessionExpired).endSession(PAIR.accessToken);

		expect(tokens.clearCount).toBe(1);
		expect(onSessionExpired).toHaveBeenCalledTimes(1);
		await expect(tokens.getAccessToken()).resolves.toBeNull();
	});

	it("ends a session once when several requests see it die together", async () => {
		const tokens = new MemoryTokenProvider(PAIR);
		const onSessionExpired = vi.fn<() => void>();
		const transport = transportWith(tokens, onSessionExpired);

		await Promise.all([transport.endSession(PAIR.accessToken), transport.endSession(PAIR.accessToken), transport.endSession(PAIR.accessToken)]);

		expect(tokens.clearCount).toBe(1);
		expect(onSessionExpired).toHaveBeenCalledTimes(1);
	});

	it("leaves a newer session alone (the request carried a token that is no longer stored)", async () => {
		const tokens = new MemoryTokenProvider({ accessToken: "access-after-sign-in", refreshToken: "refresh-after-sign-in" });
		const onSessionExpired = vi.fn<() => void>();

		await transportWith(tokens, onSessionExpired).endSession(PAIR.accessToken);

		expect(tokens.clearCount).toBe(0);
		expect(onSessionExpired).not.toHaveBeenCalled();
	});

	it("does nothing for a request sent without an access token", async () => {
		const tokens = new MemoryTokenProvider();
		const onSessionExpired = vi.fn<() => void>();

		await transportWith(tokens, onSessionExpired).endSession(null);

		expect(tokens.clearCount).toBe(0);
		expect(onSessionExpired).not.toHaveBeenCalled();
	});
});
