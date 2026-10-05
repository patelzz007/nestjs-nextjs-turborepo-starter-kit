import { describe, expect, it } from "vitest";

import { hasRouteSession, shouldAttemptProxyRefresh, type ProxyRefreshTriggerContext } from "./proxy-refresh";

const AUTH_ROUTE_CONTEXT: ProxyRefreshTriggerContext = {
	accessToken: undefined,
	refreshToken: undefined,
	isDocumentNavigation: true,
	isAuthRoute: true,
	isPublicRoute: false,
	tokenAuthRoute: false,
};

describe("hasRouteSession", () => {
	it("treats a request with a refresh-token cookie as a recoverable session", () => {
		expect(hasRouteSession("refresh-token")).toBe(true);
	});

	it("treats a request without a refresh-token cookie as signed out (an orphaned access token alone never counts)", () => {
		expect(hasRouteSession(undefined)).toBe(false);
	});
});

describe("shouldAttemptProxyRefresh on auth routes", () => {
	it("refreshes when a refresh token is present, so a revoked session is caught before the login-page bounce", () => {
		expect(shouldAttemptProxyRefresh({ ...AUTH_ROUTE_CONTEXT, accessToken: "access-token", refreshToken: "refresh-token" })).toBe(true);
	});

	it("does not refresh with only an orphaned access token", () => {
		expect(shouldAttemptProxyRefresh({ ...AUTH_ROUTE_CONTEXT, accessToken: "access-token" })).toBe(false);
	});

	it("does not refresh on one-shot token-auth routes even with a refresh token", () => {
		expect(shouldAttemptProxyRefresh({ ...AUTH_ROUTE_CONTEXT, refreshToken: "refresh-token", tokenAuthRoute: true })).toBe(false);
	});
});
