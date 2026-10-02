import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JsonValueSchema, type DataValue, type JsonValue } from "@workspace/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { catchError, concatMap, defer, from, of, type Observable } from "rxjs";
import { z } from "zod";

import { AuthenticationError } from "../../common/errors/app-error";
import { LogService } from "../../modules/logs/logs.service";
import { PlatformResourceIdempotencyService, type IdempotencyBeginResult } from "../platform-resource.services";
import { buildIdempotencyScope, hashIdempotentRequest, parseIdempotencyKeyHeader, type IdempotencyKey } from "./idempotency-request";
import { IDEMPOTENCY_KEY_HEADER, IDEMPOTENT_OPTIONS_METADATA, IDEMPOTENT_REPLAYED_HEADER, type IdempotentOptions } from "./idempotency.constants";
import { IdempotencyKeyRequiredError } from "./idempotency.errors";

/** Principal identity on `request.user` — access-token payloads and API-key principals both carry `sub`. */
const PrincipalSchema = z.object({ sub: z.string().min(1) });

/** Log context for lines written by this interceptor. */
const LOG_CONTEXT = "IdempotencyInterceptor";

/** What the interceptor needs to talk to the ledger for one request. */
interface IdempotentCall {
	readonly scope: string;
	readonly key: IdempotencyKey;
	readonly requestHash: string;
}

/**
 * HTTP-layer idempotency for endpoints decorated with `@Idempotent()`.
 *
 * - No `Idempotency-Key` header → the request runs normally (unless the
 *   endpoint says `required: true` → 400 IDEMPOTENCY_KEY_REQUIRED).
 * - First request with a key → runs; a successful result is stored.
 * - Identical retry (same caller, route, URL, body) → the stored result is
 *   replayed WITHOUT running the handler, with `Idempotent-Replayed: true`.
 * - Same key, different request → 409 IDEMPOTENCY_KEY_REUSED.
 * - Same key while the first request is still running → 409
 *   IDEMPOTENCY_REQUEST_IN_PROGRESS (+ `Retry-After`).
 * - Handler failure → the key is released (errors are not cached), so the
 *   client may retry with the same key.
 *
 * Route-scoped (via `@Idempotent()`), so it runs after guards and INSIDE the
 * global interceptors: replays still get the standard success envelope with a
 * fresh `meta.correlationId`.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor<DataValue, DataValue> {
	public constructor(
		private readonly reflector: Reflector,
		private readonly idempotency: PlatformResourceIdempotencyService,
		private readonly logService: LogService,
	) {}

	public intercept(context: ExecutionContext, next: CallHandler<DataValue>): Observable<DataValue> {
		// defer(): header/auth validation errors surface as observable errors
		// (→ GlobalExceptionFilter) instead of synchronous throws.
		return defer((): Observable<DataValue> => this.handle(context, next));
	}

	private handle(context: ExecutionContext, next: CallHandler<DataValue>): Observable<DataValue> {
		const options: IdempotentOptions = this.reflector.getAllAndOverride<IdempotentOptions | undefined>(IDEMPOTENT_OPTIONS_METADATA, [
			context.getHandler(),
			context.getClass(),
		]) ?? {
			required: false,
		};
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const reply: FastifyReply = context.switchToHttp().getResponse<FastifyReply>();

		const key: IdempotencyKey | undefined = parseIdempotencyKeyHeader(request.headers[IDEMPOTENCY_KEY_HEADER.toLowerCase()]);
		if (key === undefined) {
			if (options.required) {
				throw new IdempotencyKeyRequiredError();
			}
			return next.handle();
		}

		const call: IdempotentCall = IdempotencyInterceptor.describeCall(request, key);

		return from(this.idempotency.begin(call.scope, call.key, call.requestHash)).pipe(
			concatMap((outcome: IdempotencyBeginResult): Observable<DataValue> => {
				if (outcome.kind === "replay") {
					void reply.header(IDEMPOTENT_REPLAYED_HEADER, "true");
					return of(outcome.responseBody);
				}
				return next.handle().pipe(
					concatMap((result: DataValue): Observable<DataValue> => from(this.completeAndReturn(call, result))),
					catchError((error: Error): Observable<DataValue> => from(this.releaseAndRethrow(call, error))),
				);
			}),
		);
	}

	/** Scope + fingerprint for this request (caller-scoped, route-template-scoped). */
	private static describeCall(request: FastifyRequest, key: IdempotencyKey): IdempotentCall {
		const principal = PrincipalSchema.safeParse(request.user);
		if (!principal.success) {
			// @Idempotent() endpoints must be authenticated: an anonymous key
			// namespace would let one client replay another client's response.
			throw new AuthenticationError({ message: `${IDEMPOTENCY_KEY_HEADER} requires an authenticated request.` });
		}
		const routeTemplate: string = request.routeOptions.url ?? request.url;
		const body: JsonValue = JsonValueSchema.safeParse(request.body ?? null).data ?? null;
		return {
			scope: buildIdempotencyScope(principal.data.sub, request.method, routeTemplate),
			key,
			requestHash: hashIdempotentRequest({ method: request.method, url: request.url, body }),
		};
	}

	private async completeAndReturn(call: IdempotentCall, result: DataValue): Promise<DataValue> {
		const storable = JsonValueSchema.safeParse(result);
		if (!storable.success) {
			// Developer error: @Idempotent() on a handler that returns non-JSON.
			// The side effect already happened — answer normally, free the key,
			// and make the misconfiguration loud in the logs.
			this.logService.error(`@Idempotent() handler returned a non-JSON value; the response was not stored (scope=${call.scope}).`, { context: LOG_CONTEXT });
			await this.idempotency.release(call.scope, call.key, call.requestHash);
			return result;
		}
		await this.idempotency.complete(call.scope, call.key, call.requestHash, storable.data);
		return result;
	}

	private async releaseAndRethrow(call: IdempotentCall, error: Error): Promise<DataValue> {
		try {
			await this.idempotency.release(call.scope, call.key, call.requestHash);
		} catch (releaseError) {
			// The lease expires on its own; surface the ORIGINAL failure to the client.
			const reason: string = releaseError instanceof Error ? releaseError.message : "unknown error";
			this.logService.warn(`Failed to release idempotency key (scope=${call.scope}): ${reason}`, { context: LOG_CONTEXT });
		}
		throw error;
	}
}
