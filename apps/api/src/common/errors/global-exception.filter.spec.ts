import "reflect-metadata";
import fastifyRateLimit from "@fastify/rate-limit";
import { Body, Controller, Get, HttpStatus, Logger, Module, Post, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { FastifyAdapter, RouteConfig, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { ApiErrorResponseSchema, type JsonValue } from "@workspace/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { rateLimitErrorResponseBuilder } from "../../bootstrap/register-fastify-plugins";
import { AuthorizationException } from "../../modules/authorization/exceptions/authorization.exception";
import { LogService } from "../../modules/logs/logs.service";
import { TypedConfigService } from "../../config/typed-config.service";
import { RequestContextMiddleware } from "../middleware/request-context.middleware";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";
import { ConflictError, DependencyUnavailableError } from "./app-error";
import { GlobalExceptionFilter } from "./global-exception.filter";
import { createTestTypedConfig } from "../../../test/support/test-api-env";
import { RequestContextService } from "../context/request-context";

const CreateThingSchema = z.object({ name: z.string().min(1), quantity: z.number().int() }).strict();

/** Bodies the probe routes throw or return. */
class ProbeController {
	public ok(): { ok: boolean } {
		return { ok: true };
	}

	public appError(): void {
		throw new ConflictError({ code: "EMAIL_TAKEN", message: "Email already in use", details: { field: "email" } });
	}

	public forbidden(): void {
		throw new AuthorizationException();
	}

	public boom(): void {
		throw new Error("connection string postgres://user:secret@db/app leaked");
	}

	public duplicate(): void {
		throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`email`)", { code: "P2002", clientVersion: "7.0.0" });
	}

	public validate(body: JsonValue): JsonValue {
		return body;
	}

	public limited(): { ok: boolean } {
		return { ok: true };
	}

	public unavailable(): void {
		throw new DependencyUnavailableError({ message: "The API is not ready to serve traffic." });
	}
}

class ProbeModule implements NestModule {
	public configure(consumer: MiddlewareConsumer): void {
		consumer.apply(RequestContextMiddleware).forRoutes("*");
	}
}

// Decorators applied as calls — the unit-test transformer does not compile decorator syntax.
function route(decorator: MethodDecorator, method: keyof ProbeController): void {
	const descriptor = Object.getOwnPropertyDescriptor(ProbeController.prototype, method);
	if (descriptor === undefined) {
		throw new Error(`Missing probe method ${method}`);
	}
	decorator(ProbeController.prototype, method, descriptor);
}
route(Get("ok"), "ok");
route(Get("app-error"), "appError");
route(Get("forbidden"), "forbidden");
route(Get("boom"), "boom");
route(Get("duplicate"), "duplicate");
route(Post("validate"), "validate");
route(Get("limited"), "limited");
route(Get("unavailable"), "unavailable");
route(RouteConfig({ rateLimit: { max: 1, timeWindow: "1 minute" } }), "limited");
Body(new ZodValidationPipe(CreateThingSchema))(ProbeController.prototype, "validate", 0);
Controller("probe")(ProbeController);
Module({ controllers: [ProbeController], providers: [RequestContextService, { provide: TypedConfigService, useValue: createTestTypedConfig() }] })(ProbeModule);

describe("GlobalExceptionFilter (Fastify integration)", () => {
	let app: NestFastifyApplication;
	const logService = new LogService(createTestTypedConfig(), new RequestContextService());
	// Spy WITHOUT replacing LogService.error so its option validation really runs
	// (a strict-schema bug there once made every error log throw); only the
	// underlying Nest logger is silenced.
	const errorLog = vi.spyOn(logService, "error");
	const warnLog = vi.spyOn(logService, "warn");
	vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
	vi.spyOn(Logger.prototype, "warn").mockImplementation((): void => undefined);

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter({ bodyLimit: 64 }));
		await app.getHttpAdapter().getInstance().register(fastifyRateLimit, { global: false, errorResponseBuilder: rateLimitErrorResponseBuilder });
		app.useGlobalFilters(new GlobalExceptionFilter(app.get(HttpAdapterHost), logService, new RequestContextService(), createTestTypedConfig()));
		await app.init();
		await app.getHttpAdapter().getInstance().ready();
	});

	afterAll(async () => {
		await app.close();
	});

	afterEach(() => {
		errorLog.mockClear();
		warnLog.mockClear();
	});

	it("logs an expected (typed) 5xx at warn without a stack, keeping its safe message", async () => {
		const response = await app.inject({ method: "GET", url: "/probe/unavailable" });

		expect(response.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
		expect(envelopeOf(response.body).error).toEqual({ code: "SERVICE_UNAVAILABLE", message: "The API is not ready to serve traffic." });
		expect(errorLog).not.toHaveBeenCalled();
		expect(warnLog).toHaveBeenCalledTimes(1);
		expect(warnLog.mock.calls[0]?.[1]).not.toHaveProperty("trace");
	});

	/** Parse and schema-check the error envelope of a response body. */
	function envelopeOf(body: string): z.output<typeof ApiErrorResponseSchema> {
		return ApiErrorResponseSchema.parse(JSON.parse(body));
	}

	it("leaves successful responses untouched", async () => {
		const response = await app.inject({ method: "GET", url: "/probe/ok" });

		expect(response.statusCode).toBe(HttpStatus.OK);
		expect(response.json()).toEqual({ ok: true });
	});

	it("serializes an AppError with its code, message, details and the correlation id", async () => {
		const response = await app.inject({ method: "GET", url: "/probe/app-error", headers: { "x-correlation-id": "corr-123" } });

		expect(response.statusCode).toBe(HttpStatus.CONFLICT);
		const envelope = envelopeOf(response.body);
		expect(envelope.success).toBe(false);
		expect(envelope.error).toEqual({ code: "EMAIL_TAKEN", message: "Email already in use", details: { field: "email" } });
		expect(envelope.meta.correlationId).toBe("corr-123");
		expect(envelope.meta.timestamp).toBeGreaterThan(0);
		expect(errorLog).not.toHaveBeenCalled();
	});

	it("ignores an unsafe incoming correlation id and uses one generated id for header, envelope and logs", async () => {
		const unsafe = "corr with spaces\ninjected";
		const response = await app.inject({ method: "GET", url: "/probe/boom", headers: { "x-correlation-id": unsafe } });

		const envelope = envelopeOf(response.body);
		expect(envelope.meta.correlationId).not.toContain("corr with spaces");
		expect(envelope.meta.correlationId).toMatch(/^[A-Za-z0-9._:-]{1,64}$/);
		expect(response.headers["x-correlation-id"]).toBe(envelope.meta.correlationId);
		expect(errorLog.mock.calls[0]?.[1]?.metadata).toMatchObject({ correlationId: envelope.meta.correlationId });
	});

	it("rejects an over-long incoming correlation id (max 64 characters)", async () => {
		const tooLong = "a".repeat(65);
		const response = await app.inject({ method: "GET", url: "/probe/app-error", headers: { "x-correlation-id": tooLong } });

		const envelope = envelopeOf(response.body);
		expect(envelope.meta.correlationId).not.toBe(tooLong);
		expect(envelope.meta.correlationId.length).toBeLessThanOrEqual(64);
		expect(response.headers["x-correlation-id"]).toBe(envelope.meta.correlationId);
	});

	it("keeps the same correlation id for failures raised before the handler (oversized body)", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/probe/validate",
			headers: { "x-correlation-id": "corr-413" },
			payload: { name: "x".repeat(200), quantity: 1 },
		});

		expect(response.statusCode).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
		expect(envelopeOf(response.body).meta.correlationId).toBe("corr-413");
	});

	it("maps AuthorizationException to 403 PERMISSION_DENIED", async () => {
		const response = await app.inject({ method: "GET", url: "/probe/forbidden" });

		expect(response.statusCode).toBe(HttpStatus.FORBIDDEN);
		expect(envelopeOf(response.body).error.code).toBe("PERMISSION_DENIED");
	});

	it("maps validation-pipe failures to 400 VALIDATION_ERROR with issues", async () => {
		const response = await app.inject({ method: "POST", url: "/probe/validate", payload: { name: "", quantity: "many" } });

		expect(response.statusCode).toBe(HttpStatus.BAD_REQUEST);
		const envelope = envelopeOf(response.body);
		expect(envelope.error.code).toBe("VALIDATION_ERROR");
		expect(envelope.error.details?.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: "name" }), expect.objectContaining({ path: "quantity" })]));
	});

	it("maps malformed JSON bodies to 400 without echoing parser internals", async () => {
		const response = await app.inject({ method: "POST", url: "/probe/validate", headers: { "content-type": "application/json" }, payload: "{bad json" });

		expect(response.statusCode).toBe(HttpStatus.BAD_REQUEST);
		expect(envelopeOf(response.body).error.code).toBe("BAD_REQUEST");
	});

	it("maps oversized bodies to 413 PAYLOAD_TOO_LARGE", async () => {
		const response = await app.inject({ method: "POST", url: "/probe/validate", payload: { name: "x".repeat(200), quantity: 1 } });

		expect(response.statusCode).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
		expect(envelopeOf(response.body).error.code).toBe("PAYLOAD_TOO_LARGE");
	});

	it("maps unknown routes to 404 NOT_FOUND", async () => {
		const response = await app.inject({ method: "GET", url: "/probe/missing" });

		expect(response.statusCode).toBe(HttpStatus.NOT_FOUND);
		expect(envelopeOf(response.body).error.code).toBe("NOT_FOUND");
	});

	it("maps Prisma P2002 to 409 CONFLICT without leaking column names", async () => {
		const response = await app.inject({ method: "GET", url: "/probe/duplicate" });

		expect(response.statusCode).toBe(HttpStatus.CONFLICT);
		expect(envelopeOf(response.body).error.code).toBe("CONFLICT");
		expect(response.body).not.toContain("email");
	});

	it("answers unexpected errors with a generic 500 and logs the full error server-side", async () => {
		const response = await app.inject({ method: "GET", url: "/probe/boom", headers: { "x-correlation-id": "corr-500" } });

		expect(response.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
		const envelope = envelopeOf(response.body);
		expect(envelope.error.code).toBe("INTERNAL_ERROR");
		expect(response.body).not.toContain("secret");
		expect(response.body).not.toContain("at ");

		expect(errorLog).toHaveBeenCalledTimes(1);
		const [message, options] = errorLog.mock.calls[0] ?? [];
		expect(message).toContain("GET /probe/boom failed with 500 INTERNAL_ERROR");
		expect(options?.metadata).toMatchObject({ correlationId: "corr-500", httpStatus: 500, errorCode: "INTERNAL_ERROR", errorName: "Error" });
		expect(options?.trace).toContain("boom");
	});

	it("turns @fastify/rate-limit rejections into 429 RATE_LIMITED with Retry-After", async () => {
		const first = await app.inject({ method: "GET", url: "/probe/limited" });
		const second = await app.inject({ method: "GET", url: "/probe/limited" });

		expect(first.statusCode).toBe(HttpStatus.OK);
		expect(second.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
		const envelope = envelopeOf(second.body);
		expect(envelope.error.code).toBe("RATE_LIMITED");
		expect(Object.keys(envelope.error.details ?? {})).toEqual(["retryAfterSeconds"]);
		expect(envelope.error.details).toHaveProperty("retryAfterSeconds", expect.any(Number));
		expect(Number(second.headers["retry-after"])).toBeGreaterThan(0);
	});
});

describe("GlobalExceptionFilter.buildEnvelope", () => {
	it("degrades to a generic INTERNAL_ERROR envelope when the mapping is not schema-valid", () => {
		const envelope = GlobalExceptionFilter.buildEnvelope({ httpStatus: HttpStatus.BAD_REQUEST, code: "not a valid code", message: "x", details: undefined }, "corr-1");

		expect(envelope.error.code).toBe("INTERNAL_ERROR");
		expect(envelope.meta.correlationId).toBe("corr-1");
	});

	it("omits `details` when there are none", () => {
		const envelope = GlobalExceptionFilter.buildEnvelope({ httpStatus: HttpStatus.NOT_FOUND, code: "NOT_FOUND", message: "Nope", details: undefined }, "corr-2");

		expect(envelope.error).toEqual({ code: "NOT_FOUND", message: "Nope" });
	});
});
