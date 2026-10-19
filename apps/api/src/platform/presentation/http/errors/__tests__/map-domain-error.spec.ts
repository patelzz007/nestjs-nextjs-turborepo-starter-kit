import { describe, expect, it } from "vitest";

import { DomainError } from "../../../../domain/errors/domain-error";
import { STANDARD_ERROR_MESSAGES } from "../../../../domain/errors/error-codes";
import { mapDomainError } from "../map-domain-error";

/** A 5xx domain error whose message and details describe internals. */
class CorruptStateProbe extends DomainError {
	public readonly code = "CORRUPT_AGGREGATE_STATE";

	public constructor() {
		super("reward 42 has status=ACTIVE but reserved_quantity=-3 in row 0x7f", { table: "rewards", column: "reserved_quantity" });
	}
}

/** A 4xx domain error: its message and details are written for the client. */
class TakenProbe extends DomainError {
	public readonly code = "EMAIL_TAKEN";

	public constructor() {
		super("This email is already registered.", { field: "email" });
	}
}

describe("mapDomainError", () => {
	it("redacts a 5xx domain error's message and details outside development, keeping its code", () => {
		expect(mapDomainError(new CorruptStateProbe(), { exposeInternalErrors: false })).toEqual({
			httpStatus: 500,
			code: "CORRUPT_AGGREGATE_STATE",
			message: STANDARD_ERROR_MESSAGES.INTERNAL_ERROR,
			details: undefined,
		});
	});

	it("shows a 5xx domain error's message and details in development", () => {
		const mapped = mapDomainError(new CorruptStateProbe(), { exposeInternalErrors: true });

		expect(mapped.message).toContain("reserved_quantity");
		expect(mapped.details).toEqual({ table: "rewards", column: "reserved_quantity" });
	});

	it("always passes a 4xx domain error's message and details through", () => {
		expect(mapDomainError(new TakenProbe(), { exposeInternalErrors: false })).toEqual({
			httpStatus: 409,
			code: "EMAIL_TAKEN",
			message: "This email is already registered.",
			details: { field: "email" },
		});
	});
});
