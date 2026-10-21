import { describe, expect, it } from "vitest";

import { CorruptAggregateStateError } from "../corrupt-aggregate-state.error";
import { DomainError } from "../domain-error";

describe("CorruptAggregateStateError", () => {
	it("is the one CORRUPT_AGGREGATE_STATE error every context throws, naming the aggregate, its id and the reason", () => {
		const error = new CorruptAggregateStateError("reward", "reward-1", "unknown status EXPIRED");

		expect(error).toBeInstanceOf(DomainError);
		expect(error.code).toBe("CORRUPT_AGGREGATE_STATE");
		expect(error.message).toBe("Stored reward state cannot be loaded.");
		expect(error.details).toEqual({ aggregate: "reward", aggregateId: "reward-1", reason: "unknown status EXPIRED" });
	});

	it("accepts an invariant about a value that has no row yet", () => {
		expect(new CorruptAggregateStateError("user_account", null).details).toEqual({ aggregate: "user_account", aggregateId: null, reason: null });
	});
});
