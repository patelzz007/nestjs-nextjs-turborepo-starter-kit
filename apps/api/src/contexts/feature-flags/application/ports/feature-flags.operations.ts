import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

// The system operations this context runs under (ADR 012): one written copy of each name
// (`system-operation-single-source.spec.ts`), so a route and the store it calls can't drift apart.

/** The console's reads: flags, configs, revisions, overrides, groups, exposure sums, experiments, with names. */
export const FEATURE_FLAGS_READ_OPERATION: SystemOperationName = "feature_flags.read";
/** The console's writes, each with a reason. */
export const FEATURE_FLAGS_WRITE_OPERATION: SystemOperationName = "feature_flags.write";
/** Loading the catalogue every decision is worked out from: nothing but the flag tables. */
export const FEATURE_FLAGS_EVALUATE_OPERATION: SystemOperationName = "feature_flags.evaluate";
/** The maintenance job: expiring pending revisions, raising the version at scheduled steps. */
export const FEATURE_FLAGS_MAINTENANCE_OPERATION: SystemOperationName = "queue.feature_flags.maintenance";
