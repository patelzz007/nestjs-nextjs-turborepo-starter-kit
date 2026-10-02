import "reflect-metadata";
import { Body, Controller, HttpStatus, Logger, Module, Post, SetMetadata, UseInterceptors, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { APP_GUARD, HttpAdapterHost, Reflector } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { ApiErrorResponseSchema, type JsonObject, type JsonValue } from "@workspace/shared";
import type { FastifyRequest } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalExceptionFilter } from "../../common/errors/global-exception.filter";
import { LogService } from "../../modules/logs/logs.service";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { PlatformResourceIdempotencyService } from "../platform-resource.services";
import { IdempotencyRecordRepository, type IdempotencyRecordKey, type IdempotencyRecordSnapshot } from "./idempotency-record.repository";
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
import { createTestTypedConfig } from "../../../test/support/test-api-env";
import { RequestContextService } from "../../common/context/request-context";

/** In-memory stand-in for the Prisma repository, with the same conditional-update semantics. */
class InMemoryIdempotencyRecords extends IdempotencyRecordRepository {
	public readonly rows = new Map<string, IdempotencyRecordSnapshot>();

	public constructor() {
		super(new TenantTransactionService(new PrismaService(createTestTypedConfig())));
	}

	private static id(key: IdempotencyRecordKey): string {
		return `${key.scope}|${key.idempotencyKey}`;
	}

	public override tryAcquire(key: IdempotencyRecordKey, requestHash: string, leaseExpiresAtEpochMs: number): Promise<boolean> {
		const id: string = InMemoryIdempotencyRecords.id(key);
		if (this.rows.has(id)) {
			return Promise.resolve(false);
		}
		this.rows.set(id, { requestHash, status: "IN_PROGRESS", responseBody: null, expiresAtEpochMs: leaseExpiresAtEpochMs });
		return Promise.resolve(true);
	}

	public override find(key: IdempotencyRecordKey): Promise<IdempotencyRecordSnapshot | null> {
		return Promise.resolve(this.rows.get(InMemoryIdempotencyRecords.id(key)) ?? null);
	}

	public override takeOverExpired(key: IdempotencyRecordKey, requestHash: string, leaseExpiresAtEpochMs: number, nowEpochMs: number): Promise<boolean> {
		const id: string = InMemoryIdempotencyRecords.id(key);
		const row = this.rows.get(id);
		if (row === undefined || row.expiresAtEpochMs > nowEpochMs) {
			return Promise.resolve(false);
		}
		this.rows.set(id, { requestHash, status: "IN_PROGRESS", responseBody: null, expiresAtEpochMs: leaseExpiresAtEpochMs });
		return Promise.resolve(true);
	}

	public override complete(key: IdempotencyRecordKey, requestHash: string, responseBody: JsonObject, retainUntilEpochMs: number): Promise<boolean> {
		const id: string = InMemoryIdempotencyRecords.id(key);
		const row = this.rows.get(id);
		if (row?.status !== "IN_PROGRESS" || row.requestHash !== requestHash) {
			return Promise.resolve(false);
		}
		this.rows.set(id, { requestHash, status: "COMPLETED", responseBody, expiresAtEpochMs: retainUntilEpochMs });
		return Promise.resolve(true);
	}

	public override release(key: IdempotencyRecordKey, requestHash: string, nowEpochMs: number): Promise<void> {
		const id: string = InMemoryIdempotencyRecords.id(key);
		const row = this.rows.get(id);
		if (row?.status === "IN_PROGRESS" && row.requestHash === requestHash) {
			this.rows.set(id, { ...row, expiresAtEpochMs: nowEpochMs });
		}
		return Promise.resolve();
	}
}

const START_EPOCH_MS = 1_790_812_800_000;

