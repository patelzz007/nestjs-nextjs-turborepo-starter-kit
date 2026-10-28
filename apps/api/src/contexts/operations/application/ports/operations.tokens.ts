// ============================================
// application/ports/operations.tokens.ts — the context's system operations and DI tokens
// ============================================

import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** A server agent's report (authenticated by its token, not a session). */
export const OPS_AGENT_REPORT_OPERATION: SystemOperationName = "operations.agent.report";
/** Every read of the console, after the route's permission check. */
export const OPS_CONSOLE_READ_OPERATION: SystemOperationName = "operations.console.read";
export const OPS_SERVERS_WRITE_OPERATION: SystemOperationName = "operations.servers.write";
export const OPS_SETTINGS_WRITE_OPERATION: SystemOperationName = "operations.settings.write";
export const OPS_MONITOR_COLLECT_OPERATION: SystemOperationName = "operations.monitor.collect";
export const OPS_INSTANCE_RECORD_OPERATION: SystemOperationName = "operations.instance.record";
export const OPS_HISTORY_MAINTAIN_OPERATION: SystemOperationName = "operations.history.maintain";
export const OPS_BACKUP_WRITE_OPERATION: SystemOperationName = "operations.backup.write";
export const OPS_BACKUP_RUN_OPERATION: SystemOperationName = "operations.backup.run";
export const LOAD_TEST_WRITE_OPERATION: SystemOperationName = "load_test.write";
export const LOAD_TEST_RECORD_OPERATION: SystemOperationName = "load_test.record";
export const LOAD_TEST_PURGE_OPERATION: SystemOperationName = "load_test.purge";

/** The operations unit of work (`UnitOfWork<OperationsScope>`). */
export const OPS_UNIT_OF_WORK = Symbol("OPS_UNIT_OF_WORK");
/** Read-only access to the console's repositories (`OperationsReads`). */
export const OPS_READS = Symbol("OPS_READS");

// ── The context's services (plain classes built by factories in operations.module.ts, so the
// application layer stays free of Nest; these tokens name them for injection) ──

export const BACKUP_RUNNER = Symbol("BACKUP_RUNNER");
export const INSTANCE_REPORTER = Symbol("INSTANCE_REPORTER");
export const OPERATIONS_MONITOR = Symbol("OPERATIONS_MONITOR");
export const HISTORY_MAINTAINER = Symbol("HISTORY_MAINTAINER");
export const LOAD_TEST_RECORDER = Symbol("LOAD_TEST_RECORDER");
export const OPERATIONS_READ = Symbol("OPERATIONS_READ");
export const REQUEST_METRICS = Symbol("REQUEST_METRICS");
