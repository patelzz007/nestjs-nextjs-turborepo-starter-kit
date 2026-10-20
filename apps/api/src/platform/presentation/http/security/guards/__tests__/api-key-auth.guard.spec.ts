import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { CapabilitySlug, TenantApiKeyScope } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHttpContext, testRequest } from "../../../../../../../test/support/http-execution-context";
import { API_KEY_VERIFICATION, type MerchantApiKeyAuthContext } from "../../../../../application/ports/api-key-verification.port";
import { RequestContextService } from "../../../../../infrastructure/context/request-context";
import { ALLOW_API_KEY_AUTH_KEY } from "../../api-keys/api-key-request";
import { DEFAULT_ALLOWED_API_KEY_SCOPES } from "../../decorators/allow-api-key-auth.decorator";
import { ApiKeyAuthGuard } from "../api-key-auth.guard";

const mocks = vi.hoisted(() => ({ verify: vi.fn() }));

/** What each scope holds on the tenant API (the guard only reads the scope). */
const SCOPE_CAPABILITIES: Readonly<Record<TenantApiKeyScope, readonly CapabilitySlug[]>> = { POS: [], INTEGRATION: ["merchant:view_rewards"] };

function keyContext(scope: TenantApiKeyScope): MerchantApiKeyAuthContext {
	return {
		provider: "merchant",
		apiKeyId: "key-1",
		tenantId: "org-1",
		locationId: null,
		terminal: null,
		requireRegisteredTerminals: false,
		scope,
		capabilities: SCOPE_CAPABILITIES[scope],
	};
}

/** An `@AllowApiKeyAuth()` route (default options) called with a non-JWT API key. */
async function callTenantRoute(scope: TenantApiKeyScope): Promise<boolean> {
	mocks.verify.mockResolvedValue(keyContext(scope));
	const moduleRef = await Test.createTestingModule({
		providers: [ApiKeyAuthGuard, Reflector, RequestContextService, { provide: API_KEY_VERIFICATION, useValue: { verify: mocks.verify } }],
	}).compile();
	const request = testRequest({ headers: { "x-api-key": "mk_live_test" } });
	return moduleRef
		.get(ApiKeyAuthGuard)
		.canActivate(createHttpContext(request, { [ALLOW_API_KEY_AUTH_KEY]: { providers: ["merchant"], scopes: DEFAULT_ALLOWED_API_KEY_SCOPES } }));
}

describe("ApiKeyAuthGuard key scope", () => {
	beforeEach(() => {
		mocks.verify.mockReset();
	});

	it("admits an integration key to the tenant API", async () => {
		await expect(callTenantRoute("INTEGRATION")).resolves.toBe(true);
		expect(mocks.verify).toHaveBeenCalledWith("mk_live_test");
	});

	it("binds the authenticated key as the request's principal (idempotency scope, audit trail)", async () => {
		const requestContext = new RequestContextService();
		const bound = await requestContext.run({ correlationId: "corr-key", ip: undefined, userAgent: undefined, edgeLocation: undefined }, async () => {
			await callTenantRoute("INTEGRATION");
			return requestContext.current()?.apiKey;
		});

		// The key's own store (`null` = tenant-wide) is the request's database store scope.
		expect(bound).toEqual({ apiKeyId: "key-1", tenantId: "org-1", terminalId: undefined, locationId: null });
	});

	it("refuses a paired till's POS key on the tenant API (403 API_KEY_SCOPE_FORBIDDEN)", async () => {
		await expect(callTenantRoute("POS")).rejects.toBeInstanceOf(ForbiddenException);
		await expect(callTenantRoute("POS")).rejects.toMatchObject({ response: { error: "API_KEY_SCOPE_FORBIDDEN" } });
	});
});
