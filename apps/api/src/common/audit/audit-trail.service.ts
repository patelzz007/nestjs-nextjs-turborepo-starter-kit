import { AsyncLocalStorage } from "node:async_hooks";

import { Injectable, Logger } from "@nestjs/common";
import { nowEpochMs, type JsonValue } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { RequestContextService, type RequestContext } from "../context/request-context";
import { correlationIdFor } from "../context/correlation-id";
import type { PreSerializationPayload } from "../utils/serialize-pre-serialization-value";
import { AuditContextMissingError, AuditLogWriteError } from "./audit-log.errors";
import { AuditLogRepository, type AuditLogWriter } from "./audit-log.repository";
import { buildHttpAuditEntry, isAuditedMethod, type HttpAuditEntry, type HttpAuditOutcome } from "./http-audit-entry";

/** The audited request the interceptor is currently running a handler for. */
export interface AuditedRequestScope {
	readonly request: FastifyRequest;
	/** The status the route answers with on success (`@HttpCode` / Nest default). */
	readonly successStatus: number;
}

/** What a failed request is recorded with — the global exception filter's mapped error. */
export interface AuditFailure {
	readonly status: number;
	readonly errorCode: string;
	readonly responseBody: JsonValue;
}

/**
 * The request context, or — for a failure raised before the context
 * middleware ran (malformed body, oversized payload) — the facts known about
 * the raw request: the SAME correlation id Fastify's `genReqId` used, the
 * socket address, and no principal.
 */
function contextOrDetached(context: RequestContext | undefined, request: FastifyRequest): RequestContext {
	if (context !== undefined) {
		return context;
	}
	return {
		correlationId: correlationIdFor(request.raw),
		traceId: correlationIdFor(request.raw),
		ip: request.ip,
		userAgent: undefined,
		principal: undefined,
		apiKey: undefined,
		tenant: { organizationId: undefined, storeId: undefined, locationId: undefined },
		systemOperations: [],
		receivedAtEpochMs: nowEpochMs(),
		isAuditRecordedInTransaction: false,
	};
}

/**
 * The global HTTP audit trail (docs/adr/025-global-http-audit-log.md): exactly
 * one append-only `audit_logs` row per state-changing request.
 *
 * - success → written by `AuditLogInterceptor` after the handler (and the
 *   response contract) succeeded. If the write fails the request FAILS with
 *   500 — an unaudited change is never acknowledged as a clean success.
 * - failure → written by `GlobalExceptionFilter` for every error, including
 *   guard rejections that never reach an interceptor. If that write fails the
 *   client still gets the original error, and the complete (redacted) entry is
 *   logged at `error` so nothing is lost silently.
 * - same transaction → a handler whose state change runs in a system-operation
 *   transaction can call {@link recordInTransaction}; the row then commits or
 *   rolls back WITH the change, and the interceptor does not write it again.
 */
@Injectable()
export class AuditTrailService {
	private readonly logger: Logger = new Logger(AuditTrailService.name);
	private readonly scopeStorage: AsyncLocalStorage<AuditedRequestScope> = new AsyncLocalStorage<AuditedRequestScope>();

	public constructor(
		private readonly repository: AuditLogRepository,
		private readonly requestContext: RequestContextService,
	) {}

	/** Run the handler of an audited request so {@link recordInTransaction} can find it. */
	public runInScope<T>(scope: AuditedRequestScope, handler: () => T): T {
		return this.scopeStorage.run(scope, handler);
	}

	/** Success path (interceptor). Throws {@link AuditLogWriteError} when the row cannot be written. */
	public async recordSuccess(request: FastifyRequest, status: number, responseBody: PreSerializationPayload): Promise<void> {
		if (!isAuditedMethod(request.method) || this.requestContext.current()?.isAuditRecordedInTransaction === true) {
			return;
		}
		const entry: HttpAuditEntry = this.entryFor(request, { outcome: "SUCCEEDED", status, responseBody });
		try {
			await this.repository.append(entry);
		} catch (error) {
			const cause: Error = error instanceof Error ? error : new Error(String(error));
			this.logger.error({ event: "audit.write_failed", phase: "success", entry, error: cause.message });
			throw new AuditLogWriteError(cause);
		}
	}

	/** Failure path (exception filter). Never throws: the original failure must reach the client. */
	public async recordFailure(request: FastifyRequest, failure: AuditFailure): Promise<void> {
		if (!isAuditedMethod(request.method)) {
			return;
		}
		const entry: HttpAuditEntry = this.entryFor(request, { outcome: "FAILED", ...failure });
		try {
			await this.repository.append(entry);
		} catch (error) {
			this.logger.error({ event: "audit.write_failed", phase: "failure", entry, error: error instanceof Error ? error.message : String(error) });
		}
	}

	/**
	 * Append this request's SUCCESS row inside the handler's own transaction
	 * (which must run under a system operation — `audit_logs` is bypass-only).
	 * `result` is what the handler is about to return. The interceptor will not
	 * write a second success row; if the request still fails afterwards, the
	 * exception filter adds a FAILED row, which is the truth: the change
	 * committed and the response did not go out.
	 */
	public async recordInTransaction(tx: AuditLogWriter, result: PreSerializationPayload): Promise<void> {
		const scope: AuditedRequestScope | undefined = this.scopeStorage.getStore();
		if (scope === undefined) {
			throw new AuditContextMissingError();
		}
		await this.repository.appendInTransaction(tx, this.entryFor(scope.request, { outcome: "SUCCEEDED", status: scope.successStatus, responseBody: result }));
		this.requestContext.markAuditRecordedInTransaction();
	}

	private entryFor(request: FastifyRequest, outcome: HttpAuditOutcome): HttpAuditEntry {
		return buildHttpAuditEntry(request, contextOrDetached(this.requestContext.current(), request), outcome, nowEpochMs());
	}
}
