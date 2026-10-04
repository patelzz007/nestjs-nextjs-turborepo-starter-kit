import { describe, expect, it } from "vitest";

import { CorrelationIdSchema } from "../../src/common/context/correlation-id";
import { seedLifecycleCorrelationId } from "./lifecycle-correlation";

describe("seedLifecycleCorrelationId", () => {
	it("is deterministic per event, so a re-run converges on the same value", () => {
		expect(seedLifecycleCorrelationId("kl:activated")).toBe(seedLifecycleCorrelationId("kl:activated"));
		expect(seedLifecycleCorrelationId("kl:activated")).not.toBe(seedLifecycleCorrelationId("mlk:activated"));
	});

	it("is a correlation id the API itself would accept", () => {
		expect(CorrelationIdSchema.safeParse(seedLifecycleCorrelationId("sunrise:deletion-requested")).success).toBe(true);
	});
});
