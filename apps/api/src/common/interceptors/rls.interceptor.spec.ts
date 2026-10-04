import { describe, expect, it } from "vitest";
import type { CallHandler } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { firstValueFrom, Observable } from "rxjs";

import { accessToken, createHttpContext, refreshToken, testRequest, type TestHttpRequest } from "../../../test/support/http-execution-context";
import { createTestTypedConfig, type TestEnv } from "../../../test/support/test-api-env";
import { createTestPrisma } from "../../../test/support/test-service-graph";

import { TenancyConfigService } from "../../config/tenancy.config";
import { RLS_BYPASS_KEY } from "../../modules/auth/decorators/rls-bypass.decorator";
import { rlsStorage, type RlsContext } from "../../prisma/rls-context";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { RequestContextService, type RequestApiKeyPrincipal, type RequestTenant } from "../context/request-context";
import { DefaultOrganizationRepository } from "../tenancy/default-organization.repository";
import { DefaultOrganizationMissingError, DefaultOrganizationService } from "../tenancy/default-organization.service";
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
	/** The API key an API-key guard verified and bound into the request context. */
	readonly verifiedApiKey?: RequestApiKeyPrincipal;
}

/** A single-tenant organization the "database" knows: the boot check passes for it. */
const SINGLE_TENANT_ORG = "5c1e2f3a-4b5c-4d6e-8f70-819203a4b5c6";

/** Repository double: only {@link SINGLE_TENANT_ORG} is a live organization. */
class KnownOrganizations extends DefaultOrganizationRepository {
	public override isLiveOrganization(organizationId: string): Promise<boolean> {
		return Promise.resolve(organizationId === SINGLE_TENANT_ORG);
	}
}

/** The interceptor as Nest builds it: tenancy config + a boot-verified default organization. */
async function interceptorFor(requestContext: RequestContextService, env: TestEnv = {}): Promise<RlsInterceptor> {
	const config = createTestTypedConfig({ DEFAULT_ORGANIZATION_ID: SINGLE_TENANT_ORG, ...env });
	const tenancy = new TenancyConfigService(config);
	const defaultOrganization = new DefaultOrganizationService(tenancy, new KnownOrganizations(new TenantTransactionService(createTestPrisma(config), requestContext)));
	await defaultOrganization.onModuleInit();
	return new RlsInterceptor(new Reflector(), tenancy, requestContext, defaultOrganization);
}

/** Runs the interceptor inside a request context, the way the middleware + guards leave it. */
async function scopeFor(request: TestHttpRequest, options: ScopeOptions = {}): Promise<RlsContext | undefined> {
	const requestContext = new RequestContextService();
	const interceptor = await interceptorFor(requestContext, options.env);
	const context = createHttpContext(request, options.rlsBypass === true ? { [RLS_BYPASS_KEY]: true } : {});
	return requestContext.run({ correlationId: "corr-rls", ip: undefined, userAgent: undefined }, () => {
		if (options.verifiedTenant !== undefined) {
			requestContext.bindTenant(options.verifiedTenant);
		}
		if (options.verifiedApiKey !== undefined) {
			requestContext.bindApiKey(options.verifiedApiKey);
		}
		return firstValueFrom(interceptor.intercept(context, captureScope));
	});
}

