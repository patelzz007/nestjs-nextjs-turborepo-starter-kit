/**
 * Loads (or converges) the platform reference data a deployment needs before anything else works:
 * the permission catalog, system roles and their grants, and the merchant capability catalog.
 * Idempotent and non-destructive: safe on every deploy, never creates users or demo data, and writes
 * nothing when the database already matches. The seed calls the same loader.
 *
 * Usage: pnpm --filter @workspace/api db:sync-reference-data
 * Command-line entry point only (run through tsx; not part of the API bundle).
 * See docs/technical/operations/superadmin-bootstrap.md.
 */
import { Logger } from "@nestjs/common";

import { RequestContextService } from "../../../common/context/request-context";
import { getApiConfig } from "../../../config/api-config";
import { TypedConfigService } from "../../../config/typed-config.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { createReferenceDataSyncService, systemOperationRunner } from "./reference-data.composition";
import { formatReferenceDataReport, SYNC_REFERENCE_DATA_EXIT_CODES } from "./sync-reference-data.command";

const logger: Logger = new Logger("ReferenceDataSync");
const prisma: PrismaService = new PrismaService(new TypedConfigService(getApiConfig()));

try {
	const tenantTx = new TenantTransactionService(prisma, new RequestContextService());
	logger.log(formatReferenceDataReport(await createReferenceDataSyncService(systemOperationRunner(tenantTx)).sync()));
	process.exitCode = SYNC_REFERENCE_DATA_EXIT_CODES.success;
} catch (error) {
	logger.error(`The reference data sync failed (sections already committed stay; re-run to continue): ${error instanceof Error ? error.message : "unknown failure"}`);
	process.exitCode = SYNC_REFERENCE_DATA_EXIT_CODES.failed;
} finally {
	await prisma.$disconnect();
}
