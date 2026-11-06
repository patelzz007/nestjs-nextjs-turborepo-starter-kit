import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { accessToken, createHttpContext, testRequest } from "../../../../../../../e2e/support/http-execution-context";
import { ALLOW_RESTRICTED_SESSION_KEY, RestrictedSessionGuard } from "../restricted-session.guard";

const guard = new RestrictedSessionGuard(new Reflector());
const restricted = accessToken({ sessionScope: "restricted", isEmailVerified: false });

/** Whether a restricted session may reach `method url`, which Fastify routed to `template`. */
function allows(method: string, url: string, template: string | undefined): boolean {
	try {
		return guard.canActivate(createHttpContext(testRequest({ method, url, routeOptions: { url: template }, user: restricted })));
	} catch (error: unknown) {
		if (error instanceof ForbiddenException) {
			return false;
		}
		throw error;
	}
}

describe("RestrictedSessionGuard", () => {
	it("lets a restricted session reach the enrollment allowlist", () => {
		expect(allows("GET", "/api/v1/auth/me", "/api/v1/auth/me")).toBe(true);
		expect(allows("POST", "/api/v1/auth/2fa/enable", "/api/v1/auth/2fa/enable")).toBe(true);
		expect(allows("GET", "/api/v1/files/0193f2c4-0000-7000-8000-0000000000aa", "/api/v1/files/:fileId")).toBe(true);
		expect(allows("POST", "/api/v1/files/0193f2c4-0000-7000-8000-0000000000aa/complete", "/api/v1/files/:fileId/complete")).toBe(true);
	});

	it("refuses every other route with RESTRICTED_SESSION", () => {
		expect(() =>
			guard.canActivate(createHttpContext(testRequest({ method: "GET", url: "/api/v1/admin/users", routeOptions: { url: "/api/v1/admin/users" }, user: restricted }))),
		).toThrow(ForbiddenException);
	});

	// docs/history/SECURITY-AUDIT-2026-10-25 finding 2: Fastify drops the fragment (and the query) before routing, so the
	// raw target's tail must never decide.
	it("decides on the routed template, so a fragment or query naming an allowlisted route changes nothing", () => {
		expect(allows("GET", "/api/v1/admin/users#/merchant/me", "/api/v1/admin/users")).toBe(false);
		expect(allows("GET", "/api/v1/admin/users#/files/0193f2c4-0000-7000-8000-0000000000aa", "/api/v1/admin/users")).toBe(false);
		expect(allows("GET", "/api/v1/admin/users?x=/auth/me", "/api/v1/admin/users")).toBe(false);
		expect(allows("POST", "/api/v1/admin/users#/files/x/complete", "/api/v1/admin/users")).toBe(false);
	});

	it("never allowlists a request no route matched", () => {
		expect(allows("GET", "/api/v1/auth/me", undefined)).toBe(false);
	});

	it("leaves full sessions and routes marked for restricted sessions alone", () => {
		const full = accessToken({ sessionScope: "full" });
		expect(guard.canActivate(createHttpContext(testRequest({ method: "GET", url: "/api/v1/admin/users", routeOptions: { url: "/api/v1/admin/users" }, user: full })))).toBe(
			true,
		);
		expect(
			guard.canActivate(
				createHttpContext(testRequest({ method: "GET", url: "/api/v1/x", routeOptions: { url: "/api/v1/x" }, user: restricted }), { [ALLOW_RESTRICTED_SESSION_KEY]: true }),
			),
		).toBe(true);
	});
});