describe("PlatformResourceIdempotencyService", () => {
	let records: InMemoryIdempotencyRecords;
	let service: PlatformResourceIdempotencyService;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(START_EPOCH_MS);
		records = new InMemoryIdempotencyRecords();
		service = new PlatformResourceIdempotencyService(records);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("begin / complete / release (HTTP flow)", () => {
		it("acquires an unused key with a bounded lease", async () => {
			await expect(service.begin("s", "key-00000001", "h1")).resolves.toEqual({ kind: "acquired" });
			expect(records.rows.get("s|key-00000001")).toMatchObject({ status: "IN_PROGRESS", expiresAtEpochMs: START_EPOCH_MS + IDEMPOTENCY_IN_PROGRESS_LEASE_MS });
		});

		it("replays the stored response for an identical completed request", async () => {
			await service.begin("s", "key-00000001", "h1");
			await service.complete("s", "key-00000001", "h1", { id: "p-1" });

			await expect(service.begin("s", "key-00000001", "h1")).resolves.toEqual({ kind: "replay", responseBody: { id: "p-1" } });
			expect(records.rows.get("s|key-00000001")?.expiresAtEpochMs).toBe(START_EPOCH_MS + IDEMPOTENCY_RETENTION_MS);
		});

		it("round-trips a null response body", async () => {
			await service.begin("s", "key-00000001", "h1");
			await service.complete("s", "key-00000001", "h1", null);

			await expect(service.begin("s", "key-00000001", "h1")).resolves.toEqual({ kind: "replay", responseBody: null });
		});

		it("rejects the same key with a different request as IDEMPOTENCY_KEY_REUSED (409)", async () => {
			await service.begin("s", "key-00000001", "h1");
			await service.complete("s", "key-00000001", "h1", { id: "p-1" });

			await expect(service.begin("s", "key-00000001", "h2")).rejects.toBeInstanceOf(IdempotencyKeyReusedError);
		});

		it("rejects a concurrent duplicate as IDEMPOTENCY_REQUEST_IN_PROGRESS (409)", async () => {
			await service.begin("s", "key-00000001", "h1");

			await expect(service.begin("s", "key-00000001", "h1")).rejects.toBeInstanceOf(IdempotencyRequestInProgressError);
		});

		it("still reports a mismatch (not in-progress) when a different payload races an in-flight request", async () => {
			await service.begin("s", "key-00000001", "h1");

			await expect(service.begin("s", "key-00000001", "h2")).rejects.toBeInstanceOf(IdempotencyKeyReusedError);
		});

		it("lets the client retry after a failed request released the key", async () => {
			await service.begin("s", "key-00000001", "h1");
			await service.release("s", "key-00000001", "h1");

			await expect(service.begin("s", "key-00000001", "h1")).resolves.toEqual({ kind: "acquired" });
		});

		it("frees an abandoned lease once it expires (crashed request)", async () => {
			await service.begin("s", "key-00000001", "h1");
			vi.setSystemTime(START_EPOCH_MS + IDEMPOTENCY_IN_PROGRESS_LEASE_MS + 1);

			await expect(service.begin("s", "key-00000001", "h1")).resolves.toEqual({ kind: "acquired" });
		});

		it("allows reusing a key for a new request after the replay window", async () => {
			await service.begin("s", "key-00000001", "h1");
			await service.complete("s", "key-00000001", "h1", { id: "p-1" });
			vi.setSystemTime(START_EPOCH_MS + IDEMPOTENCY_RETENTION_MS + 1);

			await expect(service.begin("s", "key-00000001", "h2")).resolves.toEqual({ kind: "acquired" });
		});

		it("reports in-progress when another contender wins the takeover race", async () => {
			await service.begin("s", "key-00000001", "h1");
			vi.setSystemTime(START_EPOCH_MS + IDEMPOTENCY_IN_PROGRESS_LEASE_MS + 1);
			vi.spyOn(records, "takeOverExpired").mockResolvedValue(false);

			await expect(service.begin("s", "key-00000001", "h1")).rejects.toBeInstanceOf(IdempotencyRequestInProgressError);
		});

		it("acquires the key when the retention job purged the row between the insert attempt and the read", async () => {
			await service.begin("s", "key-00000001", "h1");
			vi.setSystemTime(START_EPOCH_MS + IDEMPOTENCY_RETENTION_MS + 1);
			const tryAcquire = vi.spyOn(records, "tryAcquire").mockResolvedValueOnce(false);
			vi.spyOn(records, "find").mockImplementationOnce((key: IdempotencyRecordKey): Promise<IdempotencyRecordSnapshot | null> => {
				records.rows.delete(`${key.scope}|${key.idempotencyKey}`);
				return Promise.resolve(null);
			});
			const takeOver = vi.spyOn(records, "takeOverExpired");

			await expect(service.begin("s", "key-00000001", "h2")).resolves.toEqual({ kind: "acquired" });
			expect(tryAcquire).toHaveBeenCalledTimes(2);
			expect(takeOver).not.toHaveBeenCalled();
			expect(records.rows.get("s|key-00000001")).toMatchObject({ requestHash: "h2", status: "IN_PROGRESS" });
		});

		it("reports in-progress when another request re-acquires a purged key first", async () => {
			vi.spyOn(records, "tryAcquire").mockResolvedValue(false);
			vi.spyOn(records, "find").mockResolvedValue(null);

			await expect(service.begin("s", "key-00000001", "h1")).rejects.toBeInstanceOf(IdempotencyRequestInProgressError);
		});

		it("does not store a response for a request that lost its lease", async () => {
			await service.begin("s", "key-00000001", "h1");
			vi.setSystemTime(START_EPOCH_MS + IDEMPOTENCY_IN_PROGRESS_LEASE_MS + 1);
			await service.begin("s", "key-00000001", "h2");

			await service.complete("s", "key-00000001", "h1", { id: "stale" });

			expect(records.rows.get("s|key-00000001")).toMatchObject({ requestHash: "h2", status: "IN_PROGRESS" });
		});
	});

	describe("findReplay (runMutation flow)", () => {
		it("returns null for an unused key", async () => {
			await expect(service.findReplay("s", "key-00000001", "h1")).resolves.toBeNull();
		});

		it("returns the stored response for an identical request", async () => {
			records.rows.set("s|key-00000001", { requestHash: "h1", status: "COMPLETED", responseBody: { id: "p-1" }, expiresAtEpochMs: START_EPOCH_MS + 1 });

			await expect(service.findReplay("s", "key-00000001", "h1")).resolves.toEqual({ id: "p-1" });
		});

		it("throws 409 IDEMPOTENCY_KEY_REUSED on a hash mismatch (previously returned null and re-executed)", async () => {
			records.rows.set("s|key-00000001", { requestHash: "h1", status: "COMPLETED", responseBody: { id: "p-1" }, expiresAtEpochMs: START_EPOCH_MS + 1 });

			await expect(service.findReplay("s", "key-00000001", "h2")).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED", httpStatus: HttpStatus.CONFLICT });
		});

		it("throws 409 IDEMPOTENCY_REQUEST_IN_PROGRESS while the first request runs", async () => {
			records.rows.set("s|key-00000001", { requestHash: "h1", status: "IN_PROGRESS", responseBody: null, expiresAtEpochMs: START_EPOCH_MS + 1 });

			await expect(service.findReplay("s", "key-00000001", "h1")).rejects.toBeInstanceOf(IdempotencyRequestInProgressError);
		});

		it("ignores an expired record", async () => {
			records.rows.set("s|key-00000001", { requestHash: "h1", status: "COMPLETED", responseBody: { id: "p-1" }, expiresAtEpochMs: START_EPOCH_MS });

			await expect(service.findReplay("s", "key-00000001", "h2")).resolves.toBeNull();
		});
	});
});

