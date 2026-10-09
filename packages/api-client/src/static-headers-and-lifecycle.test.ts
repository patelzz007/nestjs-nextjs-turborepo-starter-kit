// Static client headers (`ApiClientConfig.headers`, e.g. the mobile device
// headers) and the token transport's lifecycle calls (sign out / sign out
// everywhere with the refresh token in the body, ADR 029). Only `fetch` is
// stubbed; config, pipeline and refresh are the real ones.
import { apiContract, APP_VERSION_HEADER, CLIENT_TYPE_HEADER, DataValueSchema, singleResponse, type DataValue } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createApiClientContext, InvalidApiClientConfigError } from "./config";
import { AUTHORIZATION_HEADER, buildUrl } from "./http";
import { fetchBodyTokenLifecycleMutation, fetchQueryOrThrow, TokenTransportRequiredError } from "./request";
import { apiRouter, defineQuery } from "./router";
import { fetchCalls, firstFetchCall, headersOf, inputUrl, jsonResponse, MemoryTokenProvider, rotatedTokensBody, type FetchImpl } from "./testing";

const BASE_URL = "http://api.test";
const APP_VERSION = "1.4.0";
const META = { correlationId: "corr-1", timestamp: 1_790_812_800_000 };
const PAIR = { accessToken: "access-1", refreshToken: "refresh-1" };
const ROTATED = { accessToken: "access-2", refreshToken: "refresh-2" };
const DEVICE_HEADERS = { "X-Device-Model": "iPhone%2015%20Pro", "X-Device-Name": "Alex%E2%80%99s%20iPhone" };
const REFRESH_URL: string = buildUrl(BASE_URL, apiContract.auth.refresh.path, apiContract.auth.refresh.version);
const LOGOUT_URL: string = buildUrl(BASE_URL, apiContract.auth.logout.path, apiContract.auth.logout.version);

const meDef = defineQuery({ method: "GET", path: "/auth/me", input: z.undefined(), response: singleResponse(DataValueSchema) }, { scope: () => ["auth", "me"] });

function successEnvelope(data: DataValue): DataValue {
	return { success: true, data, meta: META };
}

function stubFetch(impl: FetchImpl): ReturnType<typeof vi.fn<FetchImpl>> {
	const fetchMock = vi.fn<FetchImpl>(impl);
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

function mobileContext(tokens: MemoryTokenProvider, headers: Record<string, string> = DEVICE_HEADERS): ReturnType<typeof createApiClientContext> {
	return createApiClientContext({
		baseUrl: BASE_URL,
		clientType: "mobile",
		transport: { kind: "token", tokenProvider: tokens },
		appVersion: APP_VERSION,
		headers,
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("ApiClientConfig.headers", () => {
	it("sends the static headers with every procedure call, next to the client's own headers", async () => {
		const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(200, successEnvelope({ id: "user-1" }))));

		await fetchQueryOrThrow(mobileContext(new MemoryTokenProvider(PAIR)), meDef, undefined);

		const headers = headersOf(firstFetchCall(fetchMock).init);
		expect(headers).toMatchObject({ ...DEVICE_HEADERS, [CLIENT_TYPE_HEADER]: "mobile", [APP_VERSION_HEADER]: APP_VERSION, [AUTHORIZATION_HEADER]: "Bearer access-1" });
	});

	it("lets a per-call header of the same name win", async () => {
		const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(200, successEnvelope({ id: "user-1" }))));

		await fetchQueryOrThrow(mobileContext(new MemoryTokenProvider(PAIR)), meDef, undefined, { headers: { "X-Device-Name": "Override" } });

		expect(headersOf(firstFetchCall(fetchMock).init)["X-Device-Name"]).toBe("Override");
	});

	it("sends the static headers with the body-token refresh too", async () => {
		const fetchMock = stubFetch((input, init) => {
			if (inputUrl(input) === REFRESH_URL) {
				return Promise.resolve(jsonResponse(200, successEnvelope(rotatedTokensBody(ROTATED))));
			}
			const isRotated = headersOf(init ?? {})[AUTHORIZATION_HEADER] === "Bearer access-2";
			return Promise.resolve(isRotated ? jsonResponse(200, successEnvelope({ id: "user-1" })) : jsonResponse(401, { message: "expired" }));
		});

		await fetchQueryOrThrow(mobileContext(new MemoryTokenProvider(PAIR)), meDef, undefined);

		const refreshCall = fetchCalls(fetchMock).find((call) => inputUrl(call.input) === REFRESH_URL);
		expect(refreshCall === undefined ? {} : headersOf(refreshCall.init)).toMatchObject(DEVICE_HEADERS);
	});

	it.each([
		["Authorization", { Authorization: "Bearer x" }],
		["X-Client-Type in another case", { "x-client-type": "web" }],
		["X-App-Version", { "X-App-Version": "9.9.9" }],
		["Cookie", { Cookie: "a=b" }],
		["a header name that is not a token", { "Bad Header": "x" }],
		["a non-ASCII value (must be percent-encoded first)", { "X-Device-Name": "Alex’s iPhone" }],
	])("rejects %s", (_what, headers) => {
		expect(() => mobileContext(new MemoryTokenProvider(PAIR), headers)).toThrow(InvalidApiClientConfigError);
	});
});

describe("fetchBodyTokenLifecycleMutation", () => {
	it("presents the stored refresh token in the body, without a bearer token, cookies or a refresh", async () => {
		const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(201, successEnvelope({ message: "Logged out successfully" }))));
		const tokens = new MemoryTokenProvider(PAIR);

		const response = await fetchBodyTokenLifecycleMutation(mobileContext(tokens), apiRouter.auth.logout);

		expect(response.ok).toBe(true);
		const call = firstFetchCall(fetchMock);
		expect(inputUrl(call.input)).toBe(LOGOUT_URL);
		expect(call.init.body).toBe(JSON.stringify({ refreshToken: "refresh-1" }));
		expect(call.init.credentials).toBe("omit");
		const headers = headersOf(call.init);
		expect(headers[AUTHORIZATION_HEADER]).toBeUndefined();
		expect(headers).toMatchObject({ ...DEVICE_HEADERS, [CLIENT_TYPE_HEADER]: "mobile", [APP_VERSION_HEADER]: APP_VERSION });
		expect(tokens.clearCount).toBe(0);
	});

	it("returns a refused call as-is: no refresh, no session end", async () => {
		const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(401, { success: false, error: { code: "REFRESH_TOKEN_INVALID", message: "invalid" }, meta: META })));
		const tokens = new MemoryTokenProvider(PAIR);

		const response = await fetchBodyTokenLifecycleMutation(mobileContext(tokens), apiRouter.auth.logoutAll);

		expect(response.ok).toBe(false);
		expect(response.status).toBe(401);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(tokens.clearCount).toBe(0);
	});

	it("sends an empty body when no refresh token is stored", async () => {
		const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(201, successEnvelope({ message: "Logged out successfully" }))));

		await fetchBodyTokenLifecycleMutation(mobileContext(new MemoryTokenProvider(null)), apiRouter.auth.logout);

		expect(firstFetchCall(fetchMock).init.body).toBe(JSON.stringify({}));
	});

	it("refuses a client without the token transport", async () => {
		const cookieContext = createApiClientContext({ baseUrl: BASE_URL, clientType: "web", transport: { kind: "cookie" } });

		await expect(fetchBodyTokenLifecycleMutation(cookieContext, apiRouter.auth.logout)).rejects.toBeInstanceOf(TokenTransportRequiredError);
	});
});
