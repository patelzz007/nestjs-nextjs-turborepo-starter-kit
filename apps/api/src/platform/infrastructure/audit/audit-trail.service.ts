import { AsyncLocalStorage } from "node:async_hooks";

import { Injectable, Logger } from "@nestjs/common";
import { nowEpochMs, type CaughtValue, type JsonValue } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { RequestContextService, type RequestContext } from "../context/request-context";
import { correlationIdFor } from "../context/correlation-id";
import type { PreSerializationPayload } from "../utils/serialize-pre-serialization-value";
import { AuditContextMissingError, AuditLogWriteError } from "./audit-log.errors";
import { AuditLogRepository, type AuditLogWriter } from "./audit-log.repository";
import { readUserAgent } from "../http/user-agent-header";
import { buildHttpAuditEntry, isAuditedRoute, type HttpAuditEntry, type HttpAuditOutcome } from "./http-audit-entry";
import type { SystemCommandAuditEntry } from "../../application/ports/command-audit.port";
import { systemCommandAuditEntry } from "./system-command-audit";
import { TransactionLog } from "../transaction-log/transaction-log.port";

/** The audited request the interceptor is currently running a handler for. */
export interface AuditedRequestScope {
	readonly request: FastifyRequest;
	/** The status the route answers with on success (`@HttpCode` / Nest default). */
	readonly successStatus: number;
}

/**
 * The scope plus the rows the handler appended inside its own transaction
 * ({@link AuditTrailService.recordInTransaction}): they reach the transaction
 * log only once the request succeeded — by then that transaction committed.
 */
interface AuditedRequestState {
	readonly scope: AuditedRequestScope;
	readonly appendedInTransaction: HttpAuditEntry[];
}

/** What a failed request is recorded with — the global exception filter's mapped error. */
export interface AuditFailure {
	readonly status: number;
	readonly errorCode: string;
	readonly responseBody: JsonValue;
	/** What was thrown — recorded as the row's `errorDetail` (the real reason behind `errorCode`). */
	readonly cause: CaughtValue;
}

/**
 * The request context, or — for a failure raised before the context
 * middleware ran (malformed body, oversized payload) — the facts known about
 * the raw request: the SAME correlation id Fastify's `genReqId` used, the
 * socket address, the User-Agent, and no principal.
 */
function contextOrDetached(context: RequestContext | undefined, request: FastifyRequest): RequestContext {
	if (context !== undefined) {
		return context;
	}
	return {
		correlationId: correlationIdFor(request.raw),
		traceId: correlationIdFor(request.raw),
		ip: request.ip,
		userAgent: readUserAgent(request.raw),
		edgeLocation: undefined,
		principal: undefined,
		apiKey: undefined,
		tenant: { tenantId: undefined, locationId: undefined },
		systemOperations: [],
		receivedAtEpochMs: nowEpochMs(),
		supportAccessGrantId: undefined,
		isAuditRecorded: false,
		actor: undefined,
	};
}

/**
 * The global HTTP audit trail (docs/adr/025-global-http-audit-log.md): exactly
 * one append-only `AuditLog` row per HTTP request — reads included; only the
 * automated health probes are exempt.
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
 * - sensitive read → a handler releasing data in bulk (an export, the audit
 *   viewer) calls {@link recordSensitiveRead} with a summary of what it
 *   released; that summary replaces the full response body as the row.
 *
 * Every row written is also handed to the plain-text {@link TransactionLog}
 * (docs/technical/operations/transaction-log.md), which returns at once — the
 * file is written off the request path (BullMQ, or an asynchronous append).
 * A failure row goes there even when the database write failed.
 */
@Injectable()
export class AuditTrailService {
	private readonly logger: Logger = new Logger(AuditTrailService.name);
	private readonly scopeStorage: AsyncLocalStorage<AuditedRequestState> = new AsyncLocalStorage<AuditedRequestState>();

	public constructor(
		private readonly repository: AuditLogRepository,
		private readonly requestContext: RequestContextService,
		private readonly transactionLog: TransactionLog,
	) {}

	/** Run the handler of an audited request so {@link recordInTransaction} can find it. */
	public runInScope<T>(scope: AuditedRequestScope, handler: () => T): T {
		return this.scopeStorage.run({ scope, appendedInTransaction: [] }, handler);
	}

