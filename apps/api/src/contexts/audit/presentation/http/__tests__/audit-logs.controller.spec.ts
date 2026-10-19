import { PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { QueryBus } from "@nestjs/cqrs";
import { Test } from "@nestjs/testing";
import { API_VERSION_PREFIX, HttpAuditLogDetailSchema, HttpAuditLogListQuerySchema, HttpAuditLogSummarySchema, LIST_SLOT_INDEX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { AdminAccessOnly } from "../../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { getResponseContract } from "../../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { GetHttpAuditLogQuery } from "../../../application/queries/get-http-audit-log/get-http-audit-log.query";
import { ListHttpAuditLogsQuery } from "../../../application/queries/list-http-audit-logs/list-http-audit-logs.query";
import { AuditLogsController } from "../audit-logs.controller";
import { RecordingQueryBus } from "./recording-query-bus";
import { expectOwnMetadataLike, REQUIRED_PERMISSION_METADATA_KEY } from "./route-metadata";

const reflector = new Reflector();
const RECORD_ID = "55555555-5555-4555-8555-555555555555";

const VIEWER: ActorContext = {
	kind: "user",
	userId: "99999999-9999-4999-8999-999999999999",
	sessionId: "session-1",
	organizationId: null,
	isSuperAdmin: false,
	accessScope: "staff_single_tenant",
	impersonatorUserId: null,
	request: { requestId: "corr-view", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
	routeRlsBypass: false,
};

type HandlerName = "list" | "get";

/** The decorated controller method (read off its property descriptor). */
function handlerOf(name: HandlerName): AuditLogsController[HandlerName] {
	const descriptor: TypedPropertyDescriptor<AuditLogsController[HandlerName]> | undefined = Object.getOwnPropertyDescriptor(AuditLogsController.prototype, name);
	const handler: AuditLogsController[HandlerName] | undefined = descriptor?.value;
	if (handler === undefined) {
		throw new Error(`AuditLogsController.${name} is not a method`);
	}
	return handler;
}

/** A class carrying exactly what `@AdminAccessOnly(...)` writes (applied as a call: spec files are not compiled with decorators). */
class ExpectedAdminAccess {}
AdminAccessOnly("Admin access required to view the audit log.")(ExpectedAdminAccess);

describe("AuditLogsController authorization", () => {
	it("is served under the versioned admin prefix", () => {
		expect(reflector.get<string>(PATH_METADATA, AuditLogsController)).toBe(`${API_VERSION_PREFIX}/admin/audit-logs`);
	});

	it("requires admin-panel access, with the same refusal message, for every route", () => {
		expectOwnMetadataLike(AuditLogsController, ExpectedAdminAccess);
	});

	it("needs LIST AUDIT_LOG for the table", () => {
		expect(reflector.get<object>(REQUIRED_PERMISSION_METADATA_KEY, handlerOf("list"))).toEqual({ action: "LIST", resource: "AUDIT_LOG" });
	});

	it("needs READ AUDIT_LOG for one complete record (payloads included)", () => {
		expect(reflector.get<object>(REQUIRED_PERMISSION_METADATA_KEY, handlerOf("get"))).toEqual({ action: "READ", resource: "AUDIT_LOG" });
	});

	it("keeps one response contract per route: a page of summaries, and one complete record", () => {
		expect(getResponseContract(handlerOf("list"))).toMatchObject({ kind: "paginated", schema: HttpAuditLogSummarySchema, status: 200 });
		expect(getResponseContract(handlerOf("get"))).toMatchObject({ kind: "single", schema: HttpAuditLogDetailSchema, status: 200 });
	});
});

describe("AuditLogsController dispatch", () => {
	async function controllerWith(bus: RecordingQueryBus): Promise<AuditLogsController> {
		const moduleRef = await Test.createTestingModule({ controllers: [AuditLogsController], providers: [{ provide: QueryBus, useValue: bus }] }).compile();
		return moduleRef.get(AuditLogsController);
	}

	it("dispatches exactly one ListHttpAuditLogsQuery with the actor and the validated query", async () => {
		const bus = new RecordingQueryBus();
		const query = HttpAuditLogListQuerySchema.parse({});

		await (await controllerWith(bus)).list(VIEWER, query);

		expect(bus.executed).toHaveLength(1);
		expect(bus.executed[LIST_SLOT_INDEX.first]).toEqual(new ListHttpAuditLogsQuery(VIEWER, query));
		expect(bus.executed[LIST_SLOT_INDEX.first]).toBeInstanceOf(ListHttpAuditLogsQuery);
	});

	it("dispatches exactly one GetHttpAuditLogQuery for one record", async () => {
		const bus = new RecordingQueryBus();

		await (await controllerWith(bus)).get(VIEWER, { id: RECORD_ID });

		expect(bus.executed).toEqual([new GetHttpAuditLogQuery(VIEWER, { id: RECORD_ID })]);
		expect(bus.executed[LIST_SLOT_INDEX.first]).toBeInstanceOf(GetHttpAuditLogQuery);
	});
});