// ── HTTP integration: @Idempotent() semantics end to end ────────────────────

/** Controllable handler: counts executions and can be made to fail or block. */
const handlerState: { calls: number; fail: boolean; gate: Promise<void> | null } = { calls: 0, fail: false, gate: null };

class ThingsController {
	public async create(body: JsonValue): Promise<{ id: string; body: JsonValue }> {
		handlerState.calls += 1;
		if (handlerState.gate !== null) {
			await handlerState.gate;
		}
		if (handlerState.fail) {
			throw new Error("downstream failure");
		}
		return { id: `thing-${String(handlerState.calls)}`, body };
	}

	public createStrict(body: JsonValue): Promise<{ body: JsonValue }> {
		return Promise.resolve({ body });
	}
}

/** Authenticates every request as `user-1` unless `x-anonymous` is sent. */
class FakeAuthGuard implements CanActivate {
	public canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<FastifyRequest>();
		if (request.headers["x-anonymous"] === undefined) {
			Reflect.set(request, "user", { sub: "user-1" });
		}
		return true;
	}
}

class ThingsModule {}

const records = new InMemoryIdempotencyRecords();
const logService = new LogService(createTestTypedConfig(), new RequestContextService());
const interceptor = new IdempotencyInterceptor(new Reflector(), new PlatformResourceIdempotencyService(records), logService);

