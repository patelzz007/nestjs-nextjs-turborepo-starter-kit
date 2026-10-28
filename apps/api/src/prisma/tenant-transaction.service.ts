import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { generateCorrelationId } from "../platform/infrastructure/context/correlation-id";
import { currentWorkCorrelationId } from "../platform/infrastructure/context/work-correlation";
import { RequestContextService } from "../platform/infrastructure/context/request-context";
import type { RlsTransactionScope } from "../platform/infrastructure/unit-of-work/actor-to-rls-context";
import { DEFAULT_DATABASE_ROLE, parseSystemOperation, systemOperationDefinition, type SystemOperation, type SystemOperationDefinition } from "./system-operation.registry";
import { MissingTenantContextError } from "./missing-tenant-context.error";
import { currentRlsContext, rlsSessionVariables, rlsStorage, systemRlsContext, userRlsContext, type RlsContext, type RlsSessionVariables } from "./rls-context";
import type { SystemDatabaseContext, TenantDatabaseContext } from "./tenant-context";
import { PrismaService } from "./prisma.service";

/** The interactive-transaction client Prisma hands to `$transaction` — the type repositories accept as `db`. */
type TransactionClient = Prisma.TransactionClient;

/** Structured audit line written for every system-operation transaction (`docs/technical/operations/observability.md`, "Logs"). */
export interface SystemOperationAuditEntry {
	readonly event: "rls.system_operation";
	readonly operation: SystemOperation;
	readonly role: SystemOperationDefinition["role"];
	readonly reason: string;
	readonly actorUserId: string | null;
	readonly correlationId: string;
}

/** SQL has no "absent" for a custom setting: an unset value is the empty string. */
const UNSET_SESSION_VALUE = "";

/** Every transaction-local setting a transaction opened here stamps. Each path sets all of them, so none is inherited. */
export interface TransactionSessionVariables extends RlsSessionVariables {
	readonly actorPurpose: string;
	readonly correlationId: string;
}

/**
 * Stamps every session variable in ONE statement (one round-trip). The select
 * list is evaluated left to right, so the role switches first. All values are
 * bind parameters; every setting is transaction-local (`is_local = true`).
 */
async function applySessionVariables(tx: TransactionClient, session: TransactionSessionVariables): Promise<void> {
	await tx.$executeRaw`SELECT
		set_config('role', ${session.role}, true),
		set_config('app.current_user_id', ${session.currentUserId}, true),
		set_config('app.current_tenant_id', ${session.currentTenantId}, true),
		set_config('app.rls_bypass', ${session.rlsBypass}, true),
		set_config('app.system_operation', ${session.systemOperation}, true),
		set_config('app.current_api_key_id', ${session.currentApiKeyId}, true),
		set_config('app.current_api_key_location_id', ${session.currentApiKeyLocationId}, true),
		set_config('app.actor_purpose', ${session.actorPurpose}, true),
		set_config('app.correlation_id', ${session.correlationId}, true)`;
}

/**
 * A user scope that requires an explicit tenant (`requireExplicitContext`)
 * but has none fails closed, exactly like the pool checkout (`rls-pool.ts`):
 * nothing is queried.
 */
function assertExplicitContext(context: RlsContext): void {
	if (context.kind === "user" && context.requireExplicitContext && context.tenantId === null) {
		throw new MissingTenantContextError("This user's database access requires a tenant context, and none is bound.");
	}
}

@Injectable()
export class TenantTransactionService {
	private readonly logger: Logger = new Logger(TenantTransactionService.name);

	public constructor(
		private readonly prisma: PrismaService,
		private readonly requestContext: RequestContextService,
	) {}

	public async withTenantTransaction<T>(context: TenantDatabaseContext, handler: (tx: TransactionClient) => Promise<T>): Promise<T> {
		await this.prisma.ensureConnected();
		const correlationId: string = this.correlationId();
		return this.checkedOutAs(userRlsContext(context.userId, context.tenantId, true), () =>
			this.prisma.$transaction(async (tx: TransactionClient): Promise<T> => {
				await this.applyTenantSession(tx, context, correlationId);
				return handler(tx);
			}),
		);
	}

	/**
	 * One transaction stamped with the actor's RLS session (`rlsSessionVariables`).
	 * A user scope that requires an explicit tenant and has none fails closed
	 * ({@link MissingTenantContextError}) before any connection is used.
	 * System scopes also write the same audit line as {@link withSystemOperation}, and they keep the
	 * actor's tenant id. Encryption sessions stay on {@link withTenantTransaction} because they
	 * carry a purpose, which an actor does not.
	 */
	public async withRlsContext<T>(scope: RlsTransactionScope, handler: (tx: TransactionClient) => Promise<T>): Promise<T> {
		assertExplicitContext(scope.context);
		await this.prisma.ensureConnected();
		const correlationId: string = this.correlationId();
		if (scope.context.kind === "system") {
			const operation: SystemOperation = parseSystemOperation(scope.context.systemOperation);
			const definition: SystemOperationDefinition = systemOperationDefinition(operation);
			const reason: string = requireSystemReason(scope.reason);
			const audit: SystemOperationAuditEntry = {
				event: "rls.system_operation",
				operation,
				role: definition.role,
				reason,
				actorUserId: scope.context.userId,
				correlationId,
			};
			// One audit line per operation per request: a superadmin page making ten reads under the same
			// scope is one system operation on the request's audit entry, not ten log lines. Outside a
			// request (jobs, boot) every call is logged.
			if (!this.isRecordedForThisRequest(operation)) {
				this.logAudit(definition, audit);
				this.requestContext.recordSystemOperation(operation);
			}
			return this.checkedOutAs(scope.context, () =>
				this.prisma.$transaction(async (tx: TransactionClient): Promise<T> => {
					await this.applyRlsContextSession(tx, scope.context, correlationId, reason);
					return handler(tx);
				}),
			);
		}
		return this.checkedOutAs(scope.context, () =>
			this.prisma.$transaction(async (tx: TransactionClient): Promise<T> => {
				await this.applyRlsContextSession(tx, scope.context, correlationId, null);
				return handler(tx);
			}),
		);
	}

