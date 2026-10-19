import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";

import { createHttpContext, testRequest } from "../../../../../../../test/support/http-execution-context";
import type { ApiKeyVerificationPort, MerchantApiKeyAuthContext } from "../../../../../application/ports/api-key-verification.port";
import type { TillRefusal, TillResolution, TillResolverPort } from "../../../../../application/ports/till-resolution.port";
import { RequestContextService } from "../../../../../infrastructure/context/request-context";
import { getTillPointFromRequest } from "../../api-keys/api-key-request";
import { MerchantApiKeyGuard } from "../merchant-api-key.guard";

const KEY: MerchantApiKeyAuthContext = {
	provider: "merchant",
	apiKeyId: "key-1",
	organizationId: "org-1",
	locationId: "store-a",
	terminal: null,
	requireRegisteredTerminals: false,
	scope: "POS",
	capabilities: [],
};

/** Verifies exactly one plaintext. */
function verifier(known: string): ApiKeyVerificationPort {
	return { verify: (plaintext: string): Promise<MerchantApiKeyAuthContext | null> => Promise.resolve(plaintext === known ? KEY : null) };
}

/** Answers every till with `resolution`, recording what it was asked. */
function resolver(resolution: TillResolution): TillResolverPort & { readonly asked: (string | undefined)[] } {
	const asked: (string | undefined)[] = [];
	return {
		asked,
		resolve: (_key: MerchantApiKeyAuthContext, requestedTerminalId: string | undefined): Promise<TillResolution> => {
			asked.push(requestedTerminalId);
			return Promise.resolve(resolution);
		},
	};
}

/** Each refusal with the status and message POS clients already handle. */
const REFUSAL_CASES: readonly (readonly [TillRefusal, number, string])[] = [
	["TERMINAL_KEY_MISMATCH", 403, "This API key belongs to a different terminal"],
	["TERMINAL_ID_REQUIRED", 401, "X-Terminal-Id header required"],
	["TERMINAL_NOT_REGISTERED", 401, "This terminal is not registered with the merchant"],
	["TERMINAL_LOCATION_MISMATCH", 403, "This API key belongs to a different store than this terminal"],
];

const RESOLVED: TillResolution = { kind: "resolved", point: { organizationId: "org-1", locationId: "store-a", terminalId: "TERM-AAAA2222", apiKeyId: "key-1" } };

describe("MerchantApiKeyGuard", () => {
	it("authenticates the key, resolves the till, attaches it and binds the key as the request's principal", async () => {
		const requestContext = new RequestContextService();
		const tills = resolver(RESOLVED);
		const context = createHttpContext(testRequest({ headers: { "x-api-key": "mk_live_ok", "x-terminal-id": "TERM-AAAA2222" } }));

		const bound = await requestContext.run({ correlationId: "corr-1", ip: undefined, userAgent: undefined, edgeLocation: undefined }, async () => {
			await expect(new MerchantApiKeyGuard(verifier("mk_live_ok"), tills, requestContext).canActivate(context)).resolves.toBe(true);
			return requestContext.current()?.apiKey;
		});

		expect(getTillPointFromRequest(context.switchToHttp().getRequest<FastifyRequest>())).toEqual(RESOLVED.point);
		expect(tills.asked).toEqual(["TERM-AAAA2222"]);
		// The key's own store (not the till's) is the request's database store scope.
		expect(bound).toEqual({ apiKeyId: "key-1", organizationId: "org-1", terminalId: "TERM-AAAA2222", locationId: "store-a" });
	});

	it("passes no terminal id when the header is absent", async () => {
		const tills = resolver(RESOLVED);

		await new MerchantApiKeyGuard(verifier("mk_live_ok"), tills, new RequestContextService()).canActivate(
			createHttpContext(testRequest({ headers: { authorization: "Bearer mk_live_ok" } })),
		);

		expect(tills.asked).toEqual([undefined]);
	});

	it.each([
		["no key", {}, 401, "MERCHANT_API_KEY_REQUIRED"],
		["an unknown key", { "x-api-key": "mk_live_wrong" }, 401, "MERCHANT_API_KEY_INVALID"],
		["a malformed terminal id", { "x-api-key": "mk_live_ok", "x-terminal-id": "bad id!" }, 400, "TERMINAL_ID_INVALID"],
	])("refuses %s", async (_label, headers, status, error) => {
		await expect(
			new MerchantApiKeyGuard(verifier("mk_live_ok"), resolver(RESOLVED), new RequestContextService()).canActivate(createHttpContext(testRequest({ headers }))),
		).rejects.toMatchObject({
			status,
			response: { error },
		});
	});

	it.each(REFUSAL_CASES)("answers the %s refusal with its legacy status and body", async (refusal, status, message) => {
		const guard = new MerchantApiKeyGuard(verifier("mk_live_ok"), resolver({ kind: "refused", refusal }), new RequestContextService());

		await expect(guard.canActivate(createHttpContext(testRequest({ headers: { "x-api-key": "mk_live_ok" } })))).rejects.toMatchObject({
			status,
			response: { error: refusal, message },
		});
	});
});
