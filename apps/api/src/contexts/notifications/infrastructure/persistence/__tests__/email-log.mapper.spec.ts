import type { EmailLog as EmailLogRow } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { CorruptEmailLogStateError } from "../../../domain/errors/notifications.errors";
import { toEmailLog, toEmailLogEntry } from "../email-log.mapper";
import { LIVE_ROW_FIELDS } from "../../../../../platform/infrastructure/persistence/__tests__/base-row-fields";

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

describe("email log mapper (D32)", () => {
	it("maps a valid row for commands and for the admin list", () => {
		expect(toEmailLog(row("sent")).status).toBe("sent");
		expect(toEmailLogEntry(row("delivered"))).toMatchObject({ id: ID, status: "delivered", createdAt: 1_800_000_000_000, updatedAt: 1_800_000_000_001 });
	});

	it("refuses an unknown stored status on a command load", () => {
		expect(() => toEmailLog(row("queued"))).toThrow(CorruptEmailLogStateError);
	});

	it("fails the list projection on an unknown stored status instead of hiding or guessing it (no 'unknown' in the shared contract)", () => {
		expect(() => toEmailLogEntry(row("queued"))).toThrow(expect.objectContaining({ code: "CORRUPT_AGGREGATE_STATE", details: { aggregateId: ID } }));
	});
});
