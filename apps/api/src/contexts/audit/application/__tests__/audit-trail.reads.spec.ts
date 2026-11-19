import { AuditTrailListQuerySchema, LIST_SLOT_INDEX } from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { AUDIT_TRAIL_READ_OPERATION } from "../audit-read-operations";
import { AuditApplicationService } from "../services/audit.application-service";
import { backgroundEntry, recordId, requestEntry, VIEWER } from "./fakes/audit-records.fixtures";
import { InMemoryAuditReadSession } from "./fakes/in-memory-audit-read-session";

describe("AuditApplicationService.listAuditTrail", () => {
	let session: InMemoryAuditReadSession;
	let service: AuditApplicationService;

	beforeEach(() => {
		session = new InMemoryAuditReadSession();
		service = new AuditApplicationService(session);
	});

	it("reads under the timeline's read operation, as the viewer", async () => {
		await service.listAuditTrail(VIEWER, AuditTrailListQuerySchema.parse({}));

		expect(session.opened).toEqual([{ operation: AUDIT_TRAIL_READ_OPERATION, reason: "Admin audit log timeline", actor: VIEWER }]);
	});

	it("returns requests and background entries in timeline order", async () => {
		session.auditTrail.entries.push(requestEntry(1), backgroundEntry(2));

		const page = await service.listAuditTrail(VIEWER, AuditTrailListQuerySchema.parse({}));

		expect(page.items.map((entry) => entry.kind)).toEqual(["REQUEST", "BACKGROUND"]);
		expect(page.items[LIST_SLOT_INDEX.second]).toMatchObject({ id: recordId(2), changeCount: 1 });
	});

	it("records the read as a sensitive read: how much was released, on which page", async () => {
		session.auditTrail.entries.push(backgroundEntry(1));

		await service.listAuditTrail(VIEWER, AuditTrailListQuerySchema.parse({}));

		expect(session.committedSummaries).toEqual([{ auditTrailView: { returned: 1, total: 1, page: 1 } }]);
	});

	it("records an empty timeline as an empty release", async () => {
		await service.listAuditTrail(VIEWER, AuditTrailListQuerySchema.parse({}));

		expect(session.committedSummaries).toEqual([{ auditTrailView: { returned: 0, total: 0, page: 1 } }]);
	});

	it("releases nothing when the sensitive-read row cannot be written", async () => {
		session.auditTrail.entries.push(backgroundEntry(1));
		const failure = new Error("database unavailable");
		session.sensitiveReads.failWith = failure;

		await expect(service.listAuditTrail(VIEWER, AuditTrailListQuerySchema.parse({}))).rejects.toBe(failure);
		expect(session.rolledBack).toHaveLength(1);
		expect(session.committedSummaries).toEqual([]);
	});
});
