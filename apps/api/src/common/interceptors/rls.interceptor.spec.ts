import { describe, expect, it } from "vitest";
import type { CallHandler } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { firstValueFrom, Observable } from "rxjs";

import { accessToken, createHttpContext, refreshToken, testRequest, type TestHttpRequest } from "../../../test/support/http-execution-context";
import { createTestTypedConfig, type TestEnv } from "../../../test/support/test-api-env";

import { TenancyConfigService } from "../../config/tenancy.config";
import { RLS_BYPASS_KEY } from "../../modules/auth/decorators/rls-bypass.decorator";
import { rlsStorage, type RlsContext } from "../../prisma/rls-context";
import { RequestContextService, type RequestTenant } from "../context/request-context";
import { RlsInterceptor } from "./rls.interceptor";

/** Handler that reports the RLS scope it runs in. */
const captureScope: CallHandler<RlsContext | undefined> = {
	handle: () =>
		new Observable<RlsContext | undefined>((subscriber) => {
			subscriber.next(rlsStorage.getStore());
			subscriber.complete();
		}),
};

interface ScopeOptions {
	readonly rlsBypass?: boolean;
	readonly env?: TestEnv;
	/** Tenant AuthorizationGuard would have verified and bound into the request context. */
	readonly verifiedTenant?: Partial<RequestTenant>;
}

/** Runs the interceptor inside a request context, the way the middleware + guards leave it. */
async function scopeFor(request: TestHttpRequest, options: ScopeOptions = {}): Promise<RlsContext | undefined> {
	const requestContext = new RequestContextService();
	const interceptor = new RlsInterceptor(new Reflector(), new TenancyConfigService(createTestTypedConfig(options.env)), requestContext);
	const context = createHttpContext(request, options.rlsBypass === true ? { [RLS_BYPASS_KEY]: true } : {});
	return requestContext.run({ correlationId: "corr-rls", ip: undefined, userAgent: undefined }, () => {
		if (options.verifiedTenant !== undefined) {
			requestContext.bindTenant(options.verifiedTenant);
		}
		return firstValueFrom(interceptor.intercept(context, captureScope));
	});
}

describe("RlsInterceptor", () => {
	it("scopes authenticated non-admin users without bypass", async () => {
		const scope = await scopeFor(testRequest({ user: accessToken() }));

		expect(scope).toEqual(expect.objectContaining({ userId: "user-1", bypass: false, requireExplicitContext: true, systemOperation: "" }));
	});

	it("never bypasses RLS for anonymous requests", async () => {
		const scope = await scopeFor(testRequest());

		expect(scope).toEqual(expect.objectContaining({ userId: "", bypass: false, systemOperation: "" }));
	});

	it("keeps refresh-token requests scoped to the token subject", async () => {
		const scope = await scopeFor(testRequest({ user: refreshToken({ sub: "user-9", email: "u@example.com", jti: "jti-1" }) }));

		expect(scope).toEqual(expect.objectContaining({ userId: "user-9", bypass: false }));
	});

	it("names the system operation for every bypass", async () => {
		expect(await scopeFor(testRequest(), { rlsBypass: true })).toEqual(expect.objectContaining({ bypass: true, systemOperation: "route.rls_bypass" }));
		expect(await scopeFor(testRequest({ user: accessToken({ isSuperAdmin: true }) }))).toEqual(
			expect.objectContaining({ bypass: true, systemOperation: "platform.superadmin" }),
		);
		expect(await scopeFor(testRequest({ user: accessToken({ hasAdminAccess: true }) }))).toEqual(
			expect.objectContaining({ bypass: true, systemOperation: "platform.staff_single_tenant" }),
		);
	});

	it("does not let staff bypass RLS in multi-tenant mode", async () => {
		const scope = await scopeFor(testRequest({ user: accessToken({ hasAdminAccess: true }) }), { env: { TENANCY_ENABLED: "true" } });

		expect(scope?.bypass).toBe(false);
	});

	it("uses the fixed default organization in single-tenant mode, whatever the context says", async () => {
		const scope = await scopeFor(testRequest({ user: accessToken() }), { env: { DEFAULT_ORGANIZATION_ID: "org-single" }, verifiedTenant: { organizationId: "org-a" } });

		expect(scope?.organizationId).toBe("org-single");
	});

	it("uses only the guard-verified organization from the request context in multi-tenant mode, never the raw header", async () => {
		const env: TestEnv = { TENANCY_ENABLED: "true", DEFAULT_ORGANIZATION_ID: "org-default" };

		const forged = await scopeFor(testRequest({ user: accessToken(), headers: { "x-organization-id": "org-victim" } }), { env });
		expect(forged?.organizationId).toBe("org-default");

		const verified = await scopeFor(testRequest({ user: accessToken(), headers: { "x-organization-id": "org-a" } }), { env, verifiedTenant: { organizationId: "org-a" } });
		expect(verified?.organizationId).toBe("org-a");
	});
});
