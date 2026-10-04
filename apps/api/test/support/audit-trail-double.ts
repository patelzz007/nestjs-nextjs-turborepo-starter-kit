import { vi, type MockInstance } from "vitest";

import { AuditLogRepository } from "../../src/common/audit/audit-log.repository";
import { AuditTrailService } from "../../src/common/audit/audit-trail.service";
import { RequestContextService } from "../../src/common/context/request-context";
import { PrismaService } from "../../src/prisma/prisma.service";
import { TenantTransactionService } from "../../src/prisma/tenant-transaction.service";
import { createTestTypedConfig } from "./test-api-env";

/**
 * A real `AuditTrailService` whose repository never touches a database:
 * `append` / `appendInTransaction` are spies (resolved by default) so a unit
 * test can assert what would have been written, or make the write fail.
 */
export function createAuditTrailDouble(requestContext: RequestContextService = new RequestContextService()): {
	readonly auditTrail: AuditTrailService;
	readonly append: MockInstance<AuditLogRepository["append"]>;
	readonly appendInTransaction: MockInstance<AuditLogRepository["appendInTransaction"]>;
} {
	const repository = new AuditLogRepository(new TenantTransactionService(new PrismaService(createTestTypedConfig()), requestContext));
	const append = vi.spyOn(repository, "append").mockResolvedValue();
	const appendInTransaction = vi.spyOn(repository, "appendInTransaction").mockResolvedValue();
	return { auditTrail: new AuditTrailService(repository, requestContext), append, appendInTransaction };
}