// Decorators applied as calls — the unit-test transformer does not compile decorator syntax
// (and emits no constructor metadata, so the interceptor is passed as a ready instance).
function applyRoute(method: "create" | "createStrict", path: string, options: IdempotentOptions): void {
	const descriptor = Object.getOwnPropertyDescriptor(ThingsController.prototype, method);
	if (descriptor === undefined) {
		throw new Error(`Missing ${method}`);
	}
	Post(path)(ThingsController.prototype, method, descriptor);
	SetMetadata(IDEMPOTENT_OPTIONS_METADATA, options)(ThingsController.prototype, method, descriptor);
	UseInterceptors(interceptor)(ThingsController.prototype, method, descriptor);
	Body()(ThingsController.prototype, method, 0);
}
applyRoute("create", "things", { required: false });
applyRoute("createStrict", "strict-things", { required: true });
Controller()(ThingsController);
Module({ controllers: [ThingsController], providers: [{ provide: APP_GUARD, useValue: new FakeAuthGuard() }] })(ThingsModule);

describe("@Idempotent() over HTTP", () => {
	let app: NestFastifyApplication;

	beforeAll(async () => {
		vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
		vi.spyOn(Logger.prototype, "warn").mockImplementation((): void => undefined);
		const moduleRef = await Test.createTestingModule({ imports: [ThingsModule] }).compile();
		app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		app.useGlobalFilters(new GlobalExceptionFilter(app.get(HttpAdapterHost), logService, new RequestContextService(), createTestTypedConfig()));
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
	});

	async function post(url: string, payload: JsonObject, headers: Record<string, string> = {}): Promise<Awaited<ReturnType<NestFastifyApplication["inject"]>>> {
		return app.inject({ method: "POST", url, payload, headers });
	}

	it("runs normally without an Idempotency-Key", async () => {
		await post("/things", { name: "a" });
		await post("/things", { name: "a" });

		expect(handlerState.calls).toBe(2);
	});

	it("replays an identical retry without re-running the handler", async () => {
		const first = await post("/things", { name: "a", qty: 1 }, { "idempotency-key": "key-00000001" });
		const retry = await post("/things", { qty: 1, name: "a" }, { "idempotency-key": "key-00000001" });

		expect(first.statusCode).toBe(HttpStatus.CREATED);
		expect(retry.statusCode).toBe(HttpStatus.CREATED);
		expect(retry.json()).toEqual(first.json());
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

	it("does not cache failures: the key is released and a retry re-executes", async () => {
		handlerState.fail = true;
		const failed = await post("/things", { name: "a" }, { "idempotency-key": "key-00000001" });
		handlerState.fail = false;
		const retried = await post("/things", { name: "a" }, { "idempotency-key": "key-00000001" });

		expect(failed.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
		expect(retried.statusCode).toBe(HttpStatus.CREATED);
		expect(handlerState.calls).toBe(2);
	});

	it("scopes keys per caller: another user's key namespace is separate", async () => {
		await post("/things", { name: "a" }, { "idempotency-key": "key-00000001" });

		expect([...records.rows.keys()]).toEqual(["http:user-1:POST /things|key-00000001"]);
	});

	it("rejects a malformed key with 400 VALIDATION_ERROR", async () => {
		const response = await post("/things", { name: "a" }, { "idempotency-key": "bad key!" });

		expect(response.statusCode).toBe(HttpStatus.BAD_REQUEST);
		expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe("VALIDATION_ERROR");
		expect(handlerState.calls).toBe(0);
	});

	it("requires authentication to use a key", async () => {
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

	it("registers the interceptor, the options metadata and a Swagger header", () => {
		function create(): void {}
		Idempotent({ required: true })(Target.prototype, "create", methodDescriptor(create));

		expect(Reflect.getMetadata(IDEMPOTENT_OPTIONS_METADATA, create)).toEqual({ required: true });
		expect(Reflect.getMetadata("__interceptors__", create)).toContain(IdempotencyInterceptor);
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
