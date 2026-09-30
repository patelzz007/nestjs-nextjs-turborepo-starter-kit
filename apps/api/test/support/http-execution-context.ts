import "reflect-metadata";
import type { ExecutionContext } from "@nestjs/common";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import type { AccessTokenPayload, RefreshTokenPayload } from "@workspace/shared";

/** Minimal Fastify-like request used by guard / interceptor unit tests. */
export interface TestHttpRequest {
	user?: AccessTokenPayload | RefreshTokenPayload;
	params: Record<string, string>;
	query: Record<string, string>;
	body?: Record<string, string | number | boolean>;
	headers: Record<string, string>;
	ip: string;
	id: string;
	method: string;
	url: string;
	authorizationContext?: { readonly organizationId?: string; readonly locationId?: string };
}

/** Route metadata applied to the test handler (what decorators would set). */
export type TestRouteMetadata = Readonly<Record<string, object | boolean>>;

export function testRequest(overrides: Partial<TestHttpRequest> = {}): TestHttpRequest {
	return {
		params: {},
		query: {},
		headers: { "user-agent": "vitest", "x-correlation-id": "corr-1" },
		ip: "127.0.0.1",
		id: "req-1",
		method: "POST",
		url: "/api/v1/test",
		...overrides,
	};
}

export function accessToken(overrides: Partial<AccessTokenPayload> = {}): AccessTokenPayload {
	return {
		sub: "user-1",
		id: "user-1",
		email: "user@example.com",
		fullName: "Test User",
		isActive: true,
		isSuperAdmin: false,
		isEmailVerified: true,
		hasAdminAccess: false,
		tokenVersion: 1,
		...overrides,
	};
}

/**
 * Real Nest `ExecutionContext` for an HTTP request whose handler carries the
 * given metadata — so `Reflector` resolves it exactly as for decorated routes.
 */
export function createHttpContext(request: TestHttpRequest, metadata: TestRouteMetadata = {}): ExecutionContext {
	class TestController {}
	function testHandler(): void {}
	for (const [key, value] of Object.entries(metadata)) {
		Reflect.defineMetadata(key, value, testHandler);
	}
	return new ExecutionContextHost([request, {}, (): void => {}], TestController, testHandler);
}
