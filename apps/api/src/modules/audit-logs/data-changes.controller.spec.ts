import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { REQUIRED_PERMISSION_KEY } from "../authorization/constants/authorization.constants";
import { AdminAccessGuard } from "../auth/guards/admin-access.guard";
import { ADMIN_ACCESS_MESSAGE_KEY } from "../auth/utils/admin-access";
import { DataChangesController } from "./data-changes.controller";

const reflector = new Reflector();

type HandlerName = "list" | "get";

/** Route metadata Nest stored on a controller method (read off its property descriptor). */
function routeMetadata(name: HandlerName, key: string): object | string | undefined {
	const descriptor: TypedPropertyDescriptor<DataChangesController[HandlerName]> | undefined = Object.getOwnPropertyDescriptor(DataChangesController.prototype, name);
	const handler: DataChangesController[HandlerName] | undefined = descriptor?.value;
	if (handler === undefined) {
		throw new Error(`DataChangesController.${name} is not a method`);
	}
	return reflector.get<object | string | undefined>(key, handler);
}

describe("DataChangesController authorization", () => {
	it("is served under the versioned admin prefix", () => {
		expect(reflector.get<string>(PATH_METADATA, DataChangesController)).toBe(`${API_VERSION_PREFIX}/admin/data-changes`);
	});

	it("requires admin-panel access for every route", () => {
		expect(reflector.get<object[]>(GUARDS_METADATA, DataChangesController)).toEqual([AdminAccessGuard]);
		expect(reflector.get<string>(ADMIN_ACCESS_MESSAGE_KEY, DataChangesController)).toBe("Admin access required to view the data-change trail.");
	});

	it("needs LIST AUDIT_LOG for the table", () => {
		expect(routeMetadata("list", REQUIRED_PERMISSION_KEY)).toEqual({ action: "LIST", resource: "AUDIT_LOG" });
	});

	it("needs READ AUDIT_LOG for one complete record (row images included)", () => {
		expect(routeMetadata("get", REQUIRED_PERMISSION_KEY)).toEqual({ action: "READ", resource: "AUDIT_LOG" });
	});
});
