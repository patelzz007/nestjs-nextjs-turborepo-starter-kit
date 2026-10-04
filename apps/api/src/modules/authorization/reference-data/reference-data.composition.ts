import { NodeOperatorIdentityProvider } from "../../../common/operator-identity";
import { RequestContextService } from "../../../common/context/request-context";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { AuthorizationAuditService } from "../audit/authorization-audit.service";
import { REFERENCE_DATA_SYNC_OPERATION, ReferenceDataSyncService } from "./reference-data-sync.service";
import { createReferenceDataSections } from "./reference-data.sections";
import type { ReferenceDataTransactionRunner } from "./reference-data.types";

const SYNC_REASON = "Converge the platform reference data to the code's catalog";

/** The sync over any transaction runner. The seed passes a plain `$transaction`; the command uses {@link systemOperationRunner}. */
export function createReferenceDataSyncService(run: ReferenceDataTransactionRunner): ReferenceDataSyncService {
	return new ReferenceDataSyncService(run, createReferenceDataSections(), new AuthorizationAuditService(new RequestContextService()), new NodeOperatorIdentityProvider());
}

/** Each section's transaction runs under the allowlisted `reference_data.sync` system operation (role + RLS bypass enforced by PostgreSQL). */
export function systemOperationRunner(tenantTx: TenantTransactionService): ReferenceDataTransactionRunner {
	return (handler) => tenantTx.withSystemOperation({ operation: REFERENCE_DATA_SYNC_OPERATION, reason: SYNC_REASON, actorUserId: null }, handler);
}
