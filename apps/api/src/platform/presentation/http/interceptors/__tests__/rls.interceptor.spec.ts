import { describe, expect, it } from "vitest";
import type { CallHandler } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { firstValueFrom, Observable } from "rxjs";

import {
	accessToken,
	createHttpContext,
	refreshToken,
	testRequest,
	type TestHttpRequest,
	type TestRouteMetadata,
} from "../../../../../../test/support/http-execution-context";
import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";

import { TenancyConfigService } from "../../../../../config/tenancy.config";
import { PLATFORM_OPERATION_KEY } from "../../security/decorators/platform-operation.decorator";
import { PUBLIC_OPERATION_KEY } from "../../security/decorators/public-operation.decorator";
import { rlsStorage, type RlsContext } from "../../../../../prisma/rls-context";
import { RequestContextService, type RequestApiKeyPrincipal, type RequestTenant, RequestActorResolution } from "../../../../infrastructure/context/request-context";
import { DefaultTenantMissingError, DefaultTenantService } from "../../../../infrastructure/tenancy/default-tenant.service";
import type { TenantRouteLookup, TenantRouteRecord } from "../../../../application/tenancy/tenant-source.port";
import { ConflictingRouteOperationError, RlsInterceptor } from "../rls.interceptor";
import { ActorContextFactory } from "../../security/actor-context.factory";
import { toRlsContext, USER_OWNED_DATA_SCOPE } from "../../../../infrastructure/unit-of-work/actor-to-rls-context";

/** Handler that reports the RLS scope it runs in. */
const captureScope: CallHandler<RlsContext | undefined> = {
	handle: () =>
		new Observable<RlsContext | undefined>((subscriber) => {
			subscriber.next(rlsStorage.getStore());
			subscriber.complete();
		}),
};

interface ScopeOptions {
	readonly platformOperation?: "audit.http_request.read";
	readonly publicOperation?: "auth.signup.register";
	readonly env?: Readonly<Record<string, string | undefined>>;
	/** Tenant AuthorizationGuard would have verified and bound into the request context. */
	readonly verifiedTenant?: Partial<RequestTenant>;
	/** The API key an API-key guard verified and bound into the request context. */
	readonly verifiedApiKey?: RequestApiKeyPrincipal;
}

/** A single-tenant tenant the "database" knows: the boot check passes for it. */
const SINGLE_TENANT_ORG = "5c1e2f3a-4b5c-4d6e-8f70-819203a4b5c6";

/** Lookup double: only {@link SINGLE_TENANT_ORG} is a live tenant. */
class KnownTenants implements TenantRouteLookup {
	public findLiveById(tenantId: string): Promise<TenantRouteRecord | null> {
		return Promise.resolve(tenantId === SINGLE_TENANT_ORG ? { id: SINGLE_TENANT_ORG, slug: "single", lifecycleState: "ACTIVE" } : null);
	}

	public findLiveByRouteKey(): Promise<TenantRouteRecord | null> {
		return Promise.resolve(null);
	}
}

/** The interceptor as Nest builds it, after the boot check of the single-mode default tenant. */
async function interceptorFor(requestContext: RequestContextService, env: Readonly<Record<string, string | undefined>> = {}): Promise<RlsInterceptor> {
	const config = createTestTypedConfig({ DEFAULT_TENANT_ID: SINGLE_TENANT_ORG, ...env });
	const tenancy = new TenancyConfigService(config);
	const defaultTenant = new DefaultTenantService(tenancy, new KnownTenants());
	await defaultTenant.onModuleInit();
	return new RlsInterceptor(new Reflector(), requestContext, new ActorContextFactory(requestContext));
}

function routeMetadata(options: ScopeOptions): TestRouteMetadata {
	const metadata: Record<string, object | boolean | string> = {};
	if (options.platformOperation !== undefined) {
		metadata[PLATFORM_OPERATION_KEY] = options.platformOperation;
	}
	if (options.publicOperation !== undefined) {
		metadata[PUBLIC_OPERATION_KEY] = options.publicOperation;
	}
	return metadata;
}

/** Runs the interceptor inside a request context, the way the middleware + guards leave it. */
async function scopeFor(request: TestHttpRequest, options: ScopeOptions = {}): Promise<RlsContext | undefined> {
	const requestContext = new RequestContextService();
	const interceptor = await interceptorFor(requestContext, options.env);
	const context = createHttpContext(request, routeMetadata(options));
	return requestContext.run({ correlationId: "corr-rls", ip: undefined, userAgent: undefined, edgeLocation: undefined }, () => {
		if (options.verifiedTenant !== undefined) {
			requestContext.bindTenant(options.verifiedTenant);
		}
		if (options.verifiedApiKey !== undefined) {
			requestContext.bindApiKey(options.verifiedApiKey);
		}
		return firstValueFrom(interceptor.intercept(context, captureScope));
	});
}

