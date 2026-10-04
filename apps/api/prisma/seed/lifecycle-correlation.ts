import { CorrelationIdSchema } from "../../src/common/context/correlation-id";
import { deterministicUuid } from "./deterministic-uuid";

const LIFECYCLE_CORRELATION_NAMESPACE = "organization-lifecycle-correlation";

/**
 * The correlation id a seeded organization lifecycle event carries — the value
 * the app stamps from the request (or system operation) that made the
 * transition. Deterministic per event key, so re-running the seed converges,
 * and validated by the same `CorrelationIdSchema` the API accepts.
 */
export function seedLifecycleCorrelationId(eventKey: string): string {
	return CorrelationIdSchema.parse(`seed-${deterministicUuid(LIFECYCLE_CORRELATION_NAMESPACE, eventKey)}`);
}