describe("RlsInterceptor", () => {
	it("scopes authenticated non-admin users without bypass", async () => {
		const scope = await scopeFor(testRequest({ user: accessToken() }));

		expect(scope).toEqual(
			expect.objectContaining({ kind: "user", userId: "user-1", bypass: false, requireExplicitContext: true, systemOperation: null, role: "app_runtime" }),
		);
	});

	it("never bypasses RLS for anonymous requests", async () => {
		const scope = await scopeFor(testRequest());

		expect(scope).toEqual(expect.objectContaining({ kind: "anonymous", userId: null, bypass: false, systemOperation: null, role: "app_runtime" }));
	});

	it("runs a verified API key as an api_key principal of the key's own organization and store — never a bypass", async () => {
		const scope = await scopeFor(testRequest(), {
			verifiedApiKey: { apiKeyId: "key-1", organizationId: "org-key", terminalId: "TILL-1", locationId: "store-1" },
			verifiedTenant: { organizationId: "org-other" },
		});

		expect(scope).toEqual(
			expect.objectContaining({
				kind: "api_key",
				apiKeyId: "key-1",
				organizationId: "org-key",
				apiKeyLocationId: "store-1",
				userId: null,
				bypass: false,
				systemOperation: null,
			}),
		);
	});

	it("keeps refresh-token requests scoped to the token subject", async () => {
		const scope = await scopeFor(testRequest({ user: refreshToken({ sub: "user-9", email: "u@example.com", jti: "jti-1" }) }));

		expect(scope).toEqual(expect.objectContaining({ userId: "user-9", bypass: false }));
	});

	it("names the system operation for every bypass", async () => {
		// A public bypass route has no actor: `null`, never an empty-string user id.
		expect(await scopeFor(testRequest(), { rlsBypass: true })).toEqual(
			expect.objectContaining({ kind: "system", userId: null, bypass: true, systemOperation: "route.rls_bypass" }),
		);
		expect(await scopeFor(testRequest({ user: accessToken({ isSuperAdmin: true }) }))).toEqual(
			expect.objectContaining({ bypass: true, systemOperation: "platform.superadmin" }),
		);
		expect(await scopeFor(testRequest({ user: accessToken({ hasAdminAccess: true }) }))).toEqual(
			expect.objectContaining({ bypass: true, systemOperation: "platform.staff_single_tenant" }),
		);
	});

	it("records the bypass on the request context so the request's audit entry names it", async () => {
		const requestContext = new RequestContextService();
		const interceptor = await interceptorFor(requestContext);
		const context = createHttpContext(testRequest({ user: accessToken({ isSuperAdmin: true }) }), {});

		const recorded = await requestContext.run({ correlationId: "corr-rls-audit", ip: undefined, userAgent: undefined }, async () => {
			await firstValueFrom(interceptor.intercept(context, captureScope));
			return requestContext.current()?.systemOperations;
		});

		expect(recorded).toEqual(["platform.superadmin"]);
	});

	it("records nothing for a non-bypass user scope", async () => {
		const requestContext = new RequestContextService();
		const interceptor = await interceptorFor(requestContext);
		const context = createHttpContext(testRequest({ user: accessToken() }), {});

		const recorded = await requestContext.run({ correlationId: "corr-rls-none", ip: undefined, userAgent: undefined }, async () => {
			await firstValueFrom(interceptor.intercept(context, captureScope));
			return requestContext.current()?.systemOperations;
		});

		expect(recorded).toEqual([]);
	});

	it("does not let staff bypass RLS in multi-tenant mode", async () => {
		const scope = await scopeFor(testRequest({ user: accessToken({ hasAdminAccess: true }) }), { env: { TENANCY_ENABLED: "true" } });

		expect(scope?.bypass).toBe(false);
	});

	it("uses the fixed default organization in single-tenant mode, whatever the context says", async () => {
		const scope = await scopeFor(testRequest({ user: accessToken() }), { verifiedTenant: { organizationId: "org-a" } });

		expect(scope?.organizationId).toBe(SINGLE_TENANT_ORG);
	});

	it("uses only the guard-verified organization from the request context in multi-tenant mode, never the raw header", async () => {
		const env: TestEnv = { TENANCY_ENABLED: "true" };

		// No verified tenant: no organization at all (fail closed) — neither the forged header nor DEFAULT_ORGANIZATION_ID.
		const forged = await scopeFor(testRequest({ user: accessToken(), headers: { "x-organization-id": "org-victim" } }), { env });
		expect(forged?.organizationId).toBeNull();
		expect(forged?.requireExplicitContext).toBe(true);

		const verified = await scopeFor(testRequest({ user: accessToken(), headers: { "x-organization-id": "org-a" } }), { env, verifiedTenant: { organizationId: "org-a" } });
		expect(verified?.organizationId).toBe("org-a");
	});

	it("refuses to boot single-tenant mode when DEFAULT_ORGANIZATION_ID is not a live organization", async () => {
		await expect(interceptorFor(new RequestContextService(), { DEFAULT_ORGANIZATION_ID: "0f0e0d0c-0b0a-4908-8706-050403020100" })).rejects.toBeInstanceOf(
			DefaultOrganizationMissingError,
		);
	});
});
