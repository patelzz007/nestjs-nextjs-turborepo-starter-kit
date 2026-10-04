// ============================================
// common/context/request-context.ts - THE per-request context (ADR 017)
// ============================================
// One typed, AsyncLocalStorage-backed context per HTTP request, reachable
// from any code that runs on behalf of that request (guards, interceptors,
// services, repositories, outbox writes, log lines) without passing the
// request object around.
//
// Lifecycle (who fills what, and when):
//   1. request start   → RequestContextMiddleware: correlationId, traceId, ip, userAgent
//   2. after auth      → AuthGuard / RefreshTokenGuard: userId, impersonatorId
//   3. after tenancy   → AuthorizationGuard: tenant (server-verified ids only)
//
// The DB-transaction-scoped RLS store (`prisma/rls-context.ts`) stays a
// separate AsyncLocalStorage on purpose: its bypass/system-operation scopes
// nest per transaction. `RlsInterceptor` derives the RLS scope from this
// context. See docs/adr/017-unified-request-context.md.

import { AsyncLocalStorage } from "node:async_hooks";
import type { IncomingMessage } from "node:http";

import { Injectable } from "@nestjs/common";
import { nowEpochMs } from "@workspace/shared";

import type { SystemOperation } from "../../prisma/system-operation.registry";
import { correlationIdFor } from "./correlation-id";

/** Server-verified tenant scope of the request. Absent ids were not requested or not proven. */
export interface RequestTenant {
	readonly organizationId: string | undefined;
	readonly storeId: string | undefined;
	readonly locationId: string | undefined;
}

/** Who the request acts as, once authentication has run. */
export interface RequestPrincipal {
	readonly userId: string;
	/** The real (super-admin) user behind an impersonation session. */
	readonly impersonatorId: string | undefined;
}

/**
 * A machine caller authenticated by an API key (merchant POS keys,
 * `@AllowApiKeyAuth()` routes). Bound by the API-key guards; mutually
 * exclusive with a user principal in practice, but kept separate so the user
 * principal's shape never changes.
 */
export interface RequestApiKeyPrincipal {
	readonly apiKeyId: string;
	/** The organization the key belongs to (server-verified by the key lookup). */
	readonly organizationId: string;
	/** The POS terminal the key acts for, when known. */
	readonly terminalId: string | undefined;
	/** The store the key itself is limited to (`null` = organization-wide) — the database store scope of the request. */
	readonly locationId: string | null;
}

/** Everything the platform knows about the current request. Immutable snapshots. */
export interface RequestContext {
	/** One id per request: `X-Correlation-Id`, `meta.correlationId`, pino `correlationId`, outbox rows. */
	readonly correlationId: string;
	/** Trace id. Equal to `correlationId` until a W3C trace context is propagated. */
	readonly traceId: string;
	readonly ip: string | undefined;
	readonly userAgent: string | undefined;
	readonly principal: RequestPrincipal | undefined;
	readonly apiKey: RequestApiKeyPrincipal | undefined;
	readonly tenant: RequestTenant;
	/** Allowlisted system operations (RLS bypasses) used on behalf of this request, in first-use order, de-duplicated. */
	readonly systemOperations: readonly SystemOperation[];
	/** When the request arrived (epoch ms) — the audit entry's `occurredAt`. */
	readonly receivedAtEpochMs: number;
	/**
	 * True once the handler appended this request's audit entry inside its own
	 * transaction (`AuditTrailService.recordInTransaction`); the audit
	 * interceptor then does not write a second success entry.
	 */
	readonly isAuditRecordedInTransaction: boolean;
}

/** Fields known at request start (before authentication). */
export interface RequestContextSeed {
	readonly correlationId: string;
	readonly ip: string | undefined;
	readonly userAgent: string | undefined;
}

/** Structured, log-safe identifiers of the current request (never secrets, never PII beyond ids). */
export interface RequestLogFields {
	readonly correlationId: string;
	readonly userId?: string;
	readonly impersonatorId?: string;
	readonly organizationId?: string;
}

const EMPTY_TENANT: RequestTenant = { organizationId: undefined, storeId: undefined, locationId: undefined };

