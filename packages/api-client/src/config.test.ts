import { APP_VERSION_MAX_LENGTH, DataValueSchema, singleResponse } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiClientConfigSchema, createApiClientContext, InvalidApiClientConfigError, type ApiClientConfig } from "./config";
import { AUTHORIZATION_HEADER } from "./http";
import type { RefreshResult } from "./refresh";
import { fetchQuery } from "./request";
import { defineQuery } from "./router";
import { firstFetchCall, headersOf, jsonResponse, MemoryTokenProvider, type FetchImpl } from "./testing";

const BASE_URL = "http://api.test";
const SECRET_LOOKING_BASE_URL = "not a url, token=s3cr3t";

const meDef = defineQuery({ method: "GET", path: "/auth/me", input: z.undefined(), response: singleResponse(DataValueSchema) }, { scope: () => ["auth", "me"] });

const BROWSER_CLIENT_TYPES: readonly ["web", "admin", "merchant"] = ["web", "admin", "merchant"];

const MOBILE_CONFIG: ApiClientConfig = {
	baseUrl: BASE_URL,
	clientType: "mobile",
	transport: { kind: "token", tokenProvider: new MemoryTokenProvider() },
	appVersion: "1.4.0",
};

/** The issues of a config `createApiClientContext` must reject. */
function rejectionOf(config: ApiClientConfig): InvalidApiClientConfigError {
	try {
		createApiClientContext(config);
	} catch (error) {
		if (error instanceof InvalidApiClientConfigError) {
			return error;
		}
		throw error;
	}
	throw new Error("the config was accepted");
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("createApiClientContext: valid configs", () => {
	it.each(BROWSER_CLIENT_TYPES)("builds a cookie-transport context for the %s client type", (clientType) => {
		const context = createApiClientContext({ baseUrl: BASE_URL, clientType, transport: { kind: "cookie" } });

		expect(context).toMatchObject({ baseUrl: BASE_URL, clientType, transport: { kind: "cookie" } });
		expect(context.appVersion).toBeUndefined();
	});

	it("wires the cookie transport's refresh and session-expired callbacks into the 401 pipeline", async () => {
		const refreshSession = vi.fn((): Promise<RefreshResult> => Promise.resolve("expired"));
		const onSessionExpired = vi.fn<() => void>();
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(401, { message: "Unauthorized" }));
		vi.stubGlobal("fetch", fetchMock);

		const context = createApiClientContext({ baseUrl: BASE_URL, clientType: "web", transport: { kind: "cookie", refreshSession }, onSessionExpired });
		const result = await fetchQuery(context, meDef, undefined);

		expect(result.kind).toBe("unauthorized");
		expect(refreshSession).toHaveBeenCalledTimes(1);
		expect(onSessionExpired).toHaveBeenCalledTimes(1);
		const { init } = firstFetchCall(fetchMock);
		expect(init.credentials).toBe("include");
		expect(headersOf(init)).not.toHaveProperty(AUTHORIZATION_HEADER);
	});

	it("builds a token-transport context with the app version for the mobile client type", () => {
		const context = createApiClientContext(MOBILE_CONFIG);

		expect(context).toMatchObject({ baseUrl: BASE_URL, clientType: "mobile", appVersion: "1.4.0", transport: { kind: "token" } });
	});

	it("keeps the injected token provider itself (a class instance keeps its methods)", () => {
		const tokens = new MemoryTokenProvider();
		const context = createApiClientContext({ ...MOBILE_CONFIG, transport: { kind: "token", tokenProvider: tokens } });

		expect(context.transport?.kind === "token" ? context.transport.tokenProvider : undefined).toBe(tokens);
	});

	it("drops a trailing slash from the base URL", () => {
		expect(createApiClientContext({ baseUrl: `${BASE_URL}/`, clientType: "web", transport: { kind: "cookie" } }).baseUrl).toBe(BASE_URL);
	});
});

