import { describe, expect, it } from "vitest";

import { SystemCommandAuditEntrySchema } from "../../../application/ports/command-audit.port";
import { systemCommandAuditEntry } from "../../audit/system-command-audit";
import {
	formatTransactionLogEntry,
	TRANSACTION_LOG_ENTRY_RULE,
	TRANSACTION_LOG_TITLE_RULE,
	transactionLogFileDay,
	transactionLogFileName,
	utcDayOf,
} from "../transaction-log-format";
import { auditEntry, OCCURRED_AT } from "./transaction-log-fixtures";

/** The entry's lines, without the blank line that ends it. */
function linesOf(text: string): string[] {
	return text.split("\n").slice(0, -2);
}

describe("formatTransactionLogEntry — an HTTP request", () => {
	it("opens with a rule and a readable title, then one labelled line per fact, every absent fact said out loud", () => {
		expect(linesOf(formatTransactionLogEntry(auditEntry()))).toEqual([
			TRANSACTION_LOG_ENTRY_RULE,
			"2026-10-26 01:44:26.123 UTC  SUCCEEDED 201  POST /api/v1/rewards",
			TRANSACTION_LOG_TITLE_RULE,
			"  Result       SUCCEEDED: answered 201 after 42 ms",
			"  Endpoint     POST /api/v1/rewards",
			"  Who          anonymous: no credential was presented or accepted",
			"  Tenant       none: not a tenant request",
			"               X-Tenant-Id not sent, X-Location-Id not sent",
			"  Client       app not named (no X-Client-Type), no User-Agent",
			"               IP not recorded",
			"  Trace        correlation corr-1",
		]);
	});

	it("ends every entry with one blank line, and indents everything inside it, so only the opening rule starts a line with '='", () => {
		const text = formatTransactionLogEntry(auditEntry({ requestBody: { note: "==== not a rule" } }));

		expect(text.endsWith("\n\n")).toBe(true);
		expect(text.endsWith("\n\n\n")).toBe(false);
		expect(text.split("\n").filter((line: string): boolean => line.startsWith("="))).toEqual([TRANSACTION_LOG_ENTRY_RULE]);
	});

	it("names the person, their device session and credential, and anyone acting behind them", () => {
		const text = formatTransactionLogEntry(
			auditEntry({
				actorUserId: "u-1",
				actorIdentity: { email: "jane@brew.example", fullName: "Jane Doe" },
				sessionId: "s-1",
				authMethod: "SESSION_COOKIE",
				impersonatorUserId: "admin-1",
				impersonationSessionId: "imp-1",
			}),
		);

		expect(text).toContain(
			[
				"  Who          Jane Doe <jane@brew.example>",
				"               user u-1, session s-1, signed in with SESSION_COOKIE",
				"               impersonated by user admin-1, impersonation session imp-1",
			].join("\n"),
		);
	});

	it("says when a user's name was not recorded, and names an API-key caller by key and terminal", () => {
		expect(formatTransactionLogEntry(auditEntry({ actorUserId: "u-1" }))).toContain(
			"  Who          a signed-in user (name not recorded)\n               user u-1, no device session",
		);
		expect(formatTransactionLogEntry(auditEntry({ apiKeyId: "key-1", terminalId: "T-1" }))).toContain("  Who          API key key-1, POS terminal T-1");
	});

	it("shows the verified tenant with its slug, and the X-Tenant-Id the client sent against it", () => {
		const matching = formatTransactionLogEntry(auditEntry({ tenantId: "t-1", claimedTenantId: "t-1", requestParams: { params: { tenantSlug: "brew-bean-kl" }, query: {} } }));
		const forged = formatTransactionLogEntry(auditEntry({ tenantId: "t-1", claimedTenantId: "t-2", locationId: "loc-1", claimedLocationId: "loc-1" }));
		const unverified = formatTransactionLogEntry(auditEntry({ claimedTenantId: "t-9" }));

		expect(matching).toContain("  Tenant       t-1 (brew-bean-kl), verified by the API\n               X-Tenant-Id t-1 (matches), X-Location-Id not sent");
		expect(forged).toContain(
			"  Tenant       t-1, location loc-1, verified by the API\n               X-Tenant-Id t-2 (DIFFERS from the verified one), X-Location-Id loc-1 (matches)",
		);
		expect(unverified).toContain("               X-Tenant-Id t-9 (not verified), X-Location-Id not sent");
	});

	it("describes the client app, software, device, address and place, and where the request came from", () => {
		const text = formatTransactionLogEntry(
			auditEntry({
				clientType: "merchant",
				browserName: "Chrome",
				browserVersion: "140",
				osName: "macOS",
				osVersion: "15",
				deviceType: "DESKTOP",
				ipAddress: "203.0.113.7",
				ipScope: "PUBLIC",
				geoCity: "Kuala Lumpur",
				geoCountry: "MY",
				origin: "https://merchant.example.com",
				referer: "https://merchant.example.com/t/brew/rewards",
			}),
		);

		expect(text).toContain(
			[
				"  Client       merchant app, Chrome 140 on macOS 15 (DESKTOP)",
				"               IP 203.0.113.7 (PUBLIC), Kuala Lumpur, MY",
				"               origin https://merchant.example.com",
				"               referer https://merchant.example.com/t/brew/rewards",
			].join("\n"),
		);
	});

	it("gives a failure its real reason — cause chain and stack — under the code the caller saw", () => {
		const text = formatTransactionLogEntry(
			auditEntry({
				outcome: "FAILED",
				responseStatus: 500,
				errorCode: "INTERNAL_ERROR",
				errorDetail: {
					type: "PrismaClientKnownRequestError",
					message: "Invalid `update()` invocation:\nRecord to update not found.",
					code: "P2025",
					causes: [{ type: "Error", message: "connection reset", code: "ECONNRESET" }],
					stack: ["at RewardsRepository.update (src/rewards.repository.ts:42:13)"],
				},
			}),
		);

		expect(linesOf(text).slice(1, 9)).toEqual([
			"2026-10-26 01:44:26.123 UTC  FAILED 500 INTERNAL_ERROR  POST /api/v1/rewards",
			TRANSACTION_LOG_TITLE_RULE,
			"  Result       FAILED: answered 500 INTERNAL_ERROR after 42 ms",
			"  Reason       PrismaClientKnownRequestError [P2025]: Invalid `update()` invocation:",
			"                 Record to update not found.",
			"               caused by Error [ECONNRESET]: connection reset",
			"               at RewardsRepository.update (src/rewards.repository.ts:42:13)",
			"  Endpoint     POST /api/v1/rewards",
		]);
	});

	it("says so when a failure's reason was not recorded", () => {
		expect(formatTransactionLogEntry(auditEntry({ outcome: "FAILED", responseStatus: 403, errorCode: "FORBIDDEN" }))).toContain(
			"  Reason       not recorded (a row written before error details were kept)",
		);
	});

	it("lists the trace, the idempotency key and the system operations", () => {
		expect(formatTransactionLogEntry(auditEntry({ traceId: "trace-9", idempotencyKey: "idem-1", systemOperations: ["auth.principal.lookup", "outbox.enqueue"] }))).toContain(
			"  Trace        correlation corr-1, trace trace-9, idempotency key idem-1\n               system operations: auth.principal.lookup, outbox.enqueue",
		);
	});

	it("prints every request header, then the params and bodies the way jq does", () => {
		const text = formatTransactionLogEntry(
			auditEntry({
				requestHeaders: { accept: "application/json", "x-tenant-id": "t-1" },
				requestParams: { params: { id: "r-1" }, query: {} },
				requestBody: { name: "Coffee" },
				responseBody: { id: "r-1" },
			}),
		);

		const expected: string[] = [
			"",
			"  Request headers",
			"    accept: application/json",
			"    x-tenant-id: t-1",
			"",
			"  Request params and query",
			"    {",
			'      "params": {',
			'        "id": "r-1"',
			"      },",
			'      "query": {}',
			"    }",
			"",
			"  Request body",
			"    {",
			'      "name": "Coffee"',
			"    }",
			"",
			"  Response body",
			"    {",
			'      "id": "r-1"',
			"    }",
			"",
			"",
		];
		expect(text.split("\n").slice(-expected.length)).toEqual(expected);
	});
});

