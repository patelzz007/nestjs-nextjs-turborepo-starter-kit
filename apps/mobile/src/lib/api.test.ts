import { apiRouter, fetchBodyTokenLifecycleMutation, fetchQueryOrThrow, InvalidApiClientConfigError } from "@workspace/api-client";

import { ok, stubApi } from "../../test/api-stub";
import { userJson } from "../../test/fixtures";
import { createMobileApiClient } from "./api";
import { SecureStoreTokenProvider } from "./secure-store-token-provider";

const DEVICE_HEADERS = { "X-Device-Model": "iPhone%2015%20Pro" };

function client(onSessionExpired = jest.fn()): ReturnType<typeof createMobileApiClient> {
	return createMobileApiClient({
		baseUrl: "http://api.test",
		appVersion: "1.2.3",
		deviceHeaders: DEVICE_HEADERS,
		tokenProvider: new SecureStoreTokenProvider({ canReadRefreshToken: (): boolean => true }),
		onSessionExpired,
	});
}

describe("createMobileApiClient", () => {
	it("sends the mobile client type, the app version, the device headers and the bearer token", async () => {
		const api = stubApi({ "GET /auth/me": ok(userJson()) });
		const mobile = client();
		await new SecureStoreTokenProvider({ canReadRefreshToken: (): boolean => true }).saveTokens({ accessToken: "access-1", refreshToken: "refresh-1" });

		await fetchQueryOrThrow(mobile.context, apiRouter.auth.me, undefined);

		const [call] = api.callsTo("GET /auth/me");
		expect(call?.headers).toMatchObject({ "x-client-type": "mobile", "x-app-version": "1.2.3", "x-device-model": "iPhone%2015%20Pro", authorization: "Bearer access-1" });
	});

	it("signs out with the refresh token in the body (ADR 029)", async () => {
		const api = stubApi({ "POST /auth/logout": ok({ message: "Logged out successfully" }, 201) });
		const mobile = client();
		await new SecureStoreTokenProvider({ canReadRefreshToken: (): boolean => true }).saveTokens({ accessToken: "access-1", refreshToken: "refresh-1" });

		await fetchBodyTokenLifecycleMutation(mobile.context, apiRouter.auth.logout);

		expect(api.callsTo("POST /auth/logout").at(0)?.body).toBe(JSON.stringify({ refreshToken: "refresh-1" }));
	});

	it("fails at app start on a wrong config", () => {
		expect(() =>
			createMobileApiClient({
				baseUrl: "not a url",
				appVersion: "1.2.3",
				deviceHeaders: {},
				tokenProvider: new SecureStoreTokenProvider({ canReadRefreshToken: (): boolean => true }),
				onSessionExpired: jest.fn(),
			}),
		).toThrow(InvalidApiClientConfigError);
	});

	it("binds the typed router", () => {
		expect(client().api.auth.me).toHaveProperty("useQuery");
	});
});
