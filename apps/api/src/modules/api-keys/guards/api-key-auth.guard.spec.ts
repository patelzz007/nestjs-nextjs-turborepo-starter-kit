import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { OrganizationApiKeyScope } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHttpContext, testRequest } from "../../../../test/support/http-execution-context";
import { RequestContextService } from "../../../common/context/request-context";
import { ALLOW_API_KEY_AUTH_KEY } from "../constants/api-key-auth.constants";
import { MERCHANT_API_KEY_SCOPE_CAPABILITIES } from "../constants/merchant-api-key-capabilities";
import { DEFAULT_ALLOWED_API_KEY_SCOPES } from "../decorators/allow-api-key-auth.decorator";
import { ApiKeyAuthService } from "../services/api-key-auth.service";
import type { MerchantApiKeyAuthContext } from "../types/api-key-auth.types";
import { ApiKeyAuthGuard } from "./api-key-auth.guard";

const mocks = vi.hoisted(() => ({ authenticate: vi.fn() }));

function keyContext(scope: OrganizationApiKeyScope): MerchantApiKeyAuthContext {
	return {
		provider: "merchant",
		apiKeyId: "key-1",
		organizationId: "org-1",
		locationId: null,
		terminal: null,
		requireRegisteredTerminals: false,
		scope,
		capabilities: MERCHANT_API_KEY_SCOPE_CAPABILITIES[scope],
	};
}

/** An `@AllowApiKeyAuth()` route (default options) called with a non-JWT API key. */
async function callOrganizationRoute(scope: OrganizationApiKeyScope): Promise<boolean> {
	mocks.authenticate.mockResolvedValue(keyContext(scope));
	const moduleRef = await Test.createTestingModule({
		providers: [ApiKeyAuthGuard, Reflector, RequestContextService, { provide: ApiKeyAuthService, useValue: { authenticate: mocks.authenticate } }],
	}).compile();
	const request = testRequest({ headers: { "x-api-key": "mk_live_test" } });
	return moduleRef
		.get(ApiKeyAuthGuard)
		.canActivate(createHttpContext(request, { [ALLOW_API_KEY_AUTH_KEY]: { providers: ["merchant"], scopes: DEFAULT_ALLOWED_API_KEY_SCOPES } }));
}

describe("ApiKeyAuthGuard key scope", () => {
	beforeEach(() => {
		mocks.authenticate.mockReset();
	});

	it("admits an integration key to the organization API", async () => {
		await expect(callOrganizationRoute("INTEGRATION")).resolves.toBe(true);
		expect(mocks.authenticate).toHaveBeenCalledWith("mk_live_test", { providers: ["merchant"], scopes: DEFAULT_ALLOWED_API_KEY_SCOPES });
	});

	it("binds the authenticated key as the request's principal (idempotency scope, audit trail)", async () => {
		const requestContext = new RequestContextService();
		const bound = await requestContext.run({ correlationId: "corr-key", ip: undefined, userAgent: undefined }, async () => {
			await callOrganizationRoute("INTEGRATION");
			return requestContext.current()?.apiKey;
		});

		// The key's own store (`null` = organization-wide) is the request's database store scope.
		expect(bound).toEqual({ apiKeyId: "key-1", organizationId: "org-1", terminalId: undefined, locationId: null });
	});

	it("refuses a paired till's POS key on the organization API (403 API_KEY_SCOPE_FORBIDDEN)", async () => {
		await expect(callOrganizationRoute("POS")).rejects.toBeInstanceOf(ForbiddenException);
		await expect(callOrganizationRoute("POS")).rejects.toMatchObject({ response: { error: "API_KEY_SCOPE_FORBIDDEN" } });
	});
});
