// The token transport end to end (ADR 029 / ADR 033): only `fetch` is stubbed;
// the request pipeline, the single-flight body-token refresh and the session
// end are the real ones, built from the injected config.
import {
	apiContract,
	APP_VERSION_HEADER,
	CLIENT_TYPE_HEADER,
	DataValueSchema,
	LIST_SLOT_INDEX,
	MUTATION_INTENT_HEADER,
	MUTATION_INTENT_VALUE,
	singleResponse,
	type DataValue,
} from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createApiClientContext } from "./config";
import { UpgradeRequiredError } from "./errors";
import { AUTHORIZATION_HEADER, buildUrl } from "./http";
import { fetchMutationOrThrow, fetchQuery, fetchQueryOrThrow, type ApiRequestContext } from "./request";
import { defineMutation, defineQuery } from "./router";
import { fetchCalls, headersOf, inputUrl, jsonResponse, MemoryTokenProvider, rotatedTokensBody, type FetchCall, type FetchImpl } from "./testing";

const BASE_URL = "http://api.test";
const APP_VERSION = "1.4.0";
const META = { correlationId: "corr-1", timestamp: 1_790_812_800_000 };
const PROFILE = { id: "user-1" };
const OLD_PAIR = { accessToken: "access-old", refreshToken: "refresh-old" };
const NEW_PAIR = { accessToken: "access-new", refreshToken: "refresh-new" };
const REFRESH_URL: string = buildUrl(BASE_URL, apiContract.auth.refresh.path, apiContract.auth.refresh.version);

const meDef = defineQuery({ method: "GET", path: "/auth/me", input: z.undefined(), response: singleResponse(DataValueSchema) }, { scope: () => ["auth", "me"] });
const renameDef = defineMutation({ method: "PATCH", path: "/auth/profile", input: z.object({ name: z.string() }), response: singleResponse(DataValueSchema) });

function successEnvelope(data: DataValue): DataValue {
	return { success: true, data, meta: META };
}

function errorEnvelope(code: string, message: string): DataValue {
	return { success: false, error: { code, message }, meta: META };
}

interface TokenClient {
	readonly context: ApiRequestContext;
	readonly tokens: MemoryTokenProvider;
	readonly onSessionExpired: ReturnType<typeof vi.fn<() => void>>;
}

function tokenClient(initialPair: { readonly accessToken: string; readonly refreshToken: string } | null = OLD_PAIR): TokenClient {
	const tokens = new MemoryTokenProvider(initialPair === null ? null : { ...initialPair });
	const onSessionExpired = vi.fn<() => void>();
	const context = createApiClientContext({
		baseUrl: BASE_URL,
		clientType: "mobile",
		transport: { kind: "token", tokenProvider: tokens },
		appVersion: APP_VERSION,
		onSessionExpired,
	});
	return { context, tokens, onSessionExpired };
}

