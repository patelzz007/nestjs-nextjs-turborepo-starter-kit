import type { EmailLog as EmailLogRow } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { toEmailLog, toEmailLogEntry } from "../email-log.mapper";
import { LIVE_ROW_FIELDS } from "../../../../../platform/infrastructure/persistence/__tests__/base-row-fields";
import { CorruptAggregateStateError } from "../../../../../platform/domain/errors/corrupt-aggregate-state.error";

const ID = "6b1f3e2a-9c4d-4e5f-8a7b-1c2d3e4f5a6b";

function row(status: string): EmailLogRow {
	return {
		...LIVE_ROW_FIELDS,
		id: ID,
		templateKey: "welcome",
		to: "a@example.com",
		subject: "Welcome",
		status,
		resendId: null,
		error: null,
		metadata: null,
		lastEventAt: null,
		createdAt: 1_800_000_000_000n,
		updatedAt: 1_800_000_000_001n,
	};
}

/** The error `run` throws (the test fails when it throws nothing). */
function thrownBy(run: () => void): Error {
	try {
		run();
	} catch (error) {
		if (error instanceof Error) {
			return error;
		}
	}
	throw new Error("expected the call to throw");
}

describe("email log mapper (D32)", () => {
	it("maps a valid row for commands and for the admin list", () => {
		expect(toEmailLog(row("sent")).status).toBe("sent");
		expect(toEmailLogEntry(row("delivered"))).toMatchObject({ id: ID, status: "delivered", createdAt: 1_800_000_000_000, updatedAt: 1_800_000_000_001 });
	});

	it("refuses an unknown stored status on a command load", () => {
		expect(() => toEmailLog(row("queued"))).toThrow(CorruptAggregateStateError);
	});

	it("fails the list projection on an unknown stored status instead of hiding or guessing it (no 'unknown' in the shared contract)", () => {
		const error = thrownBy(() => toEmailLogEntry(row("queued")));
		expect(error).toBeInstanceOf(CorruptAggregateStateError);
		expect(error instanceof CorruptAggregateStateError ? error.details.aggregateId : undefined).toBe(ID);
	});
});
