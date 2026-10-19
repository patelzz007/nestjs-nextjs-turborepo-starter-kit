import { HttpAuditLogListQuerySchema, LIST_SLOT_INDEX } from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { NotFoundError } from "../../../../platform/application/errors/app-error";
import { AUDIT_READ_OPERATION } from "../audit-read-operations";
import { GetHttpAuditLogHandler } from "../queries/get-http-audit-log/get-http-audit-log.handler";
import { GetHttpAuditLogQuery } from "../queries/get-http-audit-log/get-http-audit-log.query";
import { ListHttpAuditLogsHandler } from "../queries/list-http-audit-logs/list-http-audit-logs.handler";
import { ListHttpAuditLogsQuery } from "../queries/list-http-audit-logs/list-http-audit-logs.query";
import { httpAuditLogDetail, httpAuditLogSummary, many, recordId, VIEWER, VIEWER_ID } from "./fakes/audit-records.fixtures";
import { InMemoryAuditReadSession } from "./fakes/in-memory-audit-read-session";

/** Records in the store for the paging cases: two full pages of 2 and one record on the last. */
const STORED_RECORDS = 5;
const PAGE_SIZE = 2;
const LAST_PAGE = 3;

describe("ListHttpAuditLogsHandler", () => {
	let session: InMemoryAuditReadSession;
	let handler: ListHttpAuditLogsHandler;

	beforeEach(() => {
		session = new InMemoryAuditReadSession();
		handler = new ListHttpAuditLogsHandler(session);
	});

	it("reads under the allowlisted audit read operation, as the viewer", async () => {
		await handler.execute(new ListHttpAuditLogsQuery(VIEWER, HttpAuditLogListQuerySchema.parse({})));

		expect(session.opened).toEqual([{ operation: AUDIT_READ_OPERATION, reason: "Admin audit viewer list", actor: VIEWER }]);
	});

	it("returns the page and records what it released — never the records — in the same read", async () => {
		session.httpAuditLogs.summaries.push(httpAuditLogSummary(1));

		const page = await handler.execute(new ListHttpAuditLogsQuery(VIEWER, HttpAuditLogListQuerySchema.parse({})));

		expect(page.items[LIST_SLOT_INDEX.first]).toMatchObject({ id: recordId(1), actor: { email: "admin@example.com" } });
		expect(session.committedSummaries).toEqual([{ auditLogView: { view: "list", returned: 1, total: 1, page: 1 } }]);
	});

	it("records an empty page as an empty release", async () => {
		const page = await handler.execute(new ListHttpAuditLogsQuery(VIEWER, HttpAuditLogListQuerySchema.parse({})));

		expect(page).toMatchObject({ items: [], total: 0 });
		expect(session.committedSummaries).toEqual([{ auditLogView: { view: "list", returned: 0, total: 0, page: 1 } }]);
	});

	it.each([
		{ page: 1, returned: PAGE_SIZE, hasNext: true, hasPrevious: false },
		{ page: LAST_PAGE, returned: 1, hasNext: false, hasPrevious: true },
		{ page: LAST_PAGE + 1, returned: 0, hasNext: false, hasPrevious: true },
	])("pages the store: page $page releases $returned", async ({ page, returned, hasNext, hasPrevious }) => {
		session.httpAuditLogs.summaries.push(...many(STORED_RECORDS, httpAuditLogSummary));

		const result = await handler.execute(new ListHttpAuditLogsQuery(VIEWER, HttpAuditLogListQuerySchema.parse({ page: String(page), limit: String(PAGE_SIZE) })));

		expect(result).toMatchObject({ total: STORED_RECORDS, page, hasNext, hasPrevious });
		expect(result.items).toHaveLength(returned);
		expect(session.committedSummaries).toEqual([{ auditLogView: { view: "list", returned, total: STORED_RECORDS, page } }]);
	});

	it("releases nothing when the sensitive-read row cannot be written: the read rolls back", async () => {
		session.httpAuditLogs.summaries.push(httpAuditLogSummary(1));
		const failure = new Error("database unavailable");
		session.sensitiveReads.failWith = failure;

		await expect(handler.execute(new ListHttpAuditLogsQuery(VIEWER, HttpAuditLogListQuerySchema.parse({})))).rejects.toBe(failure);
		expect(session.rolledBack).toHaveLength(1);
		expect(session.committedSummaries).toEqual([]);
	});

	it("passes whichever actor opened the viewer through to the read", async () => {
		const superAdmin: ActorContext = {
			kind: "user",
			userId: VIEWER_ID,
			sessionId: "session-2",
			organizationId: null,
			isSuperAdmin: true,
			accessScope: "superadmin",
			impersonatorUserId: null,
			request: { requestId: "corr-super", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
			routeRlsBypass: false,
		};

		await handler.execute(new ListHttpAuditLogsQuery(superAdmin, HttpAuditLogListQuerySchema.parse({})));

		expect(session.opened.at(LIST_SLOT_INDEX.first)?.actor).toBe(superAdmin);
	});
});

describe("GetHttpAuditLogHandler", () => {
	let session: InMemoryAuditReadSession;
	let handler: GetHttpAuditLogHandler;

	beforeEach(() => {
		session = new InMemoryAuditReadSession();
		session.httpAuditLogs.details.push(httpAuditLogDetail(1));
		handler = new GetHttpAuditLogHandler(session);
	});

	it("returns the complete record, payloads included, read under the audit read operation", async () => {
		const detail = await handler.execute(new GetHttpAuditLogQuery(VIEWER, { id: recordId(1) }));

		expect(detail).toMatchObject({ id: recordId(1), requestBody: { name: "Mug" }, responseBody: { success: true }, host: "api.example.com" });
		expect(session.opened).toEqual([{ operation: AUDIT_READ_OPERATION, reason: "Admin audit viewer detail", actor: VIEWER }]);
	});

	it("records which record was opened", async () => {
		await handler.execute(new GetHttpAuditLogQuery(VIEWER, { id: recordId(1) }));

		expect(session.committedSummaries).toEqual([{ auditLogView: { view: "detail", auditLogId: recordId(1), correlationId: "corr-1" } }]);
	});

	it("answers 404 for an unknown id and writes no sensitive-read row", async () => {
		const missing = handler.execute(new GetHttpAuditLogQuery(VIEWER, { id: recordId(2) }));

		await expect(missing).rejects.toBeInstanceOf(NotFoundError);
		await expect(missing).rejects.toMatchObject({ message: "The requested resource was not found.", details: { resourceId: recordId(2) } });
		expect(session.committedSummaries).toEqual([]);
	});

	it("releases nothing when the sensitive-read row cannot be written", async () => {
		const failure = new Error("database unavailable");
		session.sensitiveReads.failWith = failure;

		await expect(handler.execute(new GetHttpAuditLogQuery(VIEWER, { id: recordId(1) }))).rejects.toBe(failure);
		expect(session.rolledBack).toHaveLength(1);
	});
});
