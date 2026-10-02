import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import {
	JsonObjectSchema,
	JsonValueSchema,
	nowEpochMs,
	PlatformResourceAuditInputSchema,
	PlatformResourceIdempotencyInputSchema,
	type JsonObject,
	type JsonValue,
	type PlatformResourceAuditInput,
	type PlatformResourceIdempotencyInput,
} from "@workspace/shared";

import { PrismaService } from "../prisma/prisma.service";
import { parsePrismaNullableJson } from "../common/utils/prisma-json";
import { IDEMPOTENCY_IN_PROGRESS_LEASE_MS, IDEMPOTENCY_RETENTION_MS } from "./idempotency/idempotency.constants";
import { IdempotencyKeyReusedError, IdempotencyRequestInProgressError } from "./idempotency/idempotency.errors";
import { IdempotencyRecordRepository, type IdempotencyRecordSnapshot, type IdempotencyRecordWriter } from "./idempotency/idempotency-record.repository";

@Injectable()
export class PlatformResourceAuditService {
	private readonly logger: Logger = new Logger(PlatformResourceAuditService.name);

	public constructor(private readonly prisma: PrismaService) {}

	public async log(input: PlatformResourceAuditInput, tx?: Prisma.TransactionClient): Promise<void> {
		const parsed = PlatformResourceAuditInputSchema.parse(input);
		const client = tx ?? this.prisma;
		try {
			await client.platformResourceAuditLog.create({
				data: {
					resourceType: parsed.resourceType,
					resourceId: parsed.resourceId,
					action: parsed.action,
					actorUserId: parsed.actorUserId,
					changes: parsePrismaNullableJson(parsed.changes),
				},
			});
		} catch (error) {
			this.logger.error(error instanceof Error ? error.message : "audit write failed");
		}
	}
}

/** Outcome of {@link PlatformResourceIdempotencyService.begin}. */
export type IdempotencyBeginResult =
	/** This request holds the key: execute the handler, then `complete()` or `release()`. */
	| { readonly kind: "acquired" }
	/** An identical request already completed: return the stored body without executing. */
	| { readonly kind: "replay"; readonly responseBody: JsonValue };

/** Shape of an HTTP response stored by `complete()` — wrapped so a `null` body round-trips. */
const StoredHttpResponseSchema = z.object({ body: JsonValueSchema }).strict();

/**
 * Idempotency ledger for platform mutations and `@Idempotent()` endpoints.
 *
 * State machine per (scope, key) — see docs/api-routes.md → "Idempotency":
 *
 * ```text
 * (none | expired) --begin--> IN_PROGRESS --complete--> COMPLETED (replayed until expiresAt)
 *                                  |--release (handler failed)--> expired → next begin re-executes
 * same key + different request hash (unexpired)  → 409 IDEMPOTENCY_KEY_REUSED
 * same key + same hash while IN_PROGRESS          → 409 IDEMPOTENCY_REQUEST_IN_PROGRESS
 * ```
 */
@Injectable()
export class PlatformResourceIdempotencyService {
	private readonly logger: Logger = new Logger(PlatformResourceIdempotencyService.name);

	public constructor(private readonly records: IdempotencyRecordRepository) {}

	/**
	 * Replay lookup for {@link PlatformResourceMutationService.runMutation}.
	 * Returns the stored response, or `null` when the key is unused/expired.
	 * Throws 409 `IDEMPOTENCY_KEY_REUSED` when the key was used for a
	 * different request, and 409 `IDEMPOTENCY_REQUEST_IN_PROGRESS` while an
	 * identical request is still executing.
	 */
	public async findReplay(scope: string, idempotencyKey: string, requestHash: string): Promise<JsonObject | null> {
		const record: IdempotencyRecordSnapshot | null = await this.records.find({ scope, idempotencyKey });
		if (record === null || record.expiresAtEpochMs <= nowEpochMs()) {
			return null;
		}
		if (record.requestHash !== requestHash) {
			throw new IdempotencyKeyReusedError();
		}
		if (record.status === "IN_PROGRESS") {
			throw new IdempotencyRequestInProgressError();
		}
		return JsonObjectSchema.parse(record.responseBody);
	}

	/** Record a COMPLETED response inside the caller's transaction (see `runMutation`). */
	public async store(input: PlatformResourceIdempotencyInput, tx: IdempotencyRecordWriter): Promise<void> {
		const parsed = PlatformResourceIdempotencyInputSchema.parse(input);
		const now = nowEpochMs();
		await this.records.insertCompleted(
			tx,
			{ scope: parsed.scope, idempotencyKey: parsed.idempotencyKey },
			parsed.requestHash,
			parsed.responseBody,
			now + IDEMPOTENCY_RETENTION_MS,
			now,
		);
	}

