import { Injectable, Logger, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IDEMPOTENCY_KEY_HEADER, JsonValueSchema, nowEpochMs, type DataValue, type JsonValue } from "@workspace/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { catchError, concatMap, defer, from, of, throwError, type Observable } from "rxjs";
import { z } from "zod";

import { RequestContextService } from "../../common/context/request-context";
import { readFirstHeader } from "../../common/utils/http-headers";
import { parsePreSerializationValue, serializePreSerializationValue, type PreSerializationPayload } from "../../common/utils/serialize-pre-serialization-value";
import { IdempotencyLedgerService, type IdempotencyBeginResult } from "./idempotency-ledger.service";
import type { IdempotencyLease } from "./idempotency-record.repository";
import {
	buildIdempotencyScope,
	hashIdempotentRequest,
	parseIdempotencyKeyHeader,
	readIdempotentRequestBody,
	type IdempotencyKey,
	type ParsedRequestBody,
} from "./idempotency-request";
import { IDEMPOTENT_OPTIONS_METADATA, IDEMPOTENT_REPLAYED_HEADER, type IdempotentOptions } from "./idempotency.constants";
import { IdempotencyKeyRequiredError, IdempotencyResponseNotStorableError } from "./idempotency.errors";

/** What the interceptor needs to talk to the ledger for one request. */
interface IdempotentCall {
	readonly scope: string;
	readonly key: IdempotencyKey;
	readonly requestHash: string;
}

/** A stored success envelope: its `meta` is re-stamped with the replaying request's correlation id and time. */
const EnvelopeWithMetaSchema = z.looseObject({ meta: z.looseObject({ correlationId: z.string(), timestamp: z.number() }) });

