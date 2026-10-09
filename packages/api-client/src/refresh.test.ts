import { apiContract, REFRESH_TOKEN_MAX_LENGTH } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BodyTokenPair } from "./body-token-contract";
import { buildUrl } from "./http";
import { createBodyTokenRefresh, createSingleFlightRefresh, type RefreshCall, type RefreshResult } from "./refresh";
import { firstFetchCall, inputUrl, jsonResponse, MemoryTokenProvider, rotatedTokensBody, type FetchImpl } from "./testing";

const BASE_URL = "http://api.test";
const PAIR: BodyTokenPair = { accessToken: "access-1", refreshToken: "refresh-1" };
const ROTATED: BodyTokenPair = { accessToken: "access-2", refreshToken: "refresh-2" };
const META = { correlationId: "corr-1", timestamp: 1_790_812_800_000 };

function bodyTokenRefresh(tokens: MemoryTokenProvider): RefreshCall {
	return createBodyTokenRefresh({ baseUrl: BASE_URL, clientType: "mobile", appVersion: "1.4.0", tokenProvider: tokens });
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("createSingleFlightRefresh", () => {
	it("runs one refresh for concurrent callers and hands every caller its result", async () => {
		let finish: (result: RefreshResult) => void = () => undefined;
		const underlying = vi.fn<RefreshCall>(
			() =>
				new Promise<RefreshResult>((resolve) => {
					finish = resolve;
				}),
		);
		const refresh = createSingleFlightRefresh(underlying);

		const callers = Promise.all([refresh(), refresh(), refresh()]);
		finish("ok");

		await expect(callers).resolves.toEqual(["ok", "ok", "ok"]);
		expect(underlying).toHaveBeenCalledTimes(1);
	});

	it("starts a new refresh once the previous one settled, even after a rejection", async () => {
		const underlying = vi.fn<RefreshCall>().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce("expired");
		const refresh = createSingleFlightRefresh(underlying);

		await expect(refresh()).rejects.toThrow("boom");
		await expect(refresh()).resolves.toBe("expired");
		expect(underlying).toHaveBeenCalledTimes(2);
	});
});

describe("createBodyTokenRefresh", () => {
	it("posts the stored refresh token to the shared contract's refresh route and saves the rotated pair", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, { success: true, data: rotatedTokensBody(ROTATED), meta: META }));
		vi.stubGlobal("fetch", fetchMock);
		const tokens = new MemoryTokenProvider(PAIR);

		await expect(bodyTokenRefresh(tokens)()).resolves.toBe("ok");

		const { input, init } = firstFetchCall(fetchMock);
		expect(inputUrl(input)).toBe(buildUrl(BASE_URL, apiContract.auth.refresh.path, apiContract.auth.refresh.version));
		expect(init.body).toBe(JSON.stringify({ refreshToken: PAIR.refreshToken }));
		expect(tokens.savedPairs).toEqual([ROTATED]);
	});

	it("is expired without calling the API when no refresh token is stored", async () => {
		const fetchMock = vi.fn<FetchImpl>();
		vi.stubGlobal("fetch", fetchMock);

		await expect(bodyTokenRefresh(new MemoryTokenProvider())()).resolves.toBe("expired");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("is expired without calling the API when the stored refresh token is malformed", async () => {
		const fetchMock = vi.fn<FetchImpl>();
		vi.stubGlobal("fetch", fetchMock);

		await expect(bodyTokenRefresh(new MemoryTokenProvider({ accessToken: "access-1", refreshToken: "" }))()).resolves.toBe("expired");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it.each([
		[401, "expired"],
		[403, "expired"],
		[429, "transient"],
		[426, "transient"],
		[500, "transient"],
	])("maps an HTTP %i answer to %s", async (status, expected) => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(status, { success: false, error: { code: "X", message: "x" }, meta: META })));
		const tokens = new MemoryTokenProvider(PAIR);

		await expect(bodyTokenRefresh(tokens)()).resolves.toBe(expected);
		expect(tokens.savedPairs).toEqual([]);
	});

	it("is transient when the API is unreachable", async () => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockRejectedValue(new TypeError("Network request failed")));

		await expect(bodyTokenRefresh(new MemoryTokenProvider(PAIR))()).resolves.toBe("transient");
	});

	it("is transient when the stored refresh token cannot be read", async () => {
		const fetchMock = vi.fn<FetchImpl>();
		vi.stubGlobal("fetch", fetchMock);
		const tokens = new MemoryTokenProvider(PAIR);
		vi.spyOn(tokens, "getRefreshToken").mockRejectedValue(new Error("keychain locked"));

		await expect(bodyTokenRefresh(tokens)()).resolves.toBe("transient");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("is expired when the rotated pair cannot be saved (the old token is already spent)", async () => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, { success: true, data: rotatedTokensBody(ROTATED), meta: META })));
		const tokens = new MemoryTokenProvider(PAIR);
		vi.spyOn(tokens, "saveTokens").mockRejectedValue(new Error("keychain full"));

		await expect(bodyTokenRefresh(tokens)()).resolves.toBe("expired");
	});

	it("is expired without calling the API when the stored refresh token is longer than the shared bound", async () => {
		const fetchMock = vi.fn<FetchImpl>();
		vi.stubGlobal("fetch", fetchMock);

		await expect(bodyTokenRefresh(new MemoryTokenProvider({ accessToken: "access-1", refreshToken: "r".repeat(REFRESH_TOKEN_MAX_LENGTH + 1) }))()).resolves.toBe("expired");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("is expired when the 2xx body lacks the body-transport marker (a browser-shaped answer carries no tokens)", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, { success: true, data: { message: "Tokens refreshed successfully", ...ROTATED }, meta: META })),
		);
		const tokens = new MemoryTokenProvider(PAIR);

		await expect(bodyTokenRefresh(tokens)()).resolves.toBe("expired");
		expect(tokens.savedPairs).toEqual([]);
	});

	it("is expired when the rotated refresh token is longer than the shared bound", async () => {
		const oversized: BodyTokenPair = { accessToken: "access-2", refreshToken: "r".repeat(REFRESH_TOKEN_MAX_LENGTH + 1) };
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, { success: true, data: rotatedTokensBody(oversized), meta: META })));
		const tokens = new MemoryTokenProvider(PAIR);

		await expect(bodyTokenRefresh(tokens)()).resolves.toBe("expired");
		expect(tokens.savedPairs).toEqual([]);
	});

	it("is expired when the 2xx body is not JSON", async () => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockResolvedValue(new Response("<html>", { status: 200 })));

		await expect(bodyTokenRefresh(new MemoryTokenProvider(PAIR))()).resolves.toBe("expired");
	});
});
