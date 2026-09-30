import { afterEach, describe, expect, it } from "vitest";
import type { CallHandler } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { firstValueFrom, Observable } from "rxjs";

import { accessToken, createHttpContext, testRequest, type TestHttpRequest } from "../../../test/support/http-execution-context";

import { TenancyConfigService } from "../../config/tenancy.config";
import { RLS_BYPASS_KEY } from "../../modules/auth/decorators/rls-bypass.decorator";
import { rlsStorage, type RlsContext } from "../../prisma/rls-context";
import { RlsInterceptor } from "./rls.interceptor";

/** Handler that reports the RLS scope it runs in. */
const captureScope: CallHandler<RlsContext | undefined> = {
	handle: () =>
		new Observable<RlsContext | undefined>((subscriber) => {
			subscriber.next(rlsStorage.getStore());
			subscriber.complete();
		}),
};

async function scopeFor(request: TestHttpRequest, rlsBypass = false): Promise<RlsContext | undefined> {
	const interceptor = new RlsInterceptor(new Reflector(), new TenancyConfigService());
	const context = createHttpContext(request, rlsBypass ? { [RLS_BYPASS_KEY]: true } : {});
	return firstValueFrom(interceptor.intercept(context, captureScope));
}

describe("RlsInterceptor", () => {
	afterEach(() => {
		delete process.env.TENANCY_ENABLED;
		delete process.env.DEFAULT_ORGANIZATION_ID;
	});

	it("scopes authenticated non-admin users without bypass", async () => {
		const scope = await scopeFor(testRequest({ user: accessToken() }));

		expect(scope).toEqual(expect.objectContaining({ userId: "user-1", bypass: false, requireExplicitContext: true, systemOperation: "" }));
	});

	it("never bypasses RLS for anonymous requests", async () => {
		const scope = await scopeFor(testRequest());

		expect(scope).toEqual(expect.objectContaining({ userId: "", bypass: false, systemOperation: "" }));
	});

	it("keeps refresh-token requests scoped to the token subject", async () => {
		const scope = await scopeFor(testRequest({ user: { sub: "user-9", email: "u@example.com", jti: "jti-1", tokenType: "refresh" } }));

		expect(scope).toEqual(expect.objectContaining({ userId: "user-9", bypass: false }));
	});

	it("names the system operation for every bypass", async () => {
		expect(await scopeFor(testRequest(), true)).toEqual(expect.objectContaining({ bypass: true, systemOperation: "route.rls_bypass" }));
		expect(await scopeFor(testRequest({ user: accessToken({ isSuperAdmin: true }) }))).toEqual(
			expect.objectContaining({ bypass: true, systemOperation: "platform.superadmin" }),
		);
		expect(await scopeFor(testRequest({ user: accessToken({ hasAdminAccess: true }) }))).toEqual(
			expect.objectContaining({ bypass: true, systemOperation: "platform.staff_single_tenant" }),
		);
	});

	it("does not let staff bypass RLS in multi-tenant mode", async () => {
		process.env.TENANCY_ENABLED = "true";

		const scope = await scopeFor(testRequest({ user: accessToken({ hasAdminAccess: true }) }));

		expect(scope?.bypass).toBe(false);
	});

	it("uses only the guard-verified organization in multi-tenant mode, never the raw header", async () => {
		process.env.TENANCY_ENABLED = "true";
		process.env.DEFAULT_ORGANIZATION_ID = "org-default";

		const forged = await scopeFor(testRequest({ user: accessToken(), headers: { "x-organization-id": "org-victim" } }));
		expect(forged?.organizationId).toBe("org-default");

		const verified = await scopeFor(testRequest({ user: accessToken(), headers: { "x-organization-id": "org-a" }, authorizationContext: { organizationId: "org-a" } }));
		expect(verified?.organizationId).toBe("org-a");
	});
});
