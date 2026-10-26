import { vi, type MockInstance } from "vitest";

import { AuditLogRepository } from "../../src/platform/infrastructure/audit/audit-log.repository";
import { AuditTrailService } from "../../src/platform/infrastructure/audit/audit-trail.service";
import { RequestContextService } from "../../src/platform/infrastructure/context/request-context";
import { DisabledTransactionLog, type TransactionLog } from "../../src/platform/infrastructure/transaction-log/transaction-log.port";
import { PrismaService } from "../../src/prisma/prisma.service";
import { TenantTransactionService } from "../../src/prisma/tenant-transaction.service";
import { createTestTypedConfig } from "./test-api-env";

/**
 * A real `AuditTrailService` whose repository never touches a database:
 * `append` / `appendInTransaction` are spies (resolved by default) so a unit
 * test can assert what would have been written, or make the write fail.
 * `recordTransaction` spies on what reaches the plain-text transaction log.
 */
export function createAuditTrailDouble(requestContext: RequestContextService = new RequestContextService()): {
	readonly auditTrail: AuditTrailService;
	readonly append: MockInstance<AuditLogRepository["append"]>;
	readonly appendInTransaction: MockInstance<AuditLogRepository["appendInTransaction"]>;
	readonly recordTransaction: MockInstance<TransactionLog["record"]>;
} {
	const repository = new AuditLogRepository(new TenantTransactionService(new PrismaService(createTestTypedConfig()), requestContext));
	const append = vi.spyOn(repository, "append").mockResolvedValue();
	const appendInTransaction = vi.spyOn(repository, "appendInTransaction").mockResolvedValue();
	const transactionLog = new DisabledTransactionLog();
	const recordTransaction = vi.spyOn(transactionLog, "record");
	return { auditTrail: new AuditTrailService(repository, requestContext, transactionLog), append, appendInTransaction, recordTransaction };
}
