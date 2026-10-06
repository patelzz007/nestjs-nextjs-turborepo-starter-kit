import "reflect-metadata";
import { Body, Controller, HttpStatus, Logger, Module, Post, SetMetadata, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { APP_GUARD, HttpAdapterHost, Reflector } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { ApiErrorResponseSchema, JsonValueSchema, type JsonObject, type JsonValue } from "@workspace/shared";
import type { FastifyRequest } from "fastify";
import { z } from "zod";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../test/support/test-api-env";
import { AuditLogRepository } from "../../common/audit/audit-log.repository";
import { AuditTrailService } from "../../common/audit/audit-trail.service";
import { RequestContextService } from "../../common/context/request-context";
import { GlobalExceptionFilter } from "../../common/errors/global-exception.filter";
import { readFirstHeader } from "../../common/utils/http-headers";
import { LogService } from "../../modules/logs/logs.service";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { IdempotencyLedgerService } from "./idempotency-ledger.service";
import { IdempotencyRecordRepository, type IdempotencyLease, type IdempotencyRecordKey, type IdempotencyRecordSnapshot } from "./idempotency-record.repository";
import {
	IDEMPOTENCY_IN_PROGRESS_LEASE_MS,
	IDEMPOTENCY_RETENTION_MS,
	IDEMPOTENT_OPTIONS_METADATA,
	IDEMPOTENT_REPLAYED_HEADER,
	type IdempotentOptions,
} from "./idempotency.constants";
import { IdempotencyKeyReusedError, IdempotencyRequestInProgressError } from "./idempotency.errors";
import { IdempotencyInterceptor } from "./idempotency.interceptor";
import { Idempotent } from "./idempotent.decorator";

/** One stored row, plus the fencing token of its current lease. */
interface InMemoryRow extends IdempotencyRecordSnapshot {
	readonly leaseToken: string;
}

/** In-memory stand-in for the Prisma repository, with the same conditional-update (and fencing) semantics. */
class InMemoryIdempotencyRecords extends IdempotencyRecordRepository {
	public readonly rows = new Map<string, InMemoryRow>();

	public constructor() {
		super(new TenantTransactionService(new PrismaService(createTestTypedConfig()), new RequestContextService()));
	}

	private static id(key: IdempotencyRecordKey): string {
		return `${key.scope}|${key.idempotencyKey}`;
	}

	public override tryAcquire(key: IdempotencyRecordKey, lease: IdempotencyLease, leaseExpiresAtEpochMs: number): Promise<boolean> {
		const id: string = InMemoryIdempotencyRecords.id(key);
		if (this.rows.has(id)) {
			return Promise.resolve(false);
		}
		this.rows.set(id, { requestHash: lease.requestHash, leaseToken: lease.token, status: "IN_PROGRESS", responseBody: null, expiresAtEpochMs: leaseExpiresAtEpochMs });
		return Promise.resolve(true);
	}

	public override find(key: IdempotencyRecordKey): Promise<IdempotencyRecordSnapshot | null> {
		return Promise.resolve(this.rows.get(InMemoryIdempotencyRecords.id(key)) ?? null);
	}

	public override takeOverExpired(key: IdempotencyRecordKey, lease: IdempotencyLease, leaseExpiresAtEpochMs: number, nowEpochMs: number): Promise<boolean> {
		const id: string = InMemoryIdempotencyRecords.id(key);
		const row = this.rows.get(id);
		if (row === undefined || row.expiresAtEpochMs > nowEpochMs) {
			return Promise.resolve(false);
		}
		this.rows.set(id, { requestHash: lease.requestHash, leaseToken: lease.token, status: "IN_PROGRESS", responseBody: null, expiresAtEpochMs: leaseExpiresAtEpochMs });
		return Promise.resolve(true);
	}

	public override complete(key: IdempotencyRecordKey, lease: IdempotencyLease, responseBody: JsonObject, retainUntilEpochMs: number, nowEpochMs: number): Promise<boolean> {
		const id: string = InMemoryIdempotencyRecords.id(key);
		const row = this.rows.get(id);
		if (row?.status !== "IN_PROGRESS" || row.leaseToken !== lease.token || row.requestHash !== lease.requestHash || row.expiresAtEpochMs <= nowEpochMs) {
			return Promise.resolve(false);
		}
		this.rows.set(id, { ...row, status: "COMPLETED", responseBody, expiresAtEpochMs: retainUntilEpochMs });
		return Promise.resolve(true);
	}

	public override release(key: IdempotencyRecordKey, lease: IdempotencyLease, nowEpochMs: number): Promise<boolean> {
		const id: string = InMemoryIdempotencyRecords.id(key);
		const row = this.rows.get(id);
		if (row?.status !== "IN_PROGRESS" || row.leaseToken !== lease.token) {
			return Promise.resolve(false);
		}
		this.rows.set(id, { ...row, expiresAtEpochMs: nowEpochMs });
		return Promise.resolve(true);
	}
}

const START_EPOCH_MS = 1_790_812_800_000;

/** The lease `begin` handed out (fails the test when the key was not acquired). */
async function acquire(service: IdempotencyLedgerService, hash: string): Promise<IdempotencyLease> {
	const outcome = await service.begin("s", "key-00000001", hash);
	if (outcome.kind !== "acquired") {
		throw new Error(`expected to acquire the key, got ${outcome.kind}`);
	}
	return outcome.lease;
}

describe("IdempotencyLedgerService", () => {
	let records: InMemoryIdempotencyRecords;
	let service: IdempotencyLedgerService;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(START_EPOCH_MS);
		records = new InMemoryIdempotencyRecords();
		service = new IdempotencyLedgerService(records);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("acquires an unused key with a bounded lease and a fresh fencing token", async () => {
		const lease = await acquire(service, "h1");

		expect(lease.requestHash).toBe("h1");
		expect(lease.token).toMatch(/^[0-9a-f-]{36}$/);
		expect(records.rows.get("s|key-00000001")).toMatchObject({
			status: "IN_PROGRESS",
			leaseToken: lease.token,
			expiresAtEpochMs: START_EPOCH_MS + IDEMPOTENCY_IN_PROGRESS_LEASE_MS,
		});
	});

	it("replays the stored response for an identical completed request", async () => {
		const lease = await acquire(service, "h1");
		await expect(service.complete("s", "key-00000001", lease, { id: "p-1" })).resolves.toBe("stored");

		await expect(service.begin("s", "key-00000001", "h1")).resolves.toEqual({ kind: "replay", responseBody: { id: "p-1" } });
		expect(records.rows.get("s|key-00000001")?.expiresAtEpochMs).toBe(START_EPOCH_MS + IDEMPOTENCY_RETENTION_MS);
	});

	it("round-trips a null response body", async () => {
		const lease = await acquire(service, "h1");
		await service.complete("s", "key-00000001", lease, null);

		await expect(service.begin("s", "key-00000001", "h1")).resolves.toEqual({ kind: "replay", responseBody: null });
	});

	it("rejects the same key with a different request as IDEMPOTENCY_KEY_REUSED (409)", async () => {
		const lease = await acquire(service, "h1");
		await service.complete("s", "key-00000001", lease, { id: "p-1" });

		await expect(service.begin("s", "key-00000001", "h2")).rejects.toBeInstanceOf(IdempotencyKeyReusedError);
	});

	it("rejects a concurrent duplicate as IDEMPOTENCY_REQUEST_IN_PROGRESS (409)", async () => {
		await acquire(service, "h1");

		await expect(service.begin("s", "key-00000001", "h1")).rejects.toBeInstanceOf(IdempotencyRequestInProgressError);
	});

	it("lets the client retry after a failed request released the key", async () => {
		const lease = await acquire(service, "h1");
		await expect(service.release("s", "key-00000001", lease)).resolves.toBe(true);

		await expect(service.begin("s", "key-00000001", "h1")).resolves.toMatchObject({ kind: "acquired" });
	});

	it("frees an abandoned lease once it expires (crashed request)", async () => {
		await acquire(service, "h1");
		vi.setSystemTime(START_EPOCH_MS + IDEMPOTENCY_IN_PROGRESS_LEASE_MS + 1);

		await expect(service.begin("s", "key-00000001", "h1")).resolves.toMatchObject({ kind: "acquired" });
	});

	it("reports in-progress when another contender wins the takeover race", async () => {
		await acquire(service, "h1");
		vi.setSystemTime(START_EPOCH_MS + IDEMPOTENCY_IN_PROGRESS_LEASE_MS + 1);
		vi.spyOn(records, "takeOverExpired").mockResolvedValue(false);

		await expect(service.begin("s", "key-00000001", "h1")).rejects.toBeInstanceOf(IdempotencyRequestInProgressError);
	});

	it("acquires the key when the retention job purged the row between the insert attempt and the read", async () => {
		await acquire(service, "h1");
		vi.setSystemTime(START_EPOCH_MS + IDEMPOTENCY_RETENTION_MS + 1);
		const tryAcquire = vi.spyOn(records, "tryAcquire").mockResolvedValueOnce(false);
		vi.spyOn(records, "find").mockImplementationOnce((key: IdempotencyRecordKey): Promise<IdempotencyRecordSnapshot | null> => {
			records.rows.delete(`${key.scope}|${key.idempotencyKey}`);
			return Promise.resolve(null);
		});

		await expect(service.begin("s", "key-00000001", "h2")).resolves.toMatchObject({ kind: "acquired" });
		expect(tryAcquire).toHaveBeenCalledTimes(2);
		expect(records.rows.get("s|key-00000001")).toMatchObject({ requestHash: "h2", status: "IN_PROGRESS" });
	});

	describe("fencing: a request that outlived its lease can never touch its successor's record", () => {
		it("cannot complete after a retry took the key over — even with the SAME request hash", async () => {
			const stale = await acquire(service, "h1");
			vi.setSystemTime(START_EPOCH_MS + IDEMPOTENCY_IN_PROGRESS_LEASE_MS + 1);
			const successor = await acquire(service, "h1");

			await expect(service.complete("s", "key-00000001", stale, { id: "stale" })).resolves.toBe("lease_lost");
			expect(records.rows.get("s|key-00000001")).toMatchObject({ status: "IN_PROGRESS", leaseToken: successor.token });
		});

		it("cannot release its successor's lease", async () => {
			const stale = await acquire(service, "h1");
			vi.setSystemTime(START_EPOCH_MS + IDEMPOTENCY_IN_PROGRESS_LEASE_MS + 1);
			const successor = await acquire(service, "h1");

			await expect(service.release("s", "key-00000001", stale)).resolves.toBe(false);
			expect(records.rows.get("s|key-00000001")).toMatchObject({
				leaseToken: successor.token,
				expiresAtEpochMs: START_EPOCH_MS + IDEMPOTENCY_IN_PROGRESS_LEASE_MS + 1 + IDEMPOTENCY_IN_PROGRESS_LEASE_MS,
			});
		});

		it("cannot complete once its own lease expired, even before anyone took it over", async () => {
			const lease = await acquire(service, "h1");
			vi.setSystemTime(START_EPOCH_MS + IDEMPOTENCY_IN_PROGRESS_LEASE_MS + 1);

			await expect(service.complete("s", "key-00000001", lease, { id: "late" })).resolves.toBe("lease_lost");
		});
	});
});

// ── HTTP integration: @Idempotent() semantics end to end ────────────────────

/** Controllable handler: counts executions and can be made to fail or block. */
const handlerState: { calls: number; fail: boolean; gate: Promise<void> | null } = { calls: 0, fail: false, gate: null };

const requestContext = new RequestContextService();

/** What the handler answers: its own envelope-like body (the real ResponseInterceptor is outside this harness). */
const ThingResponseSchema = z.object({ id: z.string(), body: JsonValueSchema, meta: z.object({ correlationId: z.string(), timestamp: z.number() }) });

class ThingsController {
	public async create(body: JsonValue): Promise<z.output<typeof ThingResponseSchema>> {
		handlerState.calls += 1;
		if (handlerState.gate !== null) {
			await handlerState.gate;
		}
		if (handlerState.fail) {
			throw new Error("downstream failure");
		}
		return { id: `thing-${String(handlerState.calls)}`, body, meta: { correlationId: requestContext.correlationId() ?? "", timestamp: Date.now() } };
	}

	public createStrict(body: JsonValue): Promise<{ body: JsonValue }> {
		return Promise.resolve({ body });
	}
}

/**
 * Binds what the real guards bind: a user principal (or, with `x-test-api-key`,
 * an API-key principal like the POS guard) and the verified tenant
 * (`x-test-org`, standing in for AuthorizationGuard's verified binding).
 * `x-anonymous` binds nothing.
 */
class FakeAuthGuard implements CanActivate {
	public canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<FastifyRequest>();
		if (request.headers["x-anonymous"] !== undefined) {
			return true;
		}
		const organizationId: string | undefined = readFirstHeader(request.headers["x-test-org"]);
		const apiKeyId: string | undefined = readFirstHeader(request.headers["x-test-api-key"]);
		if (apiKeyId !== undefined) {
			requestContext.bindApiKey({ apiKeyId, organizationId: organizationId ?? "org-pos", terminalId: "T-1", locationId: null });
			return true;
		}
		requestContext.bindPrincipal({ userId: "user-1", impersonatorId: undefined, impersonationSessionId: undefined, authMethod: "SESSION_COOKIE" });
		requestContext.bindTenant({ organizationId });
		return true;
	}
}

