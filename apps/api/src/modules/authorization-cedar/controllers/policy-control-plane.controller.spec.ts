import { describe, expect, it } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import type { AccessTokenPayload } from "@workspace/shared";

import { REQUIRED_PERMISSION_KEY } from "../../authorization/constants/authorization.constants";
import { SUPER_ADMIN_KEY } from "../../auth/decorators/super-admin.decorator";
import { AuthGuard } from "../../auth/guards/auth.guard";
import { SuperAdminGuard } from "../../auth/guards/super-admin.guard";
import { PolicyControlPlaneController, policyActorOf } from "./policy-control-plane.controller";

const reflector = new Reflector();

const HANDLER_NAMES: readonly ["createDraft", "simulate", "publish"] = ["createDraft", "simulate", "publish"];

/** Route metadata Nest stored on a controller method (read off its property descriptor). */
type HandlerName = (typeof HANDLER_NAMES)[number];

function routeMetadata(name: HandlerName, key: string): object | boolean | undefined {
	const descriptor: TypedPropertyDescriptor<PolicyControlPlaneController[HandlerName]> | undefined = Object.getOwnPropertyDescriptor(
		PolicyControlPlaneController.prototype,
		name,
	);
	const handler: PolicyControlPlaneController[HandlerName] | undefined = descriptor?.value;
	if (handler === undefined) {
		throw new Error(`PolicyControlPlaneController.${name} is not a method`);
	}
	return reflector.get<object | boolean | undefined>(key, handler);
}

function token(overrides: Partial<AccessTokenPayload>): AccessTokenPayload {
	return {
		sub: "11111111-1111-4111-8111-111111111111",
		id: "11111111-1111-4111-8111-111111111111",
		email: "admin@example.com",
		fullName: "Admin",
		isActive: true,
		isSuperAdmin: true,
		isEmailVerified: true,
		hasAdminAccess: true,
		tokenVersion: 1,
		...overrides,
	};
}

describe("PolicyControlPlaneController authorization", () => {
	it.each(HANDLER_NAMES)("%s is SuperAdmin-only (AuthGuard + SuperAdminGuard) on top of MANAGE:SYSTEM_SETTINGS", (name) => {
		expect(routeMetadata(name, GUARDS_METADATA)).toEqual([AuthGuard, SuperAdminGuard]);
		expect(routeMetadata(name, SUPER_ADMIN_KEY)).toBe(true);
		expect(routeMetadata(name, REQUIRED_PERMISSION_KEY)).toEqual({ action: "MANAGE", resource: "SYSTEM_SETTINGS" });
	});

	it("maps a regular SuperAdmin token to a non-impersonating actor", () => {
		expect(policyActorOf(token({}))).toEqual({ userId: "11111111-1111-4111-8111-111111111111", isImpersonating: false });
	});

	it("treats any impersonation marker as impersonating", () => {
		expect(policyActorOf(token({ isImpersonating: true })).isImpersonating).toBe(true);
		expect(policyActorOf(token({ originalUserId: "22222222-2222-4222-8222-222222222222" })).isImpersonating).toBe(true);
	});
});
