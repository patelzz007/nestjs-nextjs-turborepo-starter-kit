// ============================================
// domain/errors/operations.errors.ts — what the operations console refuses (ADR 068)
// ============================================
// Design patterns:
//   - Each failure is its own DomainError subclass (OOP: one class, one reason), named by the
//     domain; the HTTP status is a presentation decision (`domain-error-status.map.ts`).

import { DomainError } from "../../../../platform/domain/errors/domain-error";
import type { DomainErrorCode } from "../../../../platform/domain/errors/error-codes";

/** Missing or revoked — both answered alike. */
export class OpsServerNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "OPS_SERVER_NOT_FOUND";

	public constructor(public readonly serverId: string) {
		super("Server not found", { serverId });
	}
}

export class OpsServerNameTakenError extends DomainError {
	public readonly code: DomainErrorCode = "OPS_SERVER_NAME_TAKEN";

	public constructor(public readonly serverName: string) {
		super(`A server named "${serverName}" is already registered`, { name: serverName });
	}
}

/** The agent's token matches no live server: wrong, rotated, or the server was revoked. */
export class OpsAgentTokenInvalidError extends DomainError {
	public readonly code: DomainErrorCode = "OPS_AGENT_TOKEN_INVALID";

	public constructor() {
		super("The server agent's token is not valid. Rotate the token in the operations console and update the agent.");
	}
}

export class OpsInstanceNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "OPS_INSTANCE_NOT_FOUND";

	public constructor(public readonly instanceId: string) {
		super("Instance not found", { instanceId });
	}
}

/** Missing or deleted — both answered alike. */
export class OpsBackupNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "OPS_BACKUP_NOT_FOUND";

	public constructor(public readonly backupId: string) {
		super("Backup not found", { backupId });
	}
}

/** Only a finished backup can be downloaded, and only a finished or failed one deleted. */
export class OpsBackupNotReadyError extends DomainError {
	public readonly code: DomainErrorCode = "OPS_BACKUP_NOT_READY";

	public constructor(public readonly backupId: string) {
		super("This backup has not finished yet", { backupId });
	}
}

/** One backup at a time: a second would compete with the first for the same database. */
export class OpsBackupInProgressError extends DomainError {
	public readonly code: DomainErrorCode = "OPS_BACKUP_IN_PROGRESS";

	public constructor() {
		super("A backup is already queued or running. Wait for it to finish.");
	}
}

/** No backup login (BACKUP_DATABASE_URL) or no object storage: nothing can be backed up here. */
export class OpsBackupNotConfiguredError extends DomainError {
	public readonly code: DomainErrorCode = "OPS_BACKUP_NOT_CONFIGURED";

	public constructor(reason: string) {
		super(`Backups are not set up on this deployment: ${reason}`);
	}
}

/** A backup download needs a second-factor proof younger than the step-up window. */
export class OpsBackupStepUpRequiredError extends DomainError {
	public readonly code: DomainErrorCode = "MFA_STEP_UP_REQUIRED";

	public constructor() {
		super("Confirm it's you with your authenticator before downloading a backup.");
	}
}

/** Load testing is off on this deployment (`LOAD_TESTING_ENABLED`, and the production override). */
export class LoadTestingDisabledError extends DomainError {
	public readonly code: DomainErrorCode = "LOAD_TEST_DISABLED";

	public constructor(reason: string) {
		super(reason);
	}
}

/** The run asks for more than the caps in force allow. */
export class LoadTestOverCapError extends DomainError {
	public readonly code: DomainErrorCode = "LOAD_TEST_OVER_CAP";

	public constructor(field: string, requested: number, cap: number) {
		super(`${field} ${String(requested)} is over the cap of ${String(cap)}`, { field, requested, cap });
	}
}

/** One load test at a time. */
export class LoadTestAlreadyRunningError extends DomainError {
	public readonly code: DomainErrorCode = "LOAD_TEST_ALREADY_RUNNING";

	public constructor(public readonly runId: string) {
		super("Another load test is queued or running. Wait for it to finish or abort it.", { runId });
	}
}

export class LoadTestNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "LOAD_TEST_NOT_FOUND";

	public constructor(public readonly runId: string) {
		super("Load test not found", { runId });
	}
}

/** Only a queued or running load test can be aborted. */
export class LoadTestNotRunningError extends DomainError {
	public readonly code: DomainErrorCode = "LOAD_TEST_NOT_RUNNING";

	public constructor(public readonly runId: string) {
		super("This load test has already ended", { runId });
	}
}

/** A single-endpoint load test may only name a read (`GET`) route a load-test user can call. */
export class LoadTestEndpointInvalidError extends DomainError {
	public readonly code: DomainErrorCode = "LOAD_TEST_ENDPOINT_INVALID";

	public constructor(public readonly endpoint: string) {
		super(`${endpoint} is not a read endpoint a load test can call`, { endpoint });
	}
}

/** The purge refuses while a load test is queued or running: it would delete rows the run is writing. */
export class LoadTestPurgeBlockedError extends DomainError {
	public readonly code: DomainErrorCode = "LOAD_TEST_PURGE_BLOCKED";

	public constructor() {
		super("Wait for the running load test to finish before purging its data.");
	}
}
