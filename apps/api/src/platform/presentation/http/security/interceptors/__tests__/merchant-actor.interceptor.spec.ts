import type { CallHandler } from "@nestjs/common";
import { lastValueFrom, of } from "rxjs";
import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";

import { createHttpContext, testRequest } from "../../../../../../../test/support/http-execution-context";
import type { MerchantOrganizationResolverPort } from "../../../../../application/ports/merchant-organization-resolver.port";
import { getMerchantActorFromRequest, setApiKeyAuthOnRequest } from "../../api-keys/api-key-request";
import { MerchantActorInterceptor } from "../merchant-actor.interceptor";

/** Resolves members of exactly one organization slug, recording what it was asked. */
function organizations(): MerchantOrganizationResolverPort & { readonly asked: string[] } {
	const asked: string[] = [];
	return {
		asked,
		organizationIdForMember: (userId: string, orgSlug: string): Promise<string> => {
			asked.push(`${userId}@${orgSlug}`);
			return orgSlug === "brew-bean" ? Promise.resolve("org-1") : Promise.reject(new Error("not a member"));
		},
	};
}

const NEXT: CallHandler<string> = { handle: () => of("handled") };

describe("MerchantActorInterceptor", () => {
	it("resolves a member's organization from the route's slug through their membership", async () => {
		const resolver = organizations();
		const context = createHttpContext(Object.assign(testRequest({ params: { orgSlug: "brew-bean" } }), { user: { sub: "member-1", id: "member-1", isSuperAdmin: false } }));

		await expect(lastValueFrom(new MerchantActorInterceptor(resolver).intercept(context, NEXT))).resolves.toBe("handled");

		expect(getMerchantActorFromRequest(context.switchToHttp().getRequest<FastifyRequest>())).toEqual({
			kind: "user",
			userId: "member-1",
			organizationId: "org-1",
			orgSlug: "brew-bean",
		});
		expect(resolver.asked).toEqual(["member-1@brew-bean"]);
	});

	it("takes a verified key's own organization, never consulting the slug", async () => {
		const resolver = organizations();
		const context = createHttpContext(testRequest({ params: { orgSlug: "someone-else" } }));
		const request = context.switchToHttp().getRequest<FastifyRequest>();
		setApiKeyAuthOnRequest(request, {
			provider: "merchant",
			apiKeyId: "key-1",
			organizationId: "org-9",
			locationId: "store-a",
			terminal: null,
			requireRegisteredTerminals: false,
			scope: "INTEGRATION",
			capabilities: [],
		});

		await lastValueFrom(new MerchantActorInterceptor(resolver).intercept(context, NEXT));

		expect(getMerchantActorFromRequest(request)).toEqual({ kind: "api_key", organizationId: "org-9", apiKeyId: "key-1", keyScope: "INTEGRATION", keyLocationId: "store-a" });
		expect(resolver.asked).toEqual([]);
	});

	it("leaves a member's malformed slug to the route's params pipe (400), never looking it up", async () => {
		const resolver = organizations();
		const context = createHttpContext(Object.assign(testRequest({ params: { orgSlug: "Not A Slug!" } }), { user: { sub: "member-1", id: "member-1", isSuperAdmin: false } }));

		await expect(lastValueFrom(new MerchantActorInterceptor(resolver).intercept(context, NEXT))).resolves.toBe("handled");

		expect(getMerchantActorFromRequest(context.switchToHttp().getRequest<FastifyRequest>())).toBeUndefined();
		expect(resolver.asked).toEqual([]);
	});

	it("refuses a caller with neither a key nor a session, and a member without a slug", async () => {
		const interceptor = new MerchantActorInterceptor(organizations());

		await expect(lastValueFrom(interceptor.intercept(createHttpContext(testRequest({ params: { orgSlug: "brew-bean" } })), NEXT))).rejects.toMatchObject({
			response: { error: "ORGANIZATION_AUTH_REQUIRED" },
		});
		await expect(
			lastValueFrom(interceptor.intercept(createHttpContext(Object.assign(testRequest({}), { user: { sub: "member-1", id: "member-1", isSuperAdmin: false } })), NEXT)),
		).rejects.toMatchObject({
			response: { error: "ORGANIZATION_SLUG_REQUIRED" },
		});
	});
});