/**
 * HTTP-layer idempotency for endpoints decorated with `@Idempotent()`.
 * Registered GLOBALLY (AppModule), between the audit and response
 * interceptors, so it sees — and stores — the exact wire body the response
 * interceptor produced, and a replay skips the handler AND the response
 * contract entirely. Endpoints without `@Idempotent()` pass straight through.
 *
 * - No `Idempotency-Key` header → the request runs normally (unless the
 *   endpoint says `required: true` → 400 IDEMPOTENCY_KEY_REQUIRED).
 * - The key is namespaced by the server-verified principal (user or API key),
 *   tenant and route template; the fingerprint is method + URL + canonical JSON
 *   body. A non-JSON body is refused (415).
 * - First request with a key → runs; the successful response is stored under
 *   the request's lease (fencing token).
 * - Identical retry → the stored response is replayed WITHOUT running the
 *   handler, with `Idempotent-Replayed: true` and a fresh `meta`.
 * - Same key, different request → 409 IDEMPOTENCY_KEY_REUSED.
 * - Same key while the first request is still running → 409
 *   IDEMPOTENCY_REQUEST_IN_PROGRESS (+ `Retry-After`).
 * - Handler failure → the key is released (errors are not cached).
 * - Storing the response fails AFTER the handler succeeded → the key is NOT
 *   released (that would let a retry run the side effect again): the lease
 *   keeps duplicates out until it expires, the failure is logged at `error`,
 *   and the client still receives the real response.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor<DataValue, DataValue> {
	private readonly logger: Logger = new Logger(IdempotencyInterceptor.name);

	public constructor(
		private readonly reflector: Reflector,
		private readonly ledger: IdempotencyLedgerService,
		private readonly requestContext: RequestContextService,
	) {}

	public intercept(context: ExecutionContext, next: CallHandler<DataValue>): Observable<DataValue> {
		const options: IdempotentOptions | undefined = this.reflector.getAllAndOverride<IdempotentOptions | undefined>(IDEMPOTENT_OPTIONS_METADATA, [
			context.getHandler(),
			context.getClass(),
		]);
		if (options === undefined) {
			return next.handle();
		}
		// defer(): header/auth validation errors surface as observable errors
		// (→ GlobalExceptionFilter) instead of synchronous throws.
		return defer((): Observable<DataValue> => this.handle(context, next, options));
	}

	private handle(context: ExecutionContext, next: CallHandler<DataValue>, options: IdempotentOptions): Observable<DataValue> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const reply: FastifyReply = context.switchToHttp().getResponse<FastifyReply>();

		const key: IdempotencyKey | undefined = parseIdempotencyKeyHeader(request.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()]);
		if (key === undefined) {
			if (options.required) {
				throw new IdempotencyKeyRequiredError();
			}
			return next.handle();
		}

		const call: IdempotentCall = this.describeCall(request, key);

		return from(this.ledger.begin(call.scope, call.key, call.requestHash)).pipe(
			concatMap((outcome: IdempotencyBeginResult): Observable<DataValue> => {
				if (outcome.kind === "replay") {
					void reply.header(IDEMPOTENT_REPLAYED_HEADER, "true");
					return of(this.restampMeta(outcome.responseBody));
				}
				const lease: IdempotencyLease = outcome.lease;
				return next.handle().pipe(
					// Placed BEFORE the store step: only a HANDLER failure releases the key.
					catchError((error: Error): Observable<DataValue> =>
						from(this.releaseAfterFailure(call, lease)).pipe(concatMap((): Observable<DataValue> => throwError(() => error))),
					),
					concatMap((result: DataValue): Observable<DataValue> => from(this.storeAfterSuccess(call, lease, result))),
				);
			}),
		);
	}

	/** Scope + fingerprint for this request (principal-, tenant- and route-template-scoped). */
	private describeCall(request: FastifyRequest, key: IdempotencyKey): IdempotentCall {
		const routeTemplate: string = request.routeOptions.url ?? request.url;
		const body = readIdempotentRequestBody({ contentType: readFirstHeader(request.headers["content-type"]), body: IdempotencyInterceptor.parseBody(request) });
		return {
			scope: buildIdempotencyScope(this.requestContext.current(), request.method, routeTemplate),
			key,
			requestHash: hashIdempotentRequest({ method: request.method, url: request.url, body }),
		};
	}

	/** The JSON boundary check of the request body (Fastify has already parsed JSON bodies). */
	private static parseBody(request: FastifyRequest): ParsedRequestBody {
		if (request.body === undefined || request.body === null) {
			return { kind: "absent" };
		}
		const json = JsonValueSchema.safeParse(request.body);
		return json.success ? { kind: "json", value: json.data } : { kind: "not_json" };
	}

	/**
	 * Persist the wire body. Never releases the key: the side effect already
	 * happened. A failure here is logged at `error` (not swallowed) and the
	 * client receives the real result.
	 */
	private async storeAfterSuccess(call: IdempotentCall, lease: IdempotencyLease, result: DataValue): Promise<DataValue> {
		try {
			const outcome = await this.ledger.complete(call.scope, call.key, lease, IdempotencyInterceptor.toStorableBody(result));
			if (outcome === "lease_lost") {
				// The handler outlived its lease and a retry may have taken the key
				// over — a duplicate execution may have happened. Loud by design.
				this.logger.error({ event: "idempotency.lease_lost", scope: call.scope, correlationId: this.requestContext.correlationId() });
			}
		} catch (error) {
			this.logger.error({
				event: "idempotency.store_failed",
				scope: call.scope,
				correlationId: this.requestContext.correlationId(),
				error: error instanceof Error ? error.message : String(error),
			});
		}
		return result;
	}

	/** Release the lease after a handler failure; the original failure always reaches the client. */
	private async releaseAfterFailure(call: IdempotentCall, lease: IdempotencyLease): Promise<void> {
		try {
			await this.ledger.release(call.scope, call.key, lease);
		} catch (error) {
			// The lease still expires on its own; the client gets the ORIGINAL error.
			this.logger.error({
				event: "idempotency.release_failed",
				scope: call.scope,
				correlationId: this.requestContext.correlationId(),
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * The wire form of the response (bigint → number, exactly what the
	 * `preSerialization` hook sends). A value that has no JSON form is a
	 * programming error on an `@Idempotent()` route.
	 */
	private static toStorableBody(result: DataValue): JsonValue {
		const payload: PreSerializationPayload = result;
		const preSerialized = parsePreSerializationValue(payload);
		const json = preSerialized === null ? undefined : JsonValueSchema.safeParse(serializePreSerializationValue(preSerialized));
		if (json?.success !== true) {
			throw new IdempotencyResponseNotStorableError();
		}
		return json.data;
	}

	/** A replayed envelope carries THIS request's correlation id and timestamp, not the original's. */
	private restampMeta(body: JsonValue): JsonValue {
		const envelope = EnvelopeWithMetaSchema.safeParse(body);
		const correlationId: string | undefined = this.requestContext.correlationId();
		if (!envelope.success || correlationId === undefined) {
			return body;
		}
		return JsonValueSchema.parse({ ...envelope.data, meta: { ...envelope.data.meta, correlationId, timestamp: nowEpochMs() } });
	}
}
