import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { API_VERSION_PREFIX, DataChangeLogDetailSchema, DataChangeLogListQuerySchema, DataChangeLogSummarySchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { AdminAccessOnly } from "../../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { getResponseContract } from "../../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { AuditApplicationService } from "../../../application/services/audit.application-service";
import { DataChangesController } from "../data-changes.controller";
import { RecordingAuditService } from "./recording-audit-service";
import { servedPathOf } from "../../../../../../e2e/support/route-metadata";
import { expectOwnMetadataLike, REQUIRED_PERMISSION_METADATA_KEY } from "./route-metadata";

const reflector = new Reflector();
const RECORD_ID = "55555555-5555-4555-8555-555555555555";

const VIEWER: ActorContext = {
	kind: "user",
	userId: "99999999-9999-4999-8999-999999999999",
	sessionId: "session-1",
	tenantId: null,
	isSuperAdmin: false,
	accessScope: "tenant",
	impersonatorUserId: null,
	request: { requestId: "corr-view", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
};

type HandlerName = "list" | "get";

/** The decorated controller method (read off its property descriptor). */
function handlerOf(name: HandlerName): DataChangesController[HandlerName] {
	const descriptor: TypedPropertyDescriptor<DataChangesController[HandlerName]> | undefined = Object.getOwnPropertyDescriptor(DataChangesController.prototype, name);
	const handler: DataChangesController[HandlerName] | undefined = descriptor?.value;
	if (handler === undefined) {
		throw new Error(`DataChangesController.${name} is not a method`);
	}
	return handler;
}

/** A class carrying exactly what `@AdminAccessOnly(...)` writes (applied as a call: spec files are not compiled with decorators). */
class ExpectedAdminAccess {}
AdminAccessOnly("Admin access required to view the data-change trail.")(ExpectedAdminAccess);

describe("DataChangesController authorization", () => {
	it("is served under the versioned admin prefix", () => {
		expect(servedPathOf(DataChangesController)).toBe(`${API_VERSION_PREFIX}/admin/data-changes`);
	});

	it("requires admin-panel access, with the same refusal message, for every route", () => {
		expectOwnMetadataLike(DataChangesController, ExpectedAdminAccess);
	});

	it("needs LIST AUDIT_LOG for the table", () => {
		expect(reflector.get<readonly object[]>(REQUIRED_PERMISSION_METADATA_KEY, handlerOf("list"))).toEqual([{ action: "LIST", resource: "AUDIT_LOG" }]);
	});

	it("needs READ AUDIT_LOG for one complete record (row images included)", () => {
		expect(reflector.get<readonly object[]>(REQUIRED_PERMISSION_METADATA_KEY, handlerOf("get"))).toEqual([{ action: "READ", resource: "AUDIT_LOG" }]);
	});

	it("keeps one response contract per route: a page of change summaries, and one complete change", () => {
		expect(getResponseContract(handlerOf("list"))).toMatchObject({ kind: "paginated", schema: DataChangeLogSummarySchema, status: 200 });
		expect(getResponseContract(handlerOf("get"))).toMatchObject({ kind: "single", schema: DataChangeLogDetailSchema, status: 200 });
	});
});

describe("DataChangesController reads", () => {
	async function controllerWith(audit: RecordingAuditService): Promise<DataChangesController> {
		const moduleRef = await Test.createTestingModule({ controllers: [DataChangesController], providers: [{ provide: AuditApplicationService, useValue: audit }] }).compile();
		return moduleRef.get(DataChangesController);
	}

	it("lists through the audit application service with the actor and the validated query, once", async () => {
		const audit = new RecordingAuditService();
		const query = DataChangeLogListQuerySchema.parse({});

		await (await controllerWith(audit)).list(VIEWER, query);

		expect(audit.calls).toEqual([{ method: "listDataChanges", actor: VIEWER, input: query }]);
	});

	it("opens one record through the audit application service, once", async () => {
		const audit = new RecordingAuditService();

		await (await controllerWith(audit)).get(VIEWER, { id: RECORD_ID });

		expect(audit.calls).toEqual([{ method: "getDataChange", actor: VIEWER, input: { id: RECORD_ID } }]);
	});
});
