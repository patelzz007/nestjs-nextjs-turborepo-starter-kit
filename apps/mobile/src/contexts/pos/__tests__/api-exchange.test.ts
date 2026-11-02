import { ApiError } from "@workspace/api-client";
import { epochMs, PosTerminalIdSchema } from "@workspace/shared";

import { errorBodyOf, maskHeaderValue, prettyJson, tillRequestHeaders, checkoutExchange, validateExchange } from "../api-exchange";

const CREDENTIALS = {
	apiKey: "rk_live_1234567890abcdef",
	terminalId: PosTerminalIdSchema.parse("0193f2c4-0000-7000-8000-0000000000a1"),
	tenantId: "0193f2c4-0000-7000-8000-0000000000c1",
	locationId: "0193f2c4-0000-7000-8000-0000000000d1",
};

describe("the till's request headers", () => {
	it("shows its own headers with the API key cut short", () => {
		const headers = tillRequestHeaders(CREDENTIALS);

		expect(headers["X-API-Key"]).toBe("rk_liv••••••••");
		expect(headers["X-Terminal-Id"]).toBe(CREDENTIALS.terminalId);
		expect(headers["Content-Type"]).toBe("application/json");
		expect(JSON.stringify(headers)).not.toContain(CREDENTIALS.apiKey);
	});

	it("masks only the key", () => {
		expect(maskHeaderValue("x-api-key", "abcdefghij")).toBe("abcdef••••••••");
		expect(maskHeaderValue("X-Tenant-Id", "tenant")).toBe("tenant");
	});
});

describe("validateExchange", () => {
	it("records the call, what was sent and the answer", () => {
		const exchange = validateExchange(
			CREDENTIALS,
			{ claimId: "c1", qrToken: "t" },
			{ ok: true, body: { success: true, data: { valid: true }, meta: { timestamp: epochMs(0) } } },
		);

		expect(exchange).toMatchObject({ method: "POST", path: "/integration/redemptions/validate", requestBody: { claimId: "c1", qrToken: "t" }, succeeded: true });
		expect(exchange.responseBody).toEqual({ success: true, data: { valid: true }, meta: { timestamp: 0 } });
	});

	it("shows an error answer in the API's own words", () => {
		const error = new ApiError({ message: "This reward has expired", error: "REWARD_EXPIRED", statusCode: 422 }, { correlationId: "corr-1" });
		const exchange = validateExchange(CREDENTIALS, { backupCode: "ABCD2345" }, { ok: false, error });

		expect(exchange.succeeded).toBe(false);
		expect(exchange.responseBody).toEqual({ success: false, error: { code: "REWARD_EXPIRED", message: "This reward has expired" }, statusCode: 422, correlationId: "corr-1" });
	});

	it("falls back to the message for a transport failure", () => {
		expect(errorBodyOf(new TypeError("Network request failed"))).toEqual({ error: { message: "Network request failed" } });
	});
});

describe("checkoutExchange", () => {
	it("records the redeem call: the bill, its idempotency key and the codes", () => {
		const request = { idempotencyKey: "0b6f0c2e-6a39-4d0c-9a51-3f1f7f6f2a10", billTotalMinor: 2550, currency: "MYR", codes: [{ token: "k3J9xQ2mV8pL1tR6wZ4bN7cY0dF5gH2s" }] };
		const exchange = checkoutExchange(CREDENTIALS, request, { ok: true, body: { success: true } });

		expect(exchange).toMatchObject({ method: "POST", path: "/integration/redemptions/checkout", requestBody: request, responseBody: { success: true }, succeeded: true });
	});
});

describe("prettyJson", () => {
	it("indents for reading", () => {
		expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}');
	});
});
