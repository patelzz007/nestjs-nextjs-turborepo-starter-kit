import type { SystemOperationName } from "../platform/application/system-operation-names";

/**
 * Allowlisted operation every `pnpm db:seed` connection runs under (multi-tenancy plan D24, MT-52).
 * Migrations change schema only; the demo dataset is data, so it is written like any other
 * privileged work — under a named, audited operation whose registry scope lists its tables —
 * and FORCE ROW LEVEL SECURITY applies to the seeding login as to every other.
 */
export const SEED_DEMO_DATASET_OPERATION: SystemOperationName = "seed.demo_dataset";
