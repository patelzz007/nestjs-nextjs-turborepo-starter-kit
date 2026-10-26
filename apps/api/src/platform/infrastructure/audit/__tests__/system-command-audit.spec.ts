import { describe, expect, it } from "vitest";

import { SystemCommandAuditEntrySchema, type SystemCommandAuditEntry } from "../../../application/ports/command-audit.port";
import { systemCommandAuditEntry, systemCommandRowOrigin, SYSTEM_COMMAND_FAILURE_STATUS } from "../system-command-audit";

function commandEntry(overrides: Partial<SystemCommandAuditEntry> = {}): SystemCommandAuditEntry {
	return SystemCommandAuditEntrySchema.parse({
		originKind: "job",
		originName: "claims.expire-referrer",
		commandName: "ExpireOverdueReferrerClaimsCommand",
		input: { actor: { kind: "system", reason: "Expire overdue referrer-credit reward claims" } },
		operation: "queue.claims.expire_referrer",
		tenantId: null,
		actorUserId: null,
		correlationId: "corr-job-1",
		outcome: "success",
		errorCode: null,
		error: null,
		durationMs: 3,
		occurredAt: 1_791_504_000_000,
		...overrides,
	});
}

describe("systemCommandAuditEntry", () => {
	it("records the real cause of a failed command, stack included — the code alone says only INTERNAL_ERROR", () => {
		const cause = new Error("connect ECONNREFUSED 127.0.0.1:6379");
		const row = systemCommandAuditEntry(commandEntry({ outcome: "failure", errorCode: "INTERNAL_ERROR", error: new Error("claims query failed", { cause }) }));

		expect(row.responseStatus).toBe(SYSTEM_COMMAND_FAILURE_STATUS);
		expect(row.errorCode).toBe("INTERNAL_ERROR");
		expect(row.errorDetail).toMatchObject({
			type: "Error",
			message: "claims query failed",
			causes: [{ type: "Error", message: "connect ECONNREFUSED 127.0.0.1:6379", code: null }],
		});
		expect(row.errorDetail?.stack.length).toBeGreaterThan(0);
	});

	it("records no cause for a success, and no request facts a command does not have", () => {
		const row = systemCommandAuditEntry(commandEntry());

		expect(row).toMatchObject({ errorDetail: null, requestHeaders: null, sessionId: null, claimedTenantId: null, claimedLocationId: null, actorIdentity: null });
	});
});

describe("systemCommandRowOrigin", () => {
	it("reads the origin back from a row the system command mapping wrote", () => {
		expect(systemCommandRowOrigin(systemCommandAuditEntry(commandEntry()))).toEqual({ kind: "job", name: "claims.expire-referrer" });
	});

	it("answers null for an HTTP request's row", () => {
		expect(systemCommandRowOrigin({ method: "GET", path: "/api/v1/rewards" })).toBeNull();
		expect(systemCommandRowOrigin({ method: "POST", path: "job:claims.expire-referrer" })).toBeNull();
	});
});
