import "reflect-metadata";
import { IncomingMessage } from "node:http";
import { Socket } from "node:net";

import { Controller, Get, Injectable, Module, Post, type CanActivate, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../test/support/test-api-env";
import { TypedConfigService } from "../../config/typed-config.service";
import { RequestContextService, type RequestContext } from "../context/request-context";
import { MAX_USER_AGENT_LENGTH, readUserAgent, RequestContextMiddleware, resolveClientIp } from "./request-context.middleware";

const requestContext = new RequestContextService();

/** What the guard (runs before interceptors/handlers) and the handler saw. */
const observed: { guard: RequestContext | undefined; handler: RequestContext | undefined } = { guard: undefined, handler: undefined };

class ContextProbeGuard implements CanActivate {
	public async canActivate(): Promise<boolean> {
		await Promise.resolve();
		observed.guard = requestContext.current();
		requestContext.bindPrincipal({ userId: "user-guard", impersonatorId: undefined });
		return true;
	}
}

class ContextProbeController {
	public read(): { correlationId: string | null } {
		observed.handler = requestContext.current();
		return { correlationId: requestContext.correlationId() ?? null };
	}

	public write(): { correlationId: string | null } {
		observed.handler = requestContext.current();
		return { correlationId: requestContext.correlationId() ?? null };
	}
}

class ContextProbeModule implements NestModule {
	public configure(consumer: MiddlewareConsumer): void {
		consumer.apply(RequestContextMiddleware).forRoutes("*");
	}
}

// Decorators applied as calls — the unit-test transformer does not compile decorator syntax.
Injectable()(ContextProbeGuard);
const readDescriptor = Object.getOwnPropertyDescriptor(ContextProbeController.prototype, "read");
const writeDescriptor = Object.getOwnPropertyDescriptor(ContextProbeController.prototype, "write");
if (readDescriptor === undefined || writeDescriptor === undefined) {
	throw new Error("probe handlers missing");
}
Get()(ContextProbeController.prototype, "read", readDescriptor);
Post()(ContextProbeController.prototype, "write", writeDescriptor);
Controller("context-probe")(ContextProbeController);
Module({
	controllers: [ContextProbeController],
	providers: [
		{ provide: APP_GUARD, useClass: ContextProbeGuard },
		{ provide: RequestContextService, useValue: requestContext },
		{ provide: TypedConfigService, useValue: createTestTypedConfig() },
	],
})(ContextProbeModule);

describe("RequestContextMiddleware (Fastify integration)", () => {
	let app: NestFastifyApplication;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [ContextProbeModule] }).compile();
		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		await app.init();
		await app.getHttpAdapter().getInstance().ready();
	});

	afterAll(async () => {
		await app.close();
	});

	it("opens the context before guards run and keeps it (enriched) through the handler", async () => {
		const response = await app.inject({ method: "GET", url: "/context-probe", headers: { "x-correlation-id": "corr-mw-1", "user-agent": "probe-agent" } });

		expect(response.json()).toEqual({ correlationId: "corr-mw-1" });
		expect(response.headers["x-correlation-id"]).toBe("corr-mw-1");
		expect(observed.guard).toMatchObject({ correlationId: "corr-mw-1", traceId: "corr-mw-1", userAgent: "probe-agent", principal: undefined });
		expect(observed.handler?.principal).toEqual({ userId: "user-guard", impersonatorId: undefined });
	});

	it("keeps the context across body parsing (POST with a JSON body)", async () => {
		const response = await app.inject({ method: "POST", url: "/context-probe", headers: { "x-request-id": "corr-mw-2" }, payload: { note: "x".repeat(10_000) } });

		expect(response.json()).toEqual({ correlationId: "corr-mw-2" });
		expect(observed.handler?.correlationId).toBe("corr-mw-2");
	});

	it("replaces an invalid incoming id with a generated one and echoes that one", async () => {
		const response = await app.inject({ method: "GET", url: "/context-probe", headers: { "x-correlation-id": "no spaces allowed" } });
		const body: { correlationId: string } = response.json();

		expect(body.correlationId).not.toBe("no spaces allowed");
		expect(body.correlationId).toMatch(/^[A-Za-z0-9._:-]{1,64}$/);
		expect(response.headers["x-correlation-id"]).toBe(body.correlationId);
	});

	it("gives every request its own context", async () => {
		const [first, second] = await Promise.all([app.inject({ method: "GET", url: "/context-probe" }), app.inject({ method: "GET", url: "/context-probe" })]);

		expect(first.headers["x-correlation-id"]).not.toBe(second.headers["x-correlation-id"]);
	});
});

function rawRequest(headers: Record<string, string>, remoteAddress: string): IncomingMessage {
	const socket = new Socket();
	Object.defineProperty(socket, "remoteAddress", { value: remoteAddress });
	const raw = new IncomingMessage(socket);
	raw.headers = headers;
	return raw;
}

describe("resolveClientIp", () => {
	it("uses the socket peer and ignores a client-supplied X-Forwarded-For when the proxy is not trusted", () => {
		expect(resolveClientIp(rawRequest({ "x-forwarded-for": "1.2.3.4" }, "10.0.0.9"), false)).toBe("10.0.0.9");
	});

	it("uses the leftmost X-Forwarded-For hop behind a trusted proxy", () => {
		expect(resolveClientIp(rawRequest({ "x-forwarded-for": "198.51.100.4, 10.0.0.1" }, "10.0.0.9"), true)).toBe("198.51.100.4");
	});

	it("falls back to the socket peer when a trusted proxy sent no X-Forwarded-For", () => {
		expect(resolveClientIp(rawRequest({}, "10.0.0.9"), true)).toBe("10.0.0.9");
	});
});

describe("readUserAgent", () => {
	it("bounds the stored User-Agent", () => {
		expect(readUserAgent(rawRequest({ "user-agent": "u".repeat(MAX_USER_AGENT_LENGTH + 100) }, "10.0.0.9"))).toHaveLength(MAX_USER_AGENT_LENGTH);
		expect(readUserAgent(rawRequest({}, "10.0.0.9"))).toBeUndefined();
	});
});
