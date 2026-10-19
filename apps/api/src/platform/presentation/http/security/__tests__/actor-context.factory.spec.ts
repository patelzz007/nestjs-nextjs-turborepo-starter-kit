import { describe, expect, it } from "vitest";
import { fastify, type FastifyRequest } from "fastify";
import type { AccessTokenPayload } from "@workspace/shared";
import { AuthenticationError } from "../../../../application/errors/app-error";
import { RequestContextService, type RequestContextSeed } from "../../../../infrastructure/context/request-context";
import { ActorContextFactory } from "../actor-context.factory";
import type { ActorTenancyPolicy } from "../actor-tenancy.policy";

async function captureTestRequest(): Promise<FastifyRequest> {
	const app = fastify({ logger: false });
	const holder: { request?: FastifyRequest } = {};
	app.get("/capture", (request) => {
		holder.request = request;
		return Promise.resolve({});
	});
	await app.ready();
	const response = await app.inject({ method: "GET", url: "/capture" });
	if (response.statusCode !== 200) {
		throw new Error(`Fastify inject failed with status ${String(response.statusCode)}`);
	}
	await app.close();
	if (holder.request === undefined) {
		throw new Error("Fastify did not route the capture request");
	}
	return holder.request;
}

const SEED: RequestContextSeed = {
	correlationId: "corr-actor-1",
	ip: "203.0.113.4",
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
	edgeLocation: undefined,
};

function accessToken(overrides: Partial<AccessTokenPayload> = {}): AccessTokenPayload {
	return {
		sub: "user-1",
		id: "user-1",
		email: "user@example.com",
		fullName: "User One",
		isActive: true,
		isSuperAdmin: false,
		isEmailVerified: true,
		hasAdminAccess: false,
		tokenVersion: 1,
		sid: "session-1",
		...overrides,
	};
}

const MULTI_TENANT: ActorTenancyPolicy = {
	enabled: true,
	staffBypassesRls: false,
	singleTenantOrganizationId: (): string => {
		throw new Error("single-tenant organization is not used when tenancy is enabled");
	},
};

describe("ActorContextFactory", () => {
	const requestContext = new RequestContextService();
	const factory = new ActorContextFactory(requestContext, MULTI_TENANT);

	it("builds a user actor with request metadata", async () => {
		const request = await captureTestRequest();
		Object.defineProperty(request, "user", { value: accessToken(), configurable: true });

		const actor = requestContext.run(SEED, () => {
			requestContext.bindTenant({ organizationId: "org-9" });
			return factory.fromHttpRequest(request);
		});

		expect(actor).toEqual({
			kind: "user",
			userId: "user-1",
			sessionId: "session-1",
			organizationId: "org-9",
			isSuperAdmin: false,
			accessScope: "tenant",
			impersonatorUserId: null,
			request: {
				requestId: "corr-actor-1",
				ip: "203.0.113.4",
				userAgent: SEED.userAgent,
				deviceLabel: "Chrome on macOS",
				endpoint: "/capture",
			},
			routeRlsBypass: false,
		});
	});

	it("builds an impersonating user actor", async () => {
		const request = await captureTestRequest();
		Object.defineProperty(request, "user", {
			value: accessToken({
				isImpersonating: true,
				originalUserId: "admin-1",
				impersonationSessionId: "imp-session-2",
				sid: undefined,
			}),
			configurable: true,
		});

		const actor = requestContext.run(SEED, () => factory.fromHttpRequest(request));

		expect(actor.kind).toBe("user");
		if (actor.kind !== "user") {
			throw new Error("expected user actor");
		}
		expect(actor.impersonatorUserId).toBe("admin-1");
		expect(actor.sessionId).toBe("imp-session-2");
	});

	it("builds an API key actor with a terminal", async () => {
		const request = await captureTestRequest();

		const actor = requestContext.run(SEED, () => {
			requestContext.bindApiKey({
				apiKeyId: "key-1",
				organizationId: "org-1",
				terminalId: "terminal-9",
				locationId: "store-1",
			});
			return factory.fromHttpRequest(request);
		});

		expect(actor).toMatchObject({
			kind: "api_key",
			apiKeyId: "key-1",
			organizationId: "org-1",
			terminalId: "terminal-9",
			locationId: "store-1",
		});
	});

	it("builds an API key actor without a terminal", async () => {
		const request = await captureTestRequest();

		const actor = requestContext.run(SEED, () => {
			requestContext.bindApiKey({
				apiKeyId: "key-2",
				organizationId: "org-2",
				terminalId: undefined,
				locationId: null,
			});
			return factory.fromHttpRequest(request);
		});

		expect(actor).toMatchObject({
			kind: "api_key",
			terminalId: null,
			locationId: null,
		});
	});

	it("returns anonymous when allowed", async () => {
		const request = await captureTestRequest();

		const actor = requestContext.run(SEED, () => factory.fromHttpRequest(request, { allowAnonymous: true }));

		expect(actor).toMatchObject({ kind: "anonymous", organizationId: null });
	});

	it("throws when credentials are missing and anonymous is not allowed", async () => {
		const request = await captureTestRequest();

		expect(() => {
			requestContext.run(SEED, () => {
				factory.fromHttpRequest(request);
			});
		}).toThrow(AuthenticationError);
	});

	it("builds a refresh-token subject actor instead of refusing the caller", async () => {
		const request = await captureTestRequest();
		Object.defineProperty(request, "user", { value: { sub: "user-9", email: "u@example.com", jti: "jti-1", tokenType: "refresh", iat: 1, exp: 2 }, configurable: true });

		const actor = requestContext.run(SEED, () => factory.fromHttpRequest(request));

		expect(actor).toMatchObject({ kind: "token_subject", userId: "user-9", organizationId: null, routeRlsBypass: false });
	});

	it("returns the actor RlsInterceptor bound, with its route bypass, once it is bound", async () => {
		const request = await captureTestRequest();
		Object.defineProperty(request, "user", { value: accessToken(), configurable: true });

		const actor = requestContext.run(SEED, () => {
			requestContext.bindActor(factory.resolve(request, true).actor);
			return factory.fromHttpRequest(request);
		});

		expect(actor).toMatchObject({ kind: "user", userId: "user-1", routeRlsBypass: true });
	});

	it("throws when the user token has no session id", async () => {
		const request = await captureTestRequest();
		Object.defineProperty(request, "user", { value: accessToken({ sid: undefined }), configurable: true });

		expect(() => {
			requestContext.run(SEED, () => {
				factory.fromHttpRequest(request);
			});
		}).toThrow(AuthenticationError);
	});
});