	/** Success path (interceptor). Throws {@link AuditLogWriteError} when the row cannot be written. */
	public async recordSuccess(request: FastifyRequest, status: number, responseBody: PreSerializationPayload): Promise<void> {
		if (!isAuditedRoute(request.routeOptions.url)) {
			return;
		}
		if (this.requestContext.current()?.isAuditRecorded === true) {
			this.logCommittedInTransaction();
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
		this.transactionLog.record(entry);
	}

	/**
	 * A SENSITIVE READ that must be audited although it is a GET — a data
	 * export (rules/10: "every sensitive read"). Writes one SUCCEEDED row with
	 * the complete request facts (actor, impersonator, tenant, IP, device,
	 * endpoint, params) and `summary` as its response body (what was released:
	 * report, range, format, row counts — never the data itself). Call it
	 * BEFORE the data leaves the server; throws {@link AuditLogWriteError} when
	 * the row cannot be written, so nothing is released unaudited.
	 */
	public async recordSensitiveRead(request: FastifyRequest, status: number, summary: JsonValue): Promise<void> {
		const entry: HttpAuditEntry = this.entryFor(request, { outcome: "SUCCEEDED", status, responseBody: summary });
		try {
			await this.repository.append(entry);
		} catch (error) {
			const cause: Error = error instanceof Error ? error : new Error(String(error));
			this.logger.error({ event: "audit.write_failed", phase: "sensitive_read", entry, error: cause.message });
			throw new AuditLogWriteError(cause);
		}
		this.transactionLog.record(entry);
		// This summary IS the request's audit row: the interceptor must not add the full response as a second one.
		this.requestContext.markAuditRecorded();
	}

	/**
	 * One row for a system command (job, cron, CLI, bootstrap, consumer).
	 * Throws {@link AuditLogWriteError} when the row cannot be written, so a success is not acknowledged unaudited.
	 */
	public async recordSystemCommand(entry: SystemCommandAuditEntry): Promise<void> {
		const row: HttpAuditEntry = systemCommandAuditEntry(entry);
		try {
			await this.repository.append(row);
		} catch (error) {
			const cause: Error = error instanceof Error ? error : new Error(String(error));
			this.logger.error({ event: "audit.write_failed", phase: "system_command", entry, error: cause.message });
			throw new AuditLogWriteError(cause);
		}
		this.transactionLog.record(row);
	}

	/** Failure path (exception filter). Never throws: the original failure must reach the client. */
	public async recordFailure(request: FastifyRequest, failure: AuditFailure): Promise<void> {
		if (!isAuditedRoute(request.routeOptions.url)) {
			return;
		}
		const entry: HttpAuditEntry = this.entryFor(request, { outcome: "FAILED", ...failure });
		try {
			await this.repository.append(entry);
		} catch (error) {
			this.logger.error({ event: "audit.write_failed", phase: "failure", entry, error: error instanceof Error ? error.message : String(error) });
		}
		this.transactionLog.record(entry);
	}

	/**
	 * Append this request's SUCCESS row inside the handler's own transaction
	 * (which must run under a system operation — `AuditLog` is bypass-only).
	 * `result` is what the handler is about to return. The interceptor will not
	 * write a second success row; if the request still fails afterwards, the
	 * exception filter adds a FAILED row, which is the truth: the change
	 * committed and the response did not go out.
	 */
	public async recordInTransaction(tx: AuditLogWriter, result: PreSerializationPayload): Promise<void> {
		const state: AuditedRequestState | undefined = this.scopeStorage.getStore();
		if (state === undefined) {
			throw new AuditContextMissingError();
		}
		const entry: HttpAuditEntry = this.entryFor(state.scope.request, { outcome: "SUCCEEDED", status: state.scope.successStatus, responseBody: result });
		await this.repository.appendInTransaction(tx, entry);
		state.appendedInTransaction.push(entry);
		this.requestContext.markAuditRecorded();
	}

	/** The request succeeded, so the rows its handler appended in its own transaction committed: log them now. */
	private logCommittedInTransaction(): void {
		const appended: HttpAuditEntry[] = this.scopeStorage.getStore()?.appendedInTransaction ?? [];
		for (const entry of appended.splice(0)) {
			this.transactionLog.record(entry);
		}
	}

	private entryFor(request: FastifyRequest, outcome: HttpAuditOutcome): HttpAuditEntry {
		return buildHttpAuditEntry(request, contextOrDetached(this.requestContext.current(), request), outcome, nowEpochMs());
	}
}
