// ============================================
// application/operations-scope.ts — what one operations unit of work can touch
// ============================================
// Built per transaction by `OperationsScopeFactory` (infrastructure/persistence). Reads get the same
// repositories without the email port: a read never requests an email.

import type { EmailRequestTransactionalPort } from "../../notifications/public-api";
import type {
	LoadTestRepository,
	OpsAlertRecipientsReader,
	OpsAlertRepository,
	OpsBackupRepository,
	OpsHistoryRepository,
	OpsServerRepository,
	OpsSettingsRepository,
} from "./ports/operations-repositories.port";
import type { LoadTestProvisioningPort, LoadTestPurgePort } from "./ports/load-test-tenant.port";

export interface OperationsReadScope {
	readonly servers: OpsServerRepository;
	readonly history: OpsHistoryRepository;
	readonly alerts: OpsAlertRepository;
	readonly settings: OpsSettingsRepository;
	readonly recipients: OpsAlertRecipientsReader;
	readonly backups: OpsBackupRepository;
	readonly loadTests: LoadTestRepository;
	readonly loadTestTenant: LoadTestProvisioningPort;
}

export interface OperationsScope extends OperationsReadScope {
	/** Emails requested here commit (or roll back) with the unit of work (ADR 060). */
	readonly emails: EmailRequestTransactionalPort;
	readonly purge: LoadTestPurgePort;
}
