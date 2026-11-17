import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/**
 * Reads only the flag tables: a till's request asking about a store flag, the API asking about a deployment-wide flag,
 * and a signed-out visitor asking whether customer tiers are on (ADR 085) learn nothing else. The one written copy of
 * the name (`system-operation-single-source.spec.ts`).
 */
export const FEATURE_FLAGS_EVALUATE_OPERATION: SystemOperationName = "feature_flags.evaluate";