/**
 * The ALS store holds a single mutable slot so later lifecycle phases can
 * publish an enriched snapshot that every downstream reader sees, while each
 * snapshot itself stays immutable.
 */
interface RequestContextSlot {
	current: RequestContext;
}

const requestContextStorage: AsyncLocalStorage<RequestContextSlot> = new AsyncLocalStorage<RequestContextSlot>();

/**
 * The single accessor for the request context. Stateless (the store is
 * module-level), so every instance sees the same context; inject it through
 * the global `RequestContextModule`.
 */
@Injectable()
export class RequestContextService {
	/** Opens a new context for `callback` (request start). */
	public run<T>(seed: RequestContextSeed, callback: () => T): T {
		const context: RequestContext = {
			correlationId: seed.correlationId,
			traceId: seed.correlationId,
			ip: seed.ip,
			userAgent: seed.userAgent,
			principal: undefined,
			apiKey: undefined,
			tenant: EMPTY_TENANT,
			systemOperations: [],
			receivedAtEpochMs: nowEpochMs(),
			isAuditRecordedInTransaction: false,
		};
		return requestContextStorage.run({ current: context }, callback);
	}

	/** The current context, or `undefined` outside a request (boot, cron, queue workers). */
	public current(): RequestContext | undefined {
		return requestContextStorage.getStore()?.current;
	}

	/** The current request's correlation id, or `undefined` outside a request. */
	public correlationId(): string | undefined {
		return this.current()?.correlationId;
	}

	/**
	 * The correlation id of `raw`'s request: the open context's id, or — for
	 * failures raised before the context middleware ran (body too large,
	 * malformed JSON, docs gate) — the same per-request memo `genReqId` used.
	 */
	public resolveCorrelationId(raw: IncomingMessage): string {
		return this.correlationId() ?? correlationIdFor(raw);
	}

	/** Records the authenticated principal (after AuthGuard). No-op outside a request. */
	public bindPrincipal(principal: RequestPrincipal): void {
		this.update((context: RequestContext): RequestContext => ({ ...context, principal }));
	}

	/** Records the API key that authenticated the request (API-key guards). No-op outside a request. */
	public bindApiKey(apiKey: RequestApiKeyPrincipal): void {
		this.update((context: RequestContext): RequestContext => ({ ...context, apiKey }));
	}

	/**
	 * Records that a system operation bypassed RLS for this request, so the
	 * request's audit entry names every bypass it caused. No-op outside a
	 * request (background work is audited by the system-operation log line).
	 */
	public recordSystemOperation(operation: SystemOperation): void {
		this.update((context: RequestContext): RequestContext =>
			context.systemOperations.includes(operation) ? context : { ...context, systemOperations: [...context.systemOperations, operation] },
		);
	}

	/** Marks the request's audit entry as written inside the handler's transaction. No-op outside a request. */
	public markAuditRecordedInTransaction(): void {
		this.update((context: RequestContext): RequestContext => ({ ...context, isAuditRecordedInTransaction: true }));
	}

	/** Records the server-verified tenant (after AuthorizationGuard). No-op outside a request. */
	public bindTenant(tenant: Partial<RequestTenant>): void {
		this.update((context: RequestContext): RequestContext => ({
			...context,
			tenant: { organizationId: tenant.organizationId, storeId: tenant.storeId, locationId: tenant.locationId },
		}));
	}

	/** Identifiers every log line inside a request carries. `undefined` outside a request. */
	public logFields(): RequestLogFields | undefined {
		const context: RequestContext | undefined = this.current();
		if (context === undefined) {
			return undefined;
		}
		return {
			correlationId: context.correlationId,
			...(context.principal === undefined ? {} : { userId: context.principal.userId }),
			...(context.principal?.impersonatorId === undefined ? {} : { impersonatorId: context.principal.impersonatorId }),
			...(context.tenant.organizationId === undefined ? {} : { organizationId: context.tenant.organizationId }),
		};
	}

	private update(next: (context: RequestContext) => RequestContext): void {
		const slot: RequestContextSlot | undefined = requestContextStorage.getStore();
		if (slot === undefined) {
			return;
		}
		slot.current = next(slot.current);
	}
}
