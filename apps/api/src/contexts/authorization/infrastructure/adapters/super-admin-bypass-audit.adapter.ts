import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { RequestContextService } from "../../../../platform/infrastructure/context/request-context";
import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { SuperAdminBypassAuditPort } from "../../application/ports/authorization-kernel.port";
import { PrismaPermissionAuditWriter } from "../persistence/prisma-permission-audit.writer";

/** The bypass audit the guard writes before the handler's RLS scope exists. */
interface BypassAuditTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/**
 * The SuperAdmin platform bypass on a protected route, written to `PermissionAuditLog`.
 */
@Injectable()
export class SuperAdminBypassAuditAdapter implements SuperAdminBypassAuditPort {
	public constructor(
		@Inject(TenantTransactionService) private readonly transactions: BypassAuditTransactions,
		private readonly requestContext: RequestContextService,
	) {}

	public async recordBypass(userId: string, detail: string): Promise<void> {
		await this.transactions.withSystemOperation(
			{ operation: "authorization.superadmin_bypass.audit", reason: "Record a superadmin authorization bypass", actorUserId: userId },
			(tx) => new PrismaPermissionAuditWriter(tx, this.requestContext).append({ action: "SUPER_ADMIN_BYPASS", actor: { kind: "USER", userId }, detail }),
		);
	}
}
