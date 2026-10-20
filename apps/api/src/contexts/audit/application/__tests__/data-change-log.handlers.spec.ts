import { DataChangeLogListQuerySchema, LIST_SLOT_INDEX } from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { NotFoundError } from "../../../../platform/application/errors/app-error";
import { DATA_CHANGE_READ_OPERATION } from "../audit-read-operations";
import { GetDataChangeHandler } from "../queries/get-data-change/get-data-change.handler";
import { GetDataChangeQuery } from "../queries/get-data-change/get-data-change.query";
import { ListDataChangesHandler } from "../queries/list-data-changes/list-data-changes.handler";
import { ListDataChangesQuery } from "../queries/list-data-changes/list-data-changes.query";
import { dataChangeLogDetail, dataChangeLogSummary, many, recordId, VIEWER } from "./fakes/audit-records.fixtures";
import { InMemoryAuditReadSession } from "./fakes/in-memory-audit-read-session";

/** Records in the store for the paging cases. */
const STORED_RECORDS = 3;
const PAGE_SIZE = 2;

describe("ListDataChangesHandler", () => {
	let session: InMemoryAuditReadSession;
	let handler: ListDataChangesHandler;

	beforeEach(() => {
		session = new InMemoryAuditReadSession();
		handler = new ListDataChangesHandler(session);
	});

	it("reads under the allowlisted data-change read operation, as the viewer", async () => {
		await handler.execute(new ListDataChangesQuery(VIEWER, DataChangeLogListQuerySchema.parse({})));

		expect(session.opened).toEqual([{ operation: DATA_CHANGE_READ_OPERATION, reason: "Admin data-change viewer list", actor: VIEWER }]);
	});

	it("returns the page and records what it released in the same read", async () => {
		session.dataChangeLogs.summaries.push(dataChangeLogSummary(1));

		const page = await handler.execute(new ListDataChangesQuery(VIEWER, DataChangeLogListQuerySchema.parse({})));

		expect(page.items[LIST_SLOT_INDEX.first]).toMatchObject({ id: recordId(1), tableName: "Reward", tenant: { name: "Kopi Corner" } });
		expect(session.committedSummaries).toEqual([{ dataChangeView: { view: "list", returned: 1, total: 1, page: 1 } }]);
	});

	it("records an empty page as an empty release", async () => {
		await handler.execute(new ListDataChangesQuery(VIEWER, DataChangeLogListQuerySchema.parse({})));

		expect(session.committedSummaries).toEqual([{ dataChangeView: { view: "list", returned: 0, total: 0, page: 1 } }]);
	});

	it("records the page it released, not the whole store", async () => {
		session.dataChangeLogs.summaries.push(...many(STORED_RECORDS, dataChangeLogSummary));

		await handler.execute(new ListDataChangesQuery(VIEWER, DataChangeLogListQuerySchema.parse({ page: "2", limit: String(PAGE_SIZE) })));

		expect(session.committedSummaries).toEqual([{ dataChangeView: { view: "list", returned: 1, total: STORED_RECORDS, page: 2 } }]);
	});

	it("releases nothing when the sensitive-read row cannot be written", async () => {
		const failure = new Error("database unavailable");
		session.sensitiveReads.failWith = failure;

		await expect(handler.execute(new ListDataChangesQuery(VIEWER, DataChangeLogListQuerySchema.parse({})))).rejects.toBe(failure);
		expect(session.rolledBack).toHaveLength(1);
		expect(session.committedSummaries).toEqual([]);
	});
});

describe("GetDataChangeHandler", () => {
	let session: InMemoryAuditReadSession;
	let handler: GetDataChangeHandler;

	beforeEach(() => {
		session = new InMemoryAuditReadSession();
		session.dataChangeLogs.details.push(dataChangeLogDetail(1));
		handler = new GetDataChangeHandler(session);
	});

	it("returns the complete record with its row images, read under the data-change read operation", async () => {
		const detail = await handler.execute(new GetDataChangeQuery(VIEWER, { id: recordId(1) }));

		expect(detail).toMatchObject({ id: recordId(1), oldData: { status: "DRAFT" }, newData: { status: "PUBLISHED" }, loginRole: "api" });
		expect(session.opened).toEqual([{ operation: DATA_CHANGE_READ_OPERATION, reason: "Admin data-change viewer detail", actor: VIEWER }]);
	});

	it("records which row change was opened", async () => {
		await handler.execute(new GetDataChangeQuery(VIEWER, { id: recordId(1) }));

		expect(session.committedSummaries).toEqual([
			{ dataChangeView: { view: "detail", dataChangeId: recordId(1), tableName: "Reward", rowId: "66666666-6666-4666-8666-666666666666", correlationId: "corr-1" } },
		]);
	});

	it("answers 404 for an unknown id and writes no sensitive-read row", async () => {
		const missing = handler.execute(new GetDataChangeQuery(VIEWER, { id: recordId(2) }));

		await expect(missing).rejects.toBeInstanceOf(NotFoundError);
		await expect(missing).rejects.toMatchObject({ details: { resourceId: recordId(2) } });
		expect(session.committedSummaries).toEqual([]);
	});

	it("releases nothing when the sensitive-read row cannot be written", async () => {
		const failure = new Error("database unavailable");
		session.sensitiveReads.failWith = failure;

		await expect(handler.execute(new GetDataChangeQuery(VIEWER, { id: recordId(1) }))).rejects.toBe(failure);
		expect(session.rolledBack).toHaveLength(1);
	});
});