describe("createApiClientContext: rejected configs", () => {
	it("rejects the mobile client type on the cookie transport", () => {
		expect(rejectionOf({ baseUrl: BASE_URL, clientType: "mobile", transport: { kind: "cookie" }, appVersion: "1.4.0" }).issues).toEqual([
			{ path: "transport", message: "the mobile client type uses the token transport (ADR 029)" },
		]);
	});

	it("rejects a browser client type on the token transport", () => {
		expect(rejectionOf({ baseUrl: BASE_URL, clientType: "web", transport: { kind: "token", tokenProvider: new MemoryTokenProvider() } }).issues).toEqual([
			{ path: "transport", message: "browser client types use the cookie transport (ADR 029)" },
		]);
	});

	it("requires the app version for the mobile client type", () => {
		expect(rejectionOf({ baseUrl: BASE_URL, clientType: "mobile", transport: { kind: "token", tokenProvider: new MemoryTokenProvider() } }).issues).toEqual([
			{ path: "appVersion", message: "the mobile client type must send its app version (ADR 033)" },
		]);
	});

	it("rejects an app version on a browser client type", () => {
		expect(rejectionOf({ baseUrl: BASE_URL, clientType: "admin", transport: { kind: "cookie" }, appVersion: "1.4.0" }).issues).toEqual([
			{ path: "appVersion", message: "only the mobile client type sends an app version (ADR 033)" },
		]);
	});

	it("rejects a malformed app version", () => {
		expect(rejectionOf({ ...MOBILE_CONFIG, appVersion: "v1" }).issues.map((issue) => issue.path)).toEqual(["appVersion"]);
	});

	it("rejects a base URL that is not an absolute http(s) URL, without echoing the value", () => {
		const rejection = rejectionOf({ baseUrl: SECRET_LOOKING_BASE_URL, clientType: "web", transport: { kind: "cookie" } });

		expect(rejection.issues.map((issue) => issue.path)).toEqual(["baseUrl"]);
		expect(rejection.message).not.toContain("s3cr3t");
	});
});

describe("ApiClientConfigSchema: shapes the types already rule out (a JavaScript caller, a config read at runtime)", () => {
	/** The dotted paths of every issue the schema reports for `input`. */
	function issuePaths(input: object): string[] {
		const result = ApiClientConfigSchema.safeParse(input);
		return result.success ? [] : result.error.issues.map((issue) => issue.path.map(String).join("."));
	}

	it("rejects an unknown client type", () => {
		expect(issuePaths({ baseUrl: BASE_URL, clientType: "kiosk", transport: { kind: "cookie" } })).toContain("clientType");
	});

	it("rejects a token provider that lacks a method", () => {
		const incomplete = {
			getAccessToken: (): Promise<string | null> => Promise.resolve(null),
			getRefreshToken: (): Promise<string | null> => Promise.resolve(null),
			saveTokens: (): Promise<void> => Promise.resolve(),
		};

		expect(issuePaths({ ...MOBILE_CONFIG, transport: { kind: "token", tokenProvider: incomplete } })).toEqual(["transport.tokenProvider"]);
	});

	it("rejects an unknown key (a typo is a config error, not a silent default)", () => {
		expect(issuePaths({ ...MOBILE_CONFIG, appVerison: "1.4.0" })).toEqual([""]);
	});

	it("rejects a callback that is not a function", () => {
		expect(issuePaths({ ...MOBILE_CONFIG, onSessionExpired: "signIn" })).toEqual(["onSessionExpired"]);
	});
});

describe("the mobile app version (the shared AppVersionSchema the API checks)", () => {
	it.each(["1.0.0", "0.9.12", "2.0.0-beta.1", "1.4.0+42"])("accepts %s", (version) => {
		expect(ApiClientConfigSchema.safeParse({ ...MOBILE_CONFIG, appVersion: version }).success).toBe(true);
	});

	it.each(["", "1", "1.0", "01.0.0", "v1.0.0", "1.0.0.0", "1.0.0-01", `1.0.0-${"a".repeat(APP_VERSION_MAX_LENGTH)}`])("rejects %j", (version) => {
		const result = ApiClientConfigSchema.safeParse({ ...MOBILE_CONFIG, appVersion: version });
		expect(result.error?.issues.map((issue) => issue.path.map(String).join("."))).toEqual(["appVersion"]);
	});
});