/** The scope the handler runs under and the actor the interceptor bound for it. */
async function scopeAndActorFor(
	request: TestHttpRequest,
	options: ScopeOptions,
): Promise<{ readonly scope: RlsContext | undefined; readonly actor: RequestActorResolution | undefined }> {
	const requestContext = new RequestContextService();
	const interceptor = await interceptorFor(requestContext, options.env);
	const context = createHttpContext(request, routeMetadata(options));
	return requestContext.run({ correlationId: "corr-rls-actor", ip: undefined, userAgent: undefined, edgeLocation: undefined }, async () => {
		if (options.verifiedApiKey !== undefined) {
			requestContext.bindApiKey(options.verifiedApiKey);
		}
		const scope = await firstValueFrom(interceptor.intercept(context, captureScope));
		return { scope, actor: requestContext.current()?.actor };
	});
}

describe("RlsInterceptor", () => {
	it("scopes authenticated non-admin users without bypass", async () => {
		const scope = await scopeFor(testRequest({ user: accessToken() }));

		expect(scope).toEqual(
			// The request scope requires no tenant (a customer has none); tenant units of work refuse early on their own.
			expect.objectContaining({ kind: "user", userId: "user-1", bypass: false, requireExplicitContext: false, systemOperation: null, role: "app_runtime" }),
		);
	});

	it("never bypasses RLS for anonymous requests", async () => {
		const scope = await scopeFor(testRequest());

		expect(scope).toEqual(expect.objectContaining({ kind: "anonymous", userId: null, bypass: false, systemOperation: null, role: "app_runtime" }));
	});

	it("runs a verified API key as an api_key principal of the key's own tenant and store — never a bypass", async () => {
		const scope = await scopeFor(testRequest(), {
			verifiedApiKey: { apiKeyId: "key-1", tenantId: "org-key", terminalId: "TILL-1", locationId: "store-1" },
			verifiedTenant: { tenantId: "org-other" },
		});

		expect(scope).toEqual(
			expect.objectContaining({
				kind: "api_key",
				apiKeyId: "key-1",
				tenantId: "org-key",
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

	it("leaves an anonymous request and a superadmin on their own scope", async () => {
		expect(await scopeFor(testRequest())).toEqual(expect.objectContaining({ kind: "anonymous", userId: null, bypass: false, systemOperation: null }));
		expect(await scopeFor(testRequest({ user: accessToken({ isSuperAdmin: true }) }))).toEqual(
			expect.objectContaining({ kind: "user", bypass: false, systemOperation: null }),
		);
	});

	it("ST-005: single-tenant staff with admin access get no RLS bypass, and no tenant on a tenantless route", async () => {
		expect(await scopeFor(testRequest({ user: accessToken({ hasAdminAccess: true }) }))).toEqual(
			expect.objectContaining({ kind: "user", bypass: false, systemOperation: null, tenantId: null }),
		);
	});

	it("PLAT-001: a platform operation replaces the superadmin bypass for that handler", async () => {
		const scope = await scopeFor(testRequest({ user: accessToken({ isSuperAdmin: true }) }), { platformOperation: "audit.http_request.read" });

		expect(scope).toEqual(expect.objectContaining({ kind: "system", bypass: true, systemOperation: "audit.http_request.read", userId: "user-1" }));
	});

	it("MT-43: a public operation scopes an anonymous request to that one operation", async () => {
		const scope = await scopeFor(testRequest(), { publicOperation: "auth.signup.register" });

		expect(scope).toEqual(expect.objectContaining({ kind: "system", bypass: true, systemOperation: "auth.signup.register", userId: null }));
	});

	it("scopes a route operation reached by an API key to the key's own tenant, never another verified tenant", async () => {
		const scope = await scopeFor(testRequest(), {
			publicOperation: "auth.signup.register",
			verifiedApiKey: { apiKeyId: "key-1", tenantId: "org-key", terminalId: undefined, locationId: null },
			verifiedTenant: { tenantId: "org-other" },
		});

		expect(scope).toEqual(expect.objectContaining({ kind: "system", systemOperation: "auth.signup.register", tenantId: "org-key", userId: null }));
	});

	it("records the refresh-token subject as the acting user of a route operation", async () => {
		const scope = await scopeFor(testRequest({ user: refreshToken({ sub: "user-9", email: "u@example.com", jti: "jti-1" }) }), { publicOperation: "auth.signup.register" });

		expect(scope).toEqual(expect.objectContaining({ kind: "system", systemOperation: "auth.signup.register", userId: "user-9" }));
	});

	it("refuses a route that declares both a platform and a public operation", async () => {
		await expect(scopeFor(testRequest(), { platformOperation: "audit.http_request.read", publicOperation: "auth.signup.register" })).rejects.toBeInstanceOf(
			ConflictingRouteOperationError,
		);
	});

	it("records no system operation for a superadmin with no named platform route", async () => {
		const requestContext = new RequestContextService();
		const interceptor = await interceptorFor(requestContext);
		const context = createHttpContext(testRequest({ user: accessToken({ isSuperAdmin: true }) }), {});

		const recorded = await requestContext.run({ correlationId: "corr-rls-audit", ip: undefined, userAgent: undefined, edgeLocation: undefined }, async () => {
			await firstValueFrom(interceptor.intercept(context, captureScope));
			return requestContext.current()?.systemOperations;
		});

		expect(recorded).toEqual([]);
	});

	it("records nothing for a non-bypass user scope", async () => {
		const requestContext = new RequestContextService();
		const interceptor = await interceptorFor(requestContext);
		const context = createHttpContext(testRequest({ user: accessToken() }), {});

		const recorded = await requestContext.run({ correlationId: "corr-rls-none", ip: undefined, userAgent: undefined, edgeLocation: undefined }, async () => {
			await firstValueFrom(interceptor.intercept(context, captureScope));
			return requestContext.current()?.systemOperations;
		});

		expect(recorded).toEqual([]);
	});

	it("does not let staff bypass RLS in multi-tenant mode", async () => {
		const scope = await scopeFor(testRequest({ user: accessToken({ hasAdminAccess: true }) }), { env: { TENANCY_ENABLED: "true", DEFAULT_TENANT_ID: undefined } });

		expect(scope?.bypass).toBe(false);
	});

	it("uses only the guard-verified tenant in single-tenant mode too, never the default tenant by itself", async () => {
		// In single mode the guard can only have verified the default tenant (FixedTenantSource); the
		// interceptor binds what was verified and nothing else, exactly as in multi mode.
		const verified = await scopeFor(testRequest({ user: accessToken() }), { verifiedTenant: { tenantId: SINGLE_TENANT_ORG } });
		const tenantless = await scopeFor(testRequest({ user: accessToken() }));

		expect(verified?.tenantId).toBe(SINGLE_TENANT_ORG);
		expect(tenantless?.tenantId).toBeNull();
	});

	it("uses only the guard-verified tenant from the request context in multi-tenant mode, never the raw header", async () => {
		const env: Readonly<Record<string, string | undefined>> = { TENANCY_ENABLED: "true", DEFAULT_TENANT_ID: undefined };

		// No verified tenant: no tenant at all (fail closed) — neither the forged header nor DEFAULT_TENANT_ID.
		const forged = await scopeFor(testRequest({ user: accessToken(), headers: { "x-tenant-id": "org-victim" } }), { env });
		expect(forged?.tenantId).toBeNull();
		// Fail closed through RLS: no tenant means no tenant row, whatever the header claimed.
		expect(forged?.requireExplicitContext).toBe(false);

		const verified = await scopeFor(testRequest({ user: accessToken(), headers: { "x-tenant-id": "org-a" } }), { env, verifiedTenant: { tenantId: "org-a" } });
		expect(verified?.tenantId).toBe("org-a");
	});

	it("refuses to boot single-tenant mode when DEFAULT_TENANT_ID is not a live tenant", async () => {
		await expect(interceptorFor(new RequestContextService(), { DEFAULT_TENANT_ID: "0f0e0d0c-0b0a-4908-8706-050403020100" })).rejects.toBeInstanceOf(DefaultTenantMissingError);
	});

	it("binds an actor whose user-owned scope is exactly the scope the request runs under (one decision)", async () => {
		const cases: readonly { readonly request: TestHttpRequest; readonly options: ScopeOptions }[] = [
			{ request: testRequest({ user: accessToken() }), options: {} },
			{ request: testRequest({ user: accessToken({ isSuperAdmin: true }) }), options: {} },
			{ request: testRequest({ user: accessToken({ hasAdminAccess: true }) }), options: {} },
			{ request: testRequest(), options: {} },
			{ request: testRequest(), options: { verifiedApiKey: { apiKeyId: "key-1", tenantId: "org-key", terminalId: undefined, locationId: null } } },
			{ request: testRequest({ user: refreshToken({ sub: "user-9", email: "u@example.com", jti: "jti-1" }) }), options: {} },
		];
		for (const { request, options } of cases) {
			const { scope, actor } = await scopeAndActorFor(request, options);
			expect(actor?.status).not.toBe("unresolvable");
			if (actor === undefined || actor.status === "unresolvable") {
				throw new Error("the interceptor bound no usable actor");
			}
			// Tenant units of work add only the early "tenant required" refusal on top (TENANT_DATA_SCOPE).
			expect(toRlsContext(actor.actor, USER_OWNED_DATA_SCOPE)).toEqual(scope);
		}
	});
});