describe("formatTransactionLogEntry — a system command", () => {
	it("says the system ran it, why, on which queue, and the real reason it failed", () => {
		const row = systemCommandAuditEntry(
			SystemCommandAuditEntrySchema.parse({
				originKind: "job",
				originName: "claims.expire-referrer",
				commandName: "ExpireOverdueReferrerClaimsCommand",
				input: { actor: { kind: "system", operation: "queue.claims.expire_referrer", reason: "Expire overdue referrer-credit reward claims" } },
				operation: "queue.claims.expire_referrer",
				tenantId: null,
				actorUserId: null,
				correlationId: "e4Qg",
				outcome: "failure",
				errorCode: "INTERNAL_ERROR",
				error: Object.assign(new Error("Record to update not found."), { stack: "Error: Record to update not found." }),
				durationMs: 0,
				occurredAt: Date.UTC(2026, 9, 25, 18, 6, 58, 211),
			}),
		);

		expect(linesOf(formatTransactionLogEntry(row)).slice(0, 12)).toEqual([
			TRANSACTION_LOG_ENTRY_RULE,
			"2026-10-25 18:06:58.211 UTC  FAILED 500 INTERNAL_ERROR  JOB claims.expire-referrer",
			TRANSACTION_LOG_TITLE_RULE,
			"  Result       FAILED: answered 500 INTERNAL_ERROR after 0 ms",
			"  Reason       Error: Record to update not found.",
			"  Command      ExpireOverdueReferrerClaimsCommand (job claims.expire-referrer)",
			"  Who          the system, no user (background work)",
			"               system operation queue.claims.expire_referrer",
			"               why: Expire overdue referrer-credit reward claims",
			"  Tenant       none: platform-wide",
			"  Trace        correlation e4Qg",
			"               system operations: queue.claims.expire_referrer",
		]);
	});
});

describe("day files", () => {
	it("names the file after the UTC day the request arrived", () => {
		expect(utcDayOf(OCCURRED_AT)).toBe("2026-10-26");
		expect(transactionLogFileName(OCCURRED_AT)).toBe("transactions-2026-10-26.txt");
		expect(transactionLogFileName(Date.UTC(2026, 9, 26, 23, 59, 59, 999))).toBe("transactions-2026-10-26.txt");
	});

	it("reads the day back from a day file, and nothing from any other file", () => {
		expect(transactionLogFileDay("transactions-2026-10-26.txt")).toBe("2026-10-26");
		expect(transactionLogFileDay("transactions-2026-10-26.txt.gz")).toBeNull();
		expect(transactionLogFileDay("notes.txt")).toBeNull();
	});
});