	/**
	 * One transaction under the session already bound to this call (the request interceptor
	 * or a job). A missing session fails closed. A system session records `reason`.
	 */
	public withBoundSession<T>(reason: string, handler: (tx: TransactionClient) => Promise<T>): Promise<T> {
		const context: RlsContext = currentRlsContext();
		return this.withRlsContext({ context, reason: context.kind === "system" ? reason : null }, handler);
	}

	/** The `rls.system_operation` line, at info — or at debug for a `routine` (polled) operation. */
	private logAudit(definition: SystemOperationDefinition, audit: SystemOperationAuditEntry): void {
		if (definition.audit === "routine") {
			this.logger.debug(audit);
			return;
		}
		this.logger.log(audit);
	}

	private isRecordedForThisRequest(operation: SystemOperation): boolean {
		return this.requestContext.current()?.systemOperations.includes(operation) === true;
	}

	/**
	 * Run `handler` in one transaction under an allowlisted system operation:
	 * the operation's role (`SET ROLE`), `app.rls_bypass`, the operation name
	 * and the request's correlation id are all transaction-local. Every call is
	 * audited — a structured log line, plus the operation name on the current
	 * request's audit entry.
	 */
	public async withSystemOperation<T>(context: SystemDatabaseContext, handler: (tx: TransactionClient) => Promise<T>): Promise<T> {
		// Runtime re-check: the type already restricts the name, but a value can
		// still arrive from configuration or a cast-free JSON path.
		const operation: SystemOperation = parseSystemOperation(context.operation);
		const definition: SystemOperationDefinition = systemOperationDefinition(operation);
		await this.prisma.ensureConnected();
		const correlationId: string = this.correlationId();
		const audit: SystemOperationAuditEntry = {
			event: "rls.system_operation",
			operation,
			role: definition.role,
			reason: context.reason,
			actorUserId: context.actorUserId,
			correlationId,
		};
		this.logAudit(definition, audit);
		this.requestContext.recordSystemOperation(operation);
		return this.checkedOutAs(systemRlsContext(operation, context.actorUserId), () =>
			this.prisma.$transaction(async (tx: TransactionClient): Promise<T> => {
				await this.applySystemSession(tx, context, definition, correlationId);
				return handler(tx);
			}),
		);
	}

	/**
	 * Runs one transaction with its OWN scope bound for the connection checkout: the pool stamps a
	 * new connection from the RLS context in scope (`RlsPool`), and the caller's scope — a tenant user
	 * with no tenant, in multi-tenant mode — would refuse a checkout this transaction is entitled
	 * to (a system operation, the audit write). The transaction then sets its session transaction-locally.
	 */
	private checkedOutAs<T>(context: RlsContext, transaction: () => Promise<T>): Promise<T> {
		return rlsStorage.run(context, transaction);
	}

	/**
	 * The current request's correlation id, else the enclosing background work's
	 * (`AsyncLocalCorrelationScope`, e.g. one system command); work outside both
	 * gets a fresh one per transaction.
	 */
	private correlationId(): string {
		return this.requestContext.correlationId() ?? currentWorkCorrelationId() ?? generateCorrelationId();
	}

	private async applyTenantSession(tx: TransactionClient, context: TenantDatabaseContext, correlationId: string): Promise<void> {
		await applySessionVariables(tx, {
			role: DEFAULT_DATABASE_ROLE,
			currentUserId: context.userId,
			currentTenantId: context.tenantId,
			rlsBypass: "false",
			systemOperation: UNSET_SESSION_VALUE,
			// A user's tenant transaction never carries an API-key principal (cleared, not inherited from the checkout).
			currentApiKeyId: UNSET_SESSION_VALUE,
			currentApiKeyLocationId: UNSET_SESSION_VALUE,
			actorPurpose: context.purpose,
			correlationId,
		});
	}

	private async applyRlsContextSession(tx: TransactionClient, context: RlsContext, correlationId: string, reason: string | null): Promise<void> {
		const session = rlsSessionVariables(context);
		await applySessionVariables(tx, {
			...session,
			actorPurpose: reason ?? UNSET_SESSION_VALUE,
			correlationId,
		});
	}

	private async applySystemSession(tx: TransactionClient, context: SystemDatabaseContext, definition: SystemOperationDefinition, correlationId: string): Promise<void> {
		await applySessionVariables(tx, {
			role: definition.role,
			currentUserId: context.actorUserId ?? UNSET_SESSION_VALUE,
			currentTenantId: UNSET_SESSION_VALUE,
			rlsBypass: "true",
			systemOperation: context.operation,
			currentApiKeyId: UNSET_SESSION_VALUE,
			currentApiKeyLocationId: UNSET_SESSION_VALUE,
			actorPurpose: context.reason,
			correlationId,
		});
	}
}

function requireSystemReason(reason: string | null): string {
	if (reason === null || reason.length === 0) {
		throw new Error("A system RLS transaction requires an audit reason.");
	}
	return reason;
}
