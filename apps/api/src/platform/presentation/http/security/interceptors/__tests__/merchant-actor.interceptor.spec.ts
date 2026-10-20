import type { CallHandler } from "@nestjs/common";
import { lastValueFrom, of } from "rxjs";
import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";

import { createHttpContext, testRequest } from "../../../../../../../test/support/http-execution-context";
import type { MerchantTenantResolverPort } from "../../../../../application/ports/merchant-tenant-resolver.port";
import { getMerchantActorFromRequest, setApiKeyAuthOnRequest } from "../../api-keys/api-key-request";
import { MerchantActorInterceptor } from "../merchant-actor.interceptor";

/** Resolves members of exactly one tenant slug, recording what it was asked. */
function tenants(): MerchantTenantResolverPort & { readonly asked: string[] } {
	const asked: string[] = [];
	return {
		asked,
		tenantIdForMember: (userId: string, tenantSlug: string): Promise<string> => {
			asked.push(`${userId}@${tenantSlug}`);
			return tenantSlug === "brew-bean" ? Promise.resolve("org-1") : Promise.reject(new Error("not a member"));
		},
	};
}

const NEXT: CallHandler<string> = { handle: () => of("handled") };

describe("MerchantActorInterceptor", () => {
	it("resolves a member's tenant from the route's slug through their membership", async () => {
		const resolver = tenants();
		const context = createHttpContext(Object.assign(testRequest({ params: { tenantSlug: "brew-bean" } }), { user: { sub: "member-1", id: "member-1", isSuperAdmin: false } }));

		await expect(lastValueFrom(new MerchantActorInterceptor(resolver).intercept(context, NEXT))).resolves.toBe("handled");

		expect(getMerchantActorFromRequest(context.switchToHttp().getRequest<FastifyRequest>())).toEqual({
			kind: "user",
			userId: "member-1",
			tenantId: "org-1",
			tenantSlug: "brew-bean",
		});
		expect(resolver.asked).toEqual(["member-1@brew-bean"]);
	});

	it("takes a verified key's own tenant, never consulting the slug", async () => {
		const resolver = tenants();
		const context = createHttpContext(testRequest({ params: { tenantSlug: "someone-else" } }));
		const request = context.switchToHttp().getRequest<FastifyRequest>();
		setApiKeyAuthOnRequest(request, {
			provider: "merchant",
			apiKeyId: "key-1",
			tenantId: "org-9",
			locationId: "store-a",
			terminal: null,
			requireRegisteredTerminals: false,
			scope: "INTEGRATION",
			capabilities: [],
		});

		await lastValueFrom(new MerchantActorInterceptor(resolver).intercept(context, NEXT));

		expect(getMerchantActorFromRequest(request)).toEqual({ kind: "api_key", tenantId: "org-9", apiKeyId: "key-1", keyScope: "INTEGRATION", keyLocationId: "store-a" });
		expect(resolver.asked).toEqual([]);
	});

	it("leaves a member's malformed slug to the route's params pipe (400), never looking it up", async () => {
		const resolver = tenants();
		const context = createHttpContext(
			Object.assign(testRequest({ params: { tenantSlug: "Not A Slug!" } }), { user: { sub: "member-1", id: "member-1", isSuperAdmin: false } }),
		);

		await expect(lastValueFrom(new MerchantActorInterceptor(resolver).intercept(context, NEXT))).resolves.toBe("handled");

		expect(getMerchantActorFromRequest(context.switchToHttp().getRequest<FastifyRequest>())).toBeUndefined();
		expect(resolver.asked).toEqual([]);
	});

	it("refuses a caller with neither a key nor a session, and a member without a slug", async () => {
		const interceptor = new MerchantActorInterceptor(tenants());

		await expect(lastValueFrom(interceptor.intercept(createHttpContext(testRequest({ params: { tenantSlug: "brew-bean" } })), NEXT))).rejects.toMatchObject({
			response: { error: "TENANT_AUTH_REQUIRED" },
		});
		await expect(
			lastValueFrom(interceptor.intercept(createHttpContext(Object.assign(testRequest({}), { user: { sub: "member-1", id: "member-1", isSuperAdmin: false } })), NEXT)),
		).rejects.toMatchObject({
			response: { error: "TENANT_SLUG_REQUIRED" },
		});
	});
});
