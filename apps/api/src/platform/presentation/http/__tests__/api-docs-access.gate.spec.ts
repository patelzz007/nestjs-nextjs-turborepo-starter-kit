import { describe, expect, it, vi } from "vitest";
import { fastify, type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import { ApiErrorResponseSchema, apiDocsPath, type AccessTokenPayload } from "@workspace/shared";

import { accessToken } from "../../../../../e2e/support/http-execution-context";
import { ApiDocsAccessGate, isApiDocsPath, isApiDocsRequest, type ApiDocsViewerVerifier } from "../api-docs-access.gate";

/** A verifier whose token store knows two tokens: a SuperAdmin's and a regular admin's. */
function verifier(): ApiDocsViewerVerifier {
	const payloadFor = (isSuperAdmin: boolean): AccessTokenPayload => accessToken({ sub: isSuperAdmin ? "super-1" : "admin-1", isSuperAdmin, tokenVersion: 1 });
	return {
		tokens: {
			verifyAccessToken: vi.fn((token: string): Promise<AccessTokenPayload> => {
				if (token === "super-token") return Promise.resolve(payloadFor(true));
				if (token === "admin-token") return Promise.resolve(payloadFor(false));
				return Promise.reject(new Error("invalid token"));
			}),
		},
		tokenState: { assertTokenValid: vi.fn((): Promise<void> => Promise.resolve()) },
	};
}

async function appWithGate(): Promise<FastifyInstance> {
	const app = fastify();
	await app.register(fastifyCookie);
	app.addHook("onRequest", new ApiDocsAccessGate(verifier()).onRequest);
	app.get(apiDocsPath(), () => ({ docs: true }));
	app.get(`${apiDocsPath()}-json`, () => ({ openapi: "3.1.0" }));
	app.get("/api/v1/health", () => ({ ok: true }));
	return app;
}

/** A request that matched no route, as an `onRequest` hook sees an unknown path. */
function unrouted(url: string): { readonly url: string; readonly routeOptions: { readonly url: undefined } } {
	return { url, routeOptions: { url: undefined } };
}

describe("isApiDocsPath", () => {
	it("matches the UI, the document, assets and the legacy redirect — nothing else", () => {
		expect([apiDocsPath(), `${apiDocsPath()}-json`, `${apiDocsPath()}/swagger-ui.css`, "/docs"].map(isApiDocsPath)).toEqual([true, true, true, true]);
		expect(["/api/v1/docsearch", "/api/v1/health", "/documents"].map(isApiDocsPath)).toEqual([false, false, false]);
	});
});

describe("isApiDocsRequest", () => {
	it("decides on the matched route template, whatever the raw target looks like", () => {
		expect(isApiDocsRequest({ url: "/v1/%64ocs-json", routeOptions: { url: `${apiDocsPath()}-json` } })).toBe(true);
		expect(isApiDocsRequest({ url: "/api/v1/health", routeOptions: { url: "/api/v1/health" } })).toBe(false);
	});

	it("decodes an unrouted target before matching, and treats an undecodable one as a docs request (fail closed)", () => {
		expect(isApiDocsRequest(unrouted("/docs?x=1"))).toBe(true);
		expect(isApiDocsRequest(unrouted("/%64ocs"))).toBe(true);
		expect(isApiDocsRequest(unrouted("/docs#fragment"))).toBe(true);
		expect(isApiDocsRequest(unrouted("/api/v1/%zz"))).toBe(true);
		expect(isApiDocsRequest(unrouted("/api/v1/health"))).toBe(false);
	});
});

describe("ApiDocsAccessGate (production)", () => {
	it("answers 401 to an anonymous caller for the UI and the document", async () => {
		const app = await appWithGate();
		for (const url of [apiDocsPath(), `${apiDocsPath()}-json`]) {
			const response = await app.inject({ method: "GET", url });
			expect(response.statusCode).toBe(401);
			expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe("UNAUTHORIZED");
		}
		await app.close();
	});

	it("answers 401 for an invalid token and 403 for a non-SuperAdmin", async () => {
		const app = await appWithGate();
		expect((await app.inject({ method: "GET", url: apiDocsPath(), headers: { authorization: "Bearer forged" } })).statusCode).toBe(401);
		expect((await app.inject({ method: "GET", url: apiDocsPath(), cookies: { adminAccessToken: "admin-token" } })).statusCode).toBe(403);
		await app.close();
	});

	// docs/history/SECURITY-AUDIT-2026-10-25 finding 1: the router percent-decodes the path, so the gate must too.
	it("gates percent-encoded, double-dash-encoded and fragment-bearing spellings of the docs routes", async () => {
		const app = await appWithGate();
		const docs = apiDocsPath();
		const encodedFirstLetter = docs.replace(
			/\/(?<letter>[a-z])(?<rest>[^/]*)$/u,
			(_match: string, letter: string, rest: string): string => `/%${letter.charCodeAt(0).toString(16)}${rest}`,
		);
		for (const url of [`${encodedFirstLetter}-json`, `${docs}%2djson`, `${docs}%2Djson`, encodedFirstLetter, `${docs}-json#x`, `${docs}-json?x=1`]) {
			const response = await app.inject({ method: "GET", url });
			expect({ url, status: response.statusCode }).toEqual({ url, status: 401 });
		}
		await app.close();
	});

	it("serves the docs to a SuperAdmin (admin cookie or Bearer) and never gates other routes", async () => {
		const app = await appWithGate();
		expect((await app.inject({ method: "GET", url: apiDocsPath(), cookies: { adminAccessToken: "super-token" } })).statusCode).toBe(200);
		expect((await app.inject({ method: "GET", url: `${apiDocsPath()}-json`, headers: { authorization: "Bearer super-token" } })).statusCode).toBe(200);
		expect((await app.inject({ method: "GET", url: "/api/v1/health" })).statusCode).toBe(200);
		await app.close();
	});
});
