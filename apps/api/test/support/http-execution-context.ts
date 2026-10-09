import "reflect-metadata";
import { IncomingMessage } from "node:http";
import { Socket } from "node:net";

import type { ExecutionContext } from "@nestjs/common";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import type { AccessTokenPayload, RefreshTokenPayload } from "@workspace/shared";

/** Minimal Fastify-like request used by guard / interceptor unit tests. */
export interface TestHttpRequest {
	user?: AccessTokenPayload | RefreshTokenPayload | undefined;
	params: Record<string, string>;
	query: Record<string, string>;
	body?: Record<string, string | number | boolean>;
	headers: Record<string, string>;
	ip: string;
	id: string;
	method: string;
	url: string;
	/** The raw Node request (what Fastify exposes as `request.raw`), with the same headers. */
	raw: IncomingMessage;
}

/** Route metadata applied to the test handler (what decorators would set). */
export type TestRouteMetadata = Readonly<Record<string, object | boolean>>;

function rawRequest(headers: Record<string, string>): IncomingMessage {
	const raw = new IncomingMessage(new Socket());
	raw.headers = { ...headers };
	return raw;
}

export function testRequest(overrides: Partial<TestHttpRequest> = {}): TestHttpRequest {
	const headers: Record<string, string> = overrides.headers ?? { "user-agent": "vitest", "x-correlation-id": "corr-1" };
	return {
		params: {},
		query: {},
		headers,
		ip: "127.0.0.1",
		id: "req-1",
		method: "POST",
		url: "/api/v1/test",
		raw: rawRequest(headers),
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

/** A refresh-token payload, shaped exactly as `RefreshTokenPayloadSchema` outputs it. */
export function refreshToken(overrides: Partial<RefreshTokenPayload> = {}): RefreshTokenPayload {
	return {
		sub: "user-1",
		email: "user@example.com",
		jti: "jti-1",
		tokenType: "refresh",
		iat: 1_700_000_000,
		exp: 1_700_000_060,
		...overrides,
	};
}

/**
 * Real Nest `ExecutionContext` for an HTTP request whose handler carries the
 * given metadata — so `Reflector` resolves it exactly as for decorated routes.
 * `reply` is what `switchToHttp().getResponse()` returns (e.g. a cookie-recording fake).
 */
export function createHttpContext(request: TestHttpRequest, metadata: TestRouteMetadata = {}, reply: object = {}): ExecutionContext {
	class TestController {}
	function testHandler(): void {}
	for (const [key, value] of Object.entries(metadata)) {
		Reflect.defineMetadata(key, value, testHandler);
	}
	return new ExecutionContextHost([request, reply, (): void => {}], TestController, testHandler);
}
