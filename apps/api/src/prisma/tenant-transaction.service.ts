import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { type PrismaClient } from "@prisma/client";

import { isAllowlistedSystemOperation } from "./system-operation.registry";
import type { SystemDatabaseContext, TenantDatabaseContext } from "./tenant-context";
import { PrismaService } from "./prisma.service";

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

@Injectable()
export class TenantTransactionService {
	private readonly logger: Logger = new Logger(TenantTransactionService.name);

	public constructor(private readonly prisma: PrismaService) {}

	public async withTenantTransaction<T>(context: TenantDatabaseContext, handler: (tx: TransactionClient) => Promise<T>): Promise<T> {
		await this.prisma.ensureConnected();
		return this.prisma.$transaction(async (tx: TransactionClient): Promise<T> => {
			await this.applyTenantSession(tx, context);
			return handler(tx);
		});
	}

	public async withSystemOperation<T>(context: SystemDatabaseContext, handler: (tx: TransactionClient) => Promise<T>): Promise<T> {
		if (!isAllowlistedSystemOperation(context.operation)) {
			throw new ForbiddenException(`System operation not allowlisted: ${context.operation}`);
		}
		await this.prisma.ensureConnected();
		this.logger.debug(`System operation ${context.operation} correlation=${context.correlationId}`);
		return this.prisma.$transaction(async (tx: TransactionClient): Promise<T> => {
			await this.applySystemSession(tx, context);
			return handler(tx);
		});
	}

	private async applyTenantSession(tx: TransactionClient, context: TenantDatabaseContext): Promise<void> {
		await tx.$executeRaw`SELECT set_config('role', 'app_runtime', true)`;
		await tx.$executeRaw`SELECT set_config('app.current_user_id', ${context.userId}, true)`;
		await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${context.organizationId}, true)`;
		await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'false', true)`;
		await tx.$executeRaw`SELECT set_config('app.system_operation', '', true)`;
		await tx.$executeRaw`SELECT set_config('app.actor_purpose', ${context.purpose}, true)`;
		await tx.$executeRaw`SELECT set_config('app.policy_version', ${String(context.policyVersion)}, true)`;
	}

	private async applySystemSession(tx: TransactionClient, context: SystemDatabaseContext): Promise<void> {
		await tx.$executeRaw`SELECT set_config('role', 'app_runtime', true)`;
		await tx.$executeRaw`SELECT set_config('app.current_user_id', ${context.actorUserId ?? ""}, true)`;
		await tx.$executeRaw`SELECT set_config('app.current_organization_id', '', true)`;
		await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'true', true)`;
		await tx.$executeRaw`SELECT set_config('app.system_operation', ${context.operation}, true)`;
		await tx.$executeRaw`SELECT set_config('app.actor_purpose', ${context.reason}, true)`;
	}
}