	/**
	 * Claim `idempotencyKey` for one HTTP request, or return the stored
	 * response of an identical, completed request. Race-safe: the unique
	 * (scope, key) index lets exactly one concurrent request acquire the key.
	 */
	public async begin(scope: string, idempotencyKey: string, requestHash: string): Promise<IdempotencyBeginResult> {
		const key = { scope, idempotencyKey };
		const now: number = nowEpochMs();
		const leaseExpiresAt: number = now + IDEMPOTENCY_IN_PROGRESS_LEASE_MS;

		if (await this.records.tryAcquire(key, requestHash, leaseExpiresAt, now)) {
			return { kind: "acquired" };
		}

		const existing: IdempotencyRecordSnapshot | null = await this.records.find(key);
		if (existing === null) {
			// The row vanished between the insert attempt and the read — the
			// retention job purged it (it only deletes long-expired rows). Try
			// once more; losing again means another request acquired it first.
			if (await this.records.tryAcquire(key, requestHash, leaseExpiresAt, now)) {
				return { kind: "acquired" };
			}
			throw new IdempotencyRequestInProgressError();
		}
		if (existing.expiresAtEpochMs <= now) {
			// Lease abandoned / replay window over: exactly one contender wins the takeover.
			if (await this.records.takeOverExpired(key, requestHash, leaseExpiresAt, now)) {
				return { kind: "acquired" };
			}
			throw new IdempotencyRequestInProgressError();
		}
		if (existing.requestHash !== requestHash) {
			throw new IdempotencyKeyReusedError();
		}
		if (existing.status === "IN_PROGRESS") {
			throw new IdempotencyRequestInProgressError();
		}
		return { kind: "replay", responseBody: StoredHttpResponseSchema.parse(existing.responseBody).body };
	}

	/** Store the successful response of the request that acquired the key. */
	public async complete(scope: string, idempotencyKey: string, requestHash: string, responseBody: JsonValue): Promise<void> {
		const now: number = nowEpochMs();
		const stored: boolean = await this.records.complete({ scope, idempotencyKey }, requestHash, { body: responseBody }, now + IDEMPOTENCY_RETENTION_MS, now);
		if (!stored) {
			// The lease expired mid-request and another request took the key over.
			// The response already went out; only replay protection is lost.
			this.logger.warn(`Idempotency lease lost before completion (scope=${scope}); the response was not stored for replay.`);
		}
	}

	/** Free the key after a failed request so the client can retry with the same key. */
	public async release(scope: string, idempotencyKey: string, requestHash: string): Promise<void> {
		await this.records.release({ scope, idempotencyKey }, requestHash, nowEpochMs());
	}
}

@Injectable()
export class PlatformResourceMutationService {
	public constructor(
		private readonly auditService: PlatformResourceAuditService,
		private readonly idempotencyService: PlatformResourceIdempotencyService,
		private readonly prisma: PrismaService,
	) {}

	public async runMutation<T>(options: {
		readonly scope: string;
		readonly idempotencyKey: string | null;
		readonly requestHash: string;
		readonly resourceType: string;
		readonly resourceId: string;
		readonly action: string;
		readonly actorUserId: string | null;
		readonly changes: JsonObject | null;
		readonly responseSchema: z.ZodType<T>;
		readonly execute: (tx: Prisma.TransactionClient) => Promise<T>;
		readonly toResponse: (result: T) => JsonObject;
	}): Promise<T> {
		if (options.idempotencyKey !== null) {
			const replay = await this.idempotencyService.findReplay(options.scope, options.idempotencyKey, options.requestHash);
			if (replay !== null) {
				return options.responseSchema.parse(replay);
			}
		}

		const result = await this.prisma.$transaction(async (tx) => {
			const value = await options.execute(tx);
			await this.auditService.log(
				{
					resourceType: options.resourceType,
					resourceId: options.resourceId,
					action: options.action,
					actorUserId: options.actorUserId,
					changes: options.changes,
				},
				tx,
			);
			if (options.idempotencyKey !== null) {
				await this.idempotencyService.store(
					{
						scope: options.scope,
						idempotencyKey: options.idempotencyKey,
						requestHash: options.requestHash,
						responseBody: options.toResponse(value),
					},
					tx,
				);
			}
			return value;
		});

		return result;
	}
}
