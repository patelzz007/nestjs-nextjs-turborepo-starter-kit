import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { generateCorrelationId } from "../common/context/correlation-id";
import { RequestContextService } from "../common/context/request-context";
import { DEFAULT_DATABASE_ROLE, parseSystemOperation, systemOperationDefinition, type SystemOperation, type SystemOperationDefinition } from "./system-operation.registry";
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
		return this.prisma.$transaction(async (tx: TransactionClient): Promise<T> => {
			await this.applyTenantSession(tx, context, correlationId);
			return handler(tx);
		});
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
		this.logger.log(audit);
		this.requestContext.recordSystemOperation(operation);
		return this.prisma.$transaction(async (tx: TransactionClient): Promise<T> => {
			await this.applySystemSession(tx, context, definition, correlationId);
			return handler(tx);
		});
	}

	/** The current request's correlation id; work outside a request gets a fresh one per transaction. */
	private correlationId(): string {
		return this.requestContext.correlationId() ?? generateCorrelationId();
	}

	private async applyTenantSession(tx: TransactionClient, context: TenantDatabaseContext, correlationId: string): Promise<void> {
		await tx.$executeRaw`SELECT set_config('role', ${DEFAULT_DATABASE_ROLE}, true)`;
		await tx.$executeRaw`SELECT set_config('app.current_user_id', ${context.userId}, true)`;
		await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${context.organizationId}, true)`;
		await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'false', true)`;
		await tx.$executeRaw`SELECT set_config('app.system_operation', '', true)`;
		// A user's tenant transaction never carries an API-key principal (cleared, not inherited from the checkout).
		await tx.$executeRaw`SELECT set_config('app.current_api_key_id', '', true)`;
		await tx.$executeRaw`SELECT set_config('app.current_api_key_location_id', '', true)`;
		await tx.$executeRaw`SELECT set_config('app.actor_purpose', ${context.purpose}, true)`;
		await tx.$executeRaw`SELECT set_config('app.policy_version', ${String(context.policyVersion)}, true)`;
		await tx.$executeRaw`SELECT set_config('app.correlation_id', ${correlationId}, true)`;
	}

	private async applySystemSession(tx: TransactionClient, context: SystemDatabaseContext, definition: SystemOperationDefinition, correlationId: string): Promise<void> {
		await tx.$executeRaw`SELECT set_config('role', ${definition.role}, true)`;
		await tx.$executeRaw`SELECT set_config('app.current_user_id', ${context.actorUserId ?? ""}, true)`;
		await tx.$executeRaw`SELECT set_config('app.current_organization_id', '', true)`;
		await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'true', true)`;
		await tx.$executeRaw`SELECT set_config('app.system_operation', ${context.operation}, true)`;
		await tx.$executeRaw`SELECT set_config('app.current_api_key_id', '', true)`;
		await tx.$executeRaw`SELECT set_config('app.current_api_key_location_id', '', true)`;
		await tx.$executeRaw`SELECT set_config('app.actor_purpose', ${context.reason}, true)`;
		await tx.$executeRaw`SELECT set_config('app.correlation_id', ${correlationId}, true)`;
	}
}