/** `fetch` that answers the refresh route with `refresh` and every other route with `api`. */
function stubFetch(routes: { readonly api: FetchImpl; readonly refresh?: FetchImpl }): ReturnType<typeof vi.fn<FetchImpl>> {
	const fetchMock = vi.fn<FetchImpl>((input, init) => {
		if (inputUrl(input) === REFRESH_URL) {
			return routes.refresh === undefined ? Promise.reject(new Error("unexpected refresh")) : routes.refresh(input, init);
		}
		return routes.api(input, init);
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

/** The API: 200 for the current access token, 401 for any other (an expired token). */
function apiAccepting(accessToken: string): FetchImpl {
	return (_input, init) =>
		Promise.resolve(
			headersOf(init ?? {})[AUTHORIZATION_HEADER] === `Bearer ${accessToken}`
				? jsonResponse(200, successEnvelope(PROFILE))
				: jsonResponse(401, errorEnvelope("ACCESS_TOKEN_EXPIRED", "Access token has expired")),
		);
}

function refreshAnswering(status: number, body: DataValue): FetchImpl {
	return () => Promise.resolve(jsonResponse(status, body));
}

function refreshCalls(fetchMock: ReturnType<typeof vi.fn<FetchImpl>>): FetchCall[] {
	return fetchCalls(fetchMock).filter((call) => inputUrl(call.input) === REFRESH_URL);
}

function apiCalls(fetchMock: ReturnType<typeof vi.fn<FetchImpl>>): FetchCall[] {
	return fetchCalls(fetchMock).filter((call) => inputUrl(call.input) !== REFRESH_URL);
}

/** Lets every queued promise callback run (a macrotask turn). */
function settle(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("token transport: headers", () => {
	it("sends the access token as a Bearer header, the mobile client type, the app version, and never cookies", async () => {
		const fetchMock = stubFetch({ api: apiAccepting(OLD_PAIR.accessToken) });
		const { context } = tokenClient();

		await expect(fetchQueryOrThrow(context, meDef, undefined)).resolves.toEqual(successEnvelope(PROFILE));

		const [call] = apiCalls(fetchMock);
		expect(call?.init.credentials).toBe("omit");
		expect(headersOf(call?.init ?? {})).toEqual({
			Accept: "application/json",
			[AUTHORIZATION_HEADER]: `Bearer ${OLD_PAIR.accessToken}`,
			[CLIENT_TYPE_HEADER]: "mobile",
			[APP_VERSION_HEADER]: APP_VERSION,
			[MUTATION_INTENT_HEADER]: MUTATION_INTENT_VALUE,
		});
	});

	it("sends a mutation's JSON body with the same auth headers", async () => {
		const fetchMock = stubFetch({ api: apiAccepting(OLD_PAIR.accessToken) });
		const { context } = tokenClient();

		await fetchMutationOrThrow(context, renameDef, { name: "Sam" });

		const [call] = apiCalls(fetchMock);
		expect(call?.init.method).toBe("PATCH");
		expect(call?.init.body).toBe(JSON.stringify({ name: "Sam" }));
		expect(headersOf(call?.init ?? {})).toMatchObject({ [AUTHORIZATION_HEADER]: `Bearer ${OLD_PAIR.accessToken}`, "Content-Type": "application/json" });
	});

	it("sends no Authorization header while signed out, and returns a 401 as the API's answer (no refresh, no session end)", async () => {
		const fetchMock = stubFetch({ api: () => Promise.resolve(jsonResponse(401, errorEnvelope("INVALID_CREDENTIALS", "Invalid email or password"))) });
		const { context, tokens, onSessionExpired } = tokenClient(null);

		const result = await fetchQuery(context, meDef, undefined);

		expect(result).toMatchObject({ kind: "httpError", status: 401 });
		expect(headersOf(apiCalls(fetchMock)[LIST_SLOT_INDEX.first]?.init ?? {})).not.toHaveProperty(AUTHORIZATION_HEADER);
		expect(refreshCalls(fetchMock)).toHaveLength(0);
		expect(tokens.clearCount).toBe(0);
		expect(onSessionExpired).not.toHaveBeenCalled();
	});
});

describe("token transport: refresh on 401", () => {
	it("refreshes once with the refresh token in the body, saves the rotated pair, and retries with the new access token", async () => {
		const fetchMock = stubFetch({ api: apiAccepting(NEW_PAIR.accessToken), refresh: refreshAnswering(200, successEnvelope(rotatedTokensBody(NEW_PAIR))) });
		const { context, tokens, onSessionExpired } = tokenClient();

		await expect(fetchQueryOrThrow(context, meDef, undefined)).resolves.toEqual(successEnvelope(PROFILE));

		const [refresh] = refreshCalls(fetchMock);
		expect(refresh?.init.method).toBe("POST");
		expect(refresh?.init.credentials).toBe("omit");
		expect(refresh?.init.body).toBe(JSON.stringify({ refreshToken: OLD_PAIR.refreshToken }));
		expect(headersOf(refresh?.init ?? {})).toMatchObject({ [CLIENT_TYPE_HEADER]: "mobile", [APP_VERSION_HEADER]: APP_VERSION, "Content-Type": "application/json" });
		expect(headersOf(refresh?.init ?? {})).not.toHaveProperty(AUTHORIZATION_HEADER);
		expect(tokens.savedPairs).toEqual([NEW_PAIR]);
		expect(apiCalls(fetchMock).map((call) => headersOf(call.init)[AUTHORIZATION_HEADER])).toEqual([`Bearer ${OLD_PAIR.accessToken}`, `Bearer ${NEW_PAIR.accessToken}`]);
		expect(onSessionExpired).not.toHaveBeenCalled();
	});

	it("shares ONE refresh between concurrent 401s and retries each waiting request exactly once", async () => {
		let releaseRefresh: () => void = () => undefined;
		const refreshGate = new Promise<void>((resolve) => {
			releaseRefresh = resolve;
		});
		const fetchMock = stubFetch({
			api: apiAccepting(NEW_PAIR.accessToken),
			refresh: async () => {
				await refreshGate;
				return jsonResponse(200, successEnvelope(rotatedTokensBody(NEW_PAIR)));
			},
		});
		const { context, tokens } = tokenClient();
		const CONCURRENT_REQUESTS = 3;

		const pending = Promise.all(Array.from({ length: CONCURRENT_REQUESTS }, () => fetchQueryOrThrow(context, meDef, undefined)));
		await vi.waitFor(() => {
			expect(refreshCalls(fetchMock)).toHaveLength(1);
		});
		await settle();
		releaseRefresh();

		await expect(pending).resolves.toEqual(Array.from({ length: CONCURRENT_REQUESTS }, () => successEnvelope(PROFILE)));
		expect(refreshCalls(fetchMock)).toHaveLength(1);
		expect(tokens.savedPairs).toEqual([NEW_PAIR]);
		// Each request: the first attempt with the old token, ONE retry with the new one.
		expect(apiCalls(fetchMock)).toHaveLength(CONCURRENT_REQUESTS * 2);
	});

	it("starts a fresh refresh for a later 401 once the previous one has settled", async () => {
		const fetchMock = stubFetch({ api: apiAccepting(NEW_PAIR.accessToken), refresh: refreshAnswering(200, successEnvelope(rotatedTokensBody(NEW_PAIR))) });
		const { context, tokens } = tokenClient();

		await fetchQueryOrThrow(context, meDef, undefined);
		await tokens.saveTokens({ accessToken: "access-stale", refreshToken: NEW_PAIR.refreshToken });
		await fetchQueryOrThrow(context, meDef, undefined);

		expect(refreshCalls(fetchMock)).toHaveLength(2);
	});
});

describe("token transport: the session ends", () => {
	it("clears the tokens and reports the expiry ONCE when the refresh is refused, however many requests were waiting", async () => {
		const fetchMock = stubFetch({ api: apiAccepting(NEW_PAIR.accessToken), refresh: refreshAnswering(401, errorEnvelope("REFRESH_TOKEN_EXPIRED", "Refresh token expired")) });
		const { context, tokens, onSessionExpired } = tokenClient();

		const results = await Promise.all([fetchQuery(context, meDef, undefined), fetchQuery(context, meDef, undefined)]);

		expect(results.map((result) => result.kind)).toEqual(["unauthorized", "unauthorized"]);
		expect(refreshCalls(fetchMock)).toHaveLength(1);
		expect(tokens.clearCount).toBe(1);
		expect(onSessionExpired).toHaveBeenCalledTimes(1);
		await expect(tokens.getRefreshToken()).resolves.toBeNull();
	});

	it("treats a 403 from the refresh (reused or revoked token) as a dead session", async () => {
		stubFetch({ api: apiAccepting(NEW_PAIR.accessToken), refresh: refreshAnswering(403, errorEnvelope("TOKEN_THEFT_DETECTED", "Refresh token reuse")) });
		const { context, onSessionExpired } = tokenClient();

		await expect(fetchQuery(context, meDef, undefined)).resolves.toMatchObject({ kind: "unauthorized" });
		expect(onSessionExpired).toHaveBeenCalledTimes(1);
	});

	it("surfaces a retried request that is refused again as an error and never retries it in a loop", async () => {
		const fetchMock = stubFetch({
			api: () => Promise.resolve(jsonResponse(401, errorEnvelope("ACCESS_TOKEN_EXPIRED", "Access token has expired"))),
			refresh: refreshAnswering(200, successEnvelope(rotatedTokensBody(NEW_PAIR))),
		});
		const { context, tokens, onSessionExpired } = tokenClient();

		await expect(fetchQuery(context, meDef, undefined)).resolves.toMatchObject({ kind: "unauthorized", status: 401 });
		expect(apiCalls(fetchMock)).toHaveLength(2);
		expect(refreshCalls(fetchMock)).toHaveLength(1);
		expect(tokens.clearCount).toBe(1);
		expect(onSessionExpired).toHaveBeenCalledTimes(1);
	});

	it("ends the session without refreshing when the 401 says the session was revoked", async () => {
		const fetchMock = stubFetch({ api: () => Promise.resolve(jsonResponse(401, errorEnvelope("TOKEN_VERSION_MISMATCH", "Token revoked"))) });
		const { context, tokens, onSessionExpired } = tokenClient();

		await expect(fetchQuery(context, meDef, undefined)).resolves.toMatchObject({ kind: "unauthorized" });
		expect(refreshCalls(fetchMock)).toHaveLength(0);
		expect(tokens.clearCount).toBe(1);
		expect(onSessionExpired).toHaveBeenCalledTimes(1);
	});

	it("ends the session when the refresh answers 2xx without the rotated pair (the old token is already spent)", async () => {
		stubFetch({ api: apiAccepting(NEW_PAIR.accessToken), refresh: refreshAnswering(200, successEnvelope({ message: "Token refreshed" })) });
		const { context, tokens, onSessionExpired } = tokenClient();

		await expect(fetchQuery(context, meDef, undefined)).resolves.toMatchObject({ kind: "unauthorized" });
		expect(tokens.savedPairs).toEqual([]);
		expect(tokens.clearCount).toBe(1);
		expect(onSessionExpired).toHaveBeenCalledTimes(1);
	});
});

describe("token transport: a refresh with no verdict", () => {
	it.each([
		["a 5xx answer", (): Promise<Response> => Promise.resolve(jsonResponse(503, errorEnvelope("SERVICE_UNAVAILABLE", "Down")))],
		["an unreachable API", (): Promise<Response> => Promise.reject(new TypeError("Network request failed"))],
	])("fails only the request on %s and keeps the session", async (_what, refresh) => {
		stubFetch({ api: apiAccepting(NEW_PAIR.accessToken), refresh });
		const { context, tokens, onSessionExpired } = tokenClient();

		await expect(fetchQuery(context, meDef, undefined)).resolves.toMatchObject({ kind: "sessionUnavailable", status: 401 });
		expect(tokens.clearCount).toBe(0);
		await expect(tokens.getRefreshToken()).resolves.toBe(OLD_PAIR.refreshToken);
		expect(onSessionExpired).not.toHaveBeenCalled();
	});

	it("does not re-hit an unreachable API inside the cooldown", async () => {
		const fetchMock = stubFetch({ api: apiAccepting(NEW_PAIR.accessToken), refresh: () => Promise.reject(new TypeError("Network request failed")) });
		const { context } = tokenClient();

		await fetchQuery(context, meDef, undefined);
		await fetchQuery(context, meDef, undefined);

		expect(refreshCalls(fetchMock)).toHaveLength(1);
	});
});

describe("token transport: 426 Upgrade Required (ADR 033)", () => {
	const upgradeAnswer: FetchImpl = () => Promise.resolve(jsonResponse(426, errorEnvelope("APP_VERSION_UNSUPPORTED", "Please update the app")));

	it("throws a typed UpgradeRequiredError and never refreshes or retries", async () => {
		const fetchMock = stubFetch({ api: upgradeAnswer, refresh: refreshAnswering(200, successEnvelope(rotatedTokensBody(NEW_PAIR))) });
		const { context, tokens, onSessionExpired } = tokenClient();

		const failure = fetchQueryOrThrow(context, meDef, undefined);

		await expect(failure).rejects.toBeInstanceOf(UpgradeRequiredError);
		await expect(failure).rejects.toMatchObject({ code: "APP_VERSION_UNSUPPORTED", statusCode: 426, correlationId: META.correlationId });
		expect(apiCalls(fetchMock)).toHaveLength(1);
		expect(refreshCalls(fetchMock)).toHaveLength(0);
		expect(tokens.clearCount).toBe(0);
		expect(onSessionExpired).not.toHaveBeenCalled();
	});

	it("reports the 426 in the response envelope of .fetch()", async () => {
		stubFetch({ api: upgradeAnswer });
		const { context } = tokenClient();

		const result = await fetchQuery(context, meDef, undefined);

		expect(result).toMatchObject({ kind: "httpError", status: 426 });
		expect(result.ok ? undefined : result.error).toBeInstanceOf(UpgradeRequiredError);
	});
});
