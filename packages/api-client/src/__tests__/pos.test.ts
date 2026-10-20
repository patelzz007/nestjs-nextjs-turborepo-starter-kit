import { describe, expect, it, vi } from "vitest";

import { AUTHORIZATION_HEADER } from "../http";
import { createPosCaller, createPosRequestContext, POS_API_KEY_HEADER, POS_TERMINAL_ID_HEADER, posCredentialHeaders, posRouter, type PosTerminalCredentials } from "../pos";
import { fetchMutation, type ApiRequestContext } from "../request";
import { firstFetchCall, headersOf, jsonResponse, MemoryTokenProvider, type FetchImpl } from "../testing";
import { createTokenRequestTransport } from "../transport";

const BASE_URL = "http://api.test";
const CREDENTIALS: PosTerminalCredentials = {
	apiKey: "pos_live_key",
	terminalId: "TERM-7F3K9QX2",
	tenantId: "2c7e9a14-5b3d-4f8e-a1c6-9d0b3e7f2a58",
	locationId: "5b1f2c4e-8a3d-4e6f-9b7a-1c2d3e4f5a6b",
};
const SESSION = { accessToken: "person-access-token", refreshToken: "person-refresh-token" };
const VALIDATE_TOKEN = "t".repeat(32);
const META = { correlationId: "corr-1", timestamp: 1_790_812_800_000 };
const PREVIEW = {
	claimId: "8f5b1c2e-3d4a-4b6c-9e7f-1a2b3c4d5e6f",
	rewardTitle: "Free coffee",
	rewardType: "FREE_ITEM",
	claimExpiresAt: 1_790_899_200_000,
	valid: true,
	invalidReason: null,
	minSpendMinor: null,
};

/** The mobile app's own context: a signed-in person on the token transport. */
function personContext(): ApiRequestContext {
	return {
		baseUrl: BASE_URL,
		clientType: "mobile",
		appVersion: "1.0.0",
		headers: { "X-Device-Model": "Pixel" },
		transport: createTokenRequestTransport({
			baseUrl: BASE_URL,
			clientType: "mobile",
			appVersion: "1.0.0",
			tokenProvider: new MemoryTokenProvider(SESSION),
			onSessionExpired: vi.fn(),
		}),
	};
}

describe("posCredentialHeaders", () => {
	it("names the API key, the terminal, and (as information) the till's tenant and store", () => {
		expect(posCredentialHeaders(CREDENTIALS)).toEqual({
			[POS_API_KEY_HEADER]: CREDENTIALS.apiKey,
			[POS_TERMINAL_ID_HEADER]: CREDENTIALS.terminalId,
			"X-Tenant-Id": CREDENTIALS.tenantId,
			"X-Location-Id": CREDENTIALS.locationId,
		});
	});
});

describe("createPosRequestContext", () => {
	it("keeps the app's address, client type, version and static headers, and adds the till's credentials", () => {
		const context = createPosRequestContext(personContext(), CREDENTIALS);

		expect(context).toMatchObject({ baseUrl: BASE_URL, clientType: "mobile", appVersion: "1.0.0", transport: { kind: "anonymous-token" } });
		expect(context.headers).toEqual({ "X-Device-Model": "Pixel", ...posCredentialHeaders(CREDENTIALS) });
	});

	it("adds no credentials before pairing", () => {
		expect(createPosRequestContext(personContext(), null).headers).toEqual({ "X-Device-Model": "Pixel" });
	});

	it("never sends the person's access token or cookies with a till call", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, { success: true, data: PREVIEW, meta: META }));
		vi.stubGlobal("fetch", fetchMock);
		try {
			const result = await fetchMutation(createPosRequestContext(personContext(), CREDENTIALS), posRouter.integration.validateRedemption, { token: VALIDATE_TOKEN });

			expect(result.ok).toBe(true);
			const { init } = firstFetchCall(fetchMock);
			const headers = headersOf(init);
			expect(headers[AUTHORIZATION_HEADER]).toBeUndefined();
			expect(headers[POS_API_KEY_HEADER]).toBe(CREDENTIALS.apiKey);
			expect(headers[POS_TERMINAL_ID_HEADER]).toBe(CREDENTIALS.terminalId);
			expect(headers["X-Tenant-Id"]).toBe(CREDENTIALS.tenantId);
			expect(headers["X-Location-Id"]).toBe(CREDENTIALS.locationId);
			expect(init.credentials).toBe("omit");
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe("posRouter", () => {
	it("binds pairing and the two redemption calls to their POST routes", () => {
		expect(posRouter.integration.pairTerminal).toMatchObject({ kind: "mutation", method: "POST" });
		expect(posRouter.integration.validateRedemption).toMatchObject({ kind: "mutation", method: "POST" });
		expect(posRouter.integration.checkoutRedemption).toMatchObject({ kind: "mutation", method: "POST" });
	});
});

describe("createPosCaller", () => {
	it("sends the till's calls with its credentials and no session", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, { success: true, data: PREVIEW, meta: META }));
		vi.stubGlobal("fetch", fetchMock);
		try {
			const envelope = await createPosCaller(personContext(), CREDENTIALS).validate.mutate({ token: VALIDATE_TOKEN });

			expect(envelope.data).toEqual(PREVIEW);
			const headers = headersOf(firstFetchCall(fetchMock).init);
			expect(headers[AUTHORIZATION_HEADER]).toBeUndefined();
			expect(headers[POS_API_KEY_HEADER]).toBe(CREDENTIALS.apiKey);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it("pairs without any credentials", async () => {
		const paired = {
			apiKey: "mk_live_x",
			terminalId: "TERM-7F3K9QX2",
			terminalName: "Front till",
			tenant: { id: "2c7e9a14-5b3d-4f8e-a1c6-9d0b3e7f2a58", slug: "acme", displayName: "Acme" },
			location: { id: PREVIEW.claimId, name: "KLCC" },
		};
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, { success: true, data: paired, meta: META }));
		vi.stubGlobal("fetch", fetchMock);
		try {
			await expect(createPosCaller(personContext(), null).pairTerminal.mutate({ pairingCode: "ABCD2345" })).resolves.toMatchObject({ data: paired });

			const headers = headersOf(firstFetchCall(fetchMock).init);
			expect(headers[POS_API_KEY_HEADER]).toBeUndefined();
			expect(headers[AUTHORIZATION_HEADER]).toBeUndefined();
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
