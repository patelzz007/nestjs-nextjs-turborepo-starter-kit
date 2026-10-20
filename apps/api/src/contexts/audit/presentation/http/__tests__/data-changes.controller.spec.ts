import { PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { QueryBus } from "@nestjs/cqrs";
import { Test } from "@nestjs/testing";
import { API_VERSION_PREFIX, DataChangeLogDetailSchema, DataChangeLogListQuerySchema, DataChangeLogSummarySchema, LIST_SLOT_INDEX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { AdminAccessOnly } from "../../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { getResponseContract } from "../../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { GetDataChangeQuery } from "../../../application/queries/get-data-change/get-data-change.query";
import { ListDataChangesQuery } from "../../../application/queries/list-data-changes/list-data-changes.query";
import { DataChangesController } from "../data-changes.controller";
import { RecordingQueryBus } from "./recording-query-bus";
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
		expect(reflector.get<string>(PATH_METADATA, DataChangesController)).toBe(`${API_VERSION_PREFIX}/admin/data-changes`);
	});

	it("requires admin-panel access, with the same refusal message, for every route", () => {
		expectOwnMetadataLike(DataChangesController, ExpectedAdminAccess);
	});

	it("needs LIST AUDIT_LOG for the table", () => {
		expect(reflector.get<object>(REQUIRED_PERMISSION_METADATA_KEY, handlerOf("list"))).toEqual({ action: "LIST", resource: "AUDIT_LOG" });
	});

	it("needs READ AUDIT_LOG for one complete record (row images included)", () => {
		expect(reflector.get<object>(REQUIRED_PERMISSION_METADATA_KEY, handlerOf("get"))).toEqual({ action: "READ", resource: "AUDIT_LOG" });
	});

	it("keeps one response contract per route: a page of change summaries, and one complete change", () => {
		expect(getResponseContract(handlerOf("list"))).toMatchObject({ kind: "paginated", schema: DataChangeLogSummarySchema, status: 200 });
		expect(getResponseContract(handlerOf("get"))).toMatchObject({ kind: "single", schema: DataChangeLogDetailSchema, status: 200 });
	});
});

describe("DataChangesController dispatch", () => {
	async function controllerWith(bus: RecordingQueryBus): Promise<DataChangesController> {
		const moduleRef = await Test.createTestingModule({ controllers: [DataChangesController], providers: [{ provide: QueryBus, useValue: bus }] }).compile();
		return moduleRef.get(DataChangesController);
	}

	it("dispatches exactly one ListDataChangesQuery with the actor and the validated query", async () => {
		const bus = new RecordingQueryBus();
		const query = DataChangeLogListQuerySchema.parse({});

		await (await controllerWith(bus)).list(VIEWER, query);

		expect(bus.executed).toHaveLength(1);
		expect(bus.executed[LIST_SLOT_INDEX.first]).toEqual(new ListDataChangesQuery(VIEWER, query));
		expect(bus.executed[LIST_SLOT_INDEX.first]).toBeInstanceOf(ListDataChangesQuery);
	});

	it("dispatches exactly one GetDataChangeQuery for one record", async () => {
		const bus = new RecordingQueryBus();

		await (await controllerWith(bus)).get(VIEWER, { id: RECORD_ID });

		expect(bus.executed).toEqual([new GetDataChangeQuery(VIEWER, { id: RECORD_ID })]);
		expect(bus.executed[LIST_SLOT_INDEX.first]).toBeInstanceOf(GetDataChangeQuery);
	});
});