class ThingsModule {}

const records = new InMemoryIdempotencyRecords();
const ledger = new IdempotencyLedgerService(records);
const interceptor = new IdempotencyInterceptor(new Reflector(), ledger, requestContext);

// Decorators applied as calls — the unit-test transformer does not compile decorator syntax.
function applyRoute(method: "create" | "createStrict", path: string, options: IdempotentOptions): void {
	const descriptor = Object.getOwnPropertyDescriptor(ThingsController.prototype, method);
	if (descriptor === undefined) {
		throw new Error(`Missing ${method}`);
	}
	Post(path)(ThingsController.prototype, method, descriptor);
	SetMetadata(IDEMPOTENT_OPTIONS_METADATA, options)(ThingsController.prototype, method, descriptor);
	Body()(ThingsController.prototype, method, 0);
}
applyRoute("create", "things", { required: false });
applyRoute("createStrict", "strict-things", { required: true });
Controller()(ThingsController);
Module({ controllers: [ThingsController], providers: [{ provide: APP_GUARD, useValue: new FakeAuthGuard() }] })(ThingsModule);

type InjectResponse = Awaited<ReturnType<NestFastifyApplication["inject"]>>;

describe("@Idempotent() over HTTP (global interceptor)", () => {
	let app: NestFastifyApplication;
	let correlationCounter = 0;

	beforeAll(async () => {
		vi.spyOn(Logger.prototype, "warn").mockImplementation((): void => undefined);
		const moduleRef = await Test.createTestingModule({ imports: [ThingsModule] }).compile();
		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		const config = createTestTypedConfig();
		const auditTrail = new AuditTrailService(new AuditLogRepository(new TenantTransactionService(new PrismaService(config), requestContext)), requestContext);
		vi.spyOn(auditTrail, "recordFailure").mockResolvedValue();
		app.useGlobalFilters(new GlobalExceptionFilter(app.get(HttpAdapterHost), new LogService(requestContext), requestContext, auditTrail, config));
		app.useGlobalInterceptors(interceptor);
		// Opens the request context like RequestContextMiddleware does in the real app.
		app
			.getHttpAdapter()
			.getInstance()
			.addHook("onRequest", (_request, _reply, done): void => {
				correlationCounter += 1;
				requestContext.run({ correlationId: `corr-${String(correlationCounter)}`, ip: undefined, userAgent: undefined, edgeLocation: undefined }, done);
			});
		await app.init();
		await app.getHttpAdapter().getInstance().ready();
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		records.rows.clear();
		handlerState.calls = 0;
		handlerState.fail = false;
		handlerState.gate = null;
		vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(Logger.prototype, "warn").mockImplementation((): void => undefined);
	});

	async function post(url: string, payload: JsonObject, headers: Record<string, string> = {}): Promise<InjectResponse> {
		return app.inject({ method: "POST", url, payload, headers });
	}

	it("runs normally without an Idempotency-Key", async () => {
		await post("/things", { name: "a" });
		await post("/things", { name: "a" });

		expect(handlerState.calls).toBe(2);
	});

	it("replays an identical retry without re-running the handler, with this request's correlation id in meta", async () => {
		const first = await post("/things", { name: "a", qty: 1 }, { "idempotency-key": "key-00000001" });
		const retry = await post("/things", { qty: 1, name: "a" }, { "idempotency-key": "key-00000001" });

		expect(first.statusCode).toBe(HttpStatus.CREATED);
		expect(retry.statusCode).toBe(HttpStatus.CREATED);
		const firstBody = ThingResponseSchema.parse(first.json());
		const retryBody = ThingResponseSchema.parse(retry.json());
		expect(retryBody.id).toBe(firstBody.id);
		expect(retryBody.meta.correlationId).not.toBe(firstBody.meta.correlationId);
		expect(retryBody.meta.correlationId).toBe(`corr-${String(correlationCounter)}`);
		expect(retry.headers[IDEMPOTENT_REPLAYED_HEADER.toLowerCase()]).toBe("true");
		expect(first.headers[IDEMPOTENT_REPLAYED_HEADER.toLowerCase()]).toBeUndefined();
		expect(handlerState.calls).toBe(1);
	});

	it("answers 409 IDEMPOTENCY_KEY_REUSED for a different payload with the same key", async () => {
		await post("/things", { name: "a" }, { "idempotency-key": "key-00000001" });
		const reused = await post("/things", { name: "b" }, { "idempotency-key": "key-00000001" });

		expect(reused.statusCode).toBe(HttpStatus.CONFLICT);
		expect(ApiErrorResponseSchema.parse(reused.json()).error.code).toBe("IDEMPOTENCY_KEY_REUSED");
		expect(handlerState.calls).toBe(1);
	});

	it("answers 409 IDEMPOTENCY_REQUEST_IN_PROGRESS with Retry-After for a concurrent duplicate", async () => {
		let open: () => void = (): void => undefined;
		handlerState.gate = new Promise<void>((resolve: () => void): void => {
			open = resolve;
		});

		const first = post("/things", { name: "a" }, { "idempotency-key": "key-00000001" });
		await vi.waitFor(() => {
			expect(handlerState.calls).toBe(1);
		});
		const duplicate = await post("/things", { name: "a" }, { "idempotency-key": "key-00000001" });
		open();

		expect(duplicate.statusCode).toBe(HttpStatus.CONFLICT);
		expect(ApiErrorResponseSchema.parse(duplicate.json()).error.code).toBe("IDEMPOTENCY_REQUEST_IN_PROGRESS");
		expect(Number(duplicate.headers["retry-after"])).toBeGreaterThan(0);
		expect((await first).statusCode).toBe(HttpStatus.CREATED);
		expect(handlerState.calls).toBe(1);
	});

	it("does not cache handler failures: the key is released and a retry re-executes", async () => {
		handlerState.fail = true;
		const failed = await post("/things", { name: "a" }, { "idempotency-key": "key-00000001" });
		handlerState.fail = false;
		const retried = await post("/things", { name: "a" }, { "idempotency-key": "key-00000001" });

		expect(failed.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
		expect(retried.statusCode).toBe(HttpStatus.CREATED);
		expect(handlerState.calls).toBe(2);
	});

	it("keeps the key (never re-executes) when storing the response fails AFTER the handler succeeded", async () => {
		const error = vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
		vi.spyOn(ledger, "complete").mockRejectedValueOnce(new Error("database unavailable"));

		const first = await post("/things", { name: "a" }, { "idempotency-key": "key-00000001" });
		const retry = await post("/things", { name: "a" }, { "idempotency-key": "key-00000001" });

		expect(first.statusCode).toBe(HttpStatus.CREATED);
		expect(retry.statusCode).toBe(HttpStatus.CONFLICT);
		expect(ApiErrorResponseSchema.parse(retry.json()).error.code).toBe("IDEMPOTENCY_REQUEST_IN_PROGRESS");
		expect(handlerState.calls).toBe(1);
		expect(error).toHaveBeenCalledWith(expect.objectContaining({ event: "idempotency.store_failed", error: "database unavailable" }));
	});

	it("logs loudly when the handler outlived its lease", async () => {
		const error = vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
		vi.spyOn(ledger, "complete").mockResolvedValueOnce("lease_lost");

		const response = await post("/things", { name: "a" }, { "idempotency-key": "key-00000001" });

		expect(response.statusCode).toBe(HttpStatus.CREATED);
		expect(error).toHaveBeenCalledWith(expect.objectContaining({ event: "idempotency.lease_lost" }));
	});

	it("namespaces keys by the verified tenant: the same user and key in another organization runs again", async () => {
		await post("/things", { name: "a" }, { "idempotency-key": "key-00000001", "x-test-org": "org-a" });
		const otherOrg = await post("/things", { name: "a" }, { "idempotency-key": "key-00000001", "x-test-org": "org-b" });

		expect(otherOrg.headers[IDEMPOTENT_REPLAYED_HEADER.toLowerCase()]).toBeUndefined();
		expect(handlerState.calls).toBe(2);
		expect([...records.rows.keys()].sort()).toEqual([
			"http:user:user-1|org:org-a:store:-:loc:-|POST /things|key-00000001",
			"http:user:user-1|org:org-b:store:-:loc:-|POST /things|key-00000001",
		]);
	});

	it("supports API-key (POS) callers instead of answering 401", async () => {
		const first = await post("/things", { name: "a" }, { "idempotency-key": "key-00000001", "x-test-api-key": "key-1" });
		const retry = await post("/things", { name: "a" }, { "idempotency-key": "key-00000001", "x-test-api-key": "key-1" });

		expect(first.statusCode).toBe(HttpStatus.CREATED);
		expect(retry.headers[IDEMPOTENT_REPLAYED_HEADER.toLowerCase()]).toBe("true");
		expect(handlerState.calls).toBe(1);
	});

	it("refuses a non-JSON body with 415 before running the handler", async () => {
		const response = await app.inject({
			method: "POST",
			url: "/things",
			payload: "a=1",
			headers: { "idempotency-key": "key-00000001", "content-type": "text/plain" },
		});

		expect(response.statusCode).toBe(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
		expect(handlerState.calls).toBe(0);
	});

	it("rejects a malformed key with 400 VALIDATION_ERROR", async () => {
		const response = await post("/things", { name: "a" }, { "idempotency-key": "bad key!" });

		expect(response.statusCode).toBe(HttpStatus.BAD_REQUEST);
		expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe("VALIDATION_ERROR");
		expect(handlerState.calls).toBe(0);
	});

	it("requires an authenticated principal to use a key", async () => {
		const response = await post("/things", { name: "a" }, { "idempotency-key": "key-00000001", "x-anonymous": "1" });

		expect(response.statusCode).toBe(HttpStatus.UNAUTHORIZED);
	});

	it("answers 400 IDEMPOTENCY_KEY_REQUIRED on a required endpoint without the header", async () => {
		const response = await post("/strict-things", { name: "a" });

		expect(response.statusCode).toBe(HttpStatus.BAD_REQUEST);
		expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
	});
});

/** A method descriptor exactly as TypeScript hands it to a method decorator (metadata lands on `value`). */
function methodDescriptor(handler: () => void): TypedPropertyDescriptor<() => void> {
	return { value: handler, writable: true, enumerable: false, configurable: true };
}

describe("@Idempotent() decorator", () => {
	class Target {}

	it("records the options and a Swagger header — the interceptor itself is global, not per route", () => {
		function create(): void {}
		Idempotent({ required: true })(Target.prototype, "create", methodDescriptor(create));

		expect(Reflect.getMetadata(IDEMPOTENT_OPTIONS_METADATA, create)).toEqual({ required: true });
		expect(Reflect.getMetadata("__interceptors__", create)).toBeUndefined();
		expect(Reflect.getMetadata("swagger/apiParameters", create)).toEqual(
			expect.arrayContaining([expect.objectContaining({ in: "header", name: "Idempotency-Key", required: true })]),
		);
	});

	it("defaults to an optional key", () => {
		function create(): void {}
		Idempotent()(Target.prototype, "create", methodDescriptor(create));

		expect(Reflect.getMetadata(IDEMPOTENT_OPTIONS_METADATA, create)).toEqual({ required: false });
	});
});
