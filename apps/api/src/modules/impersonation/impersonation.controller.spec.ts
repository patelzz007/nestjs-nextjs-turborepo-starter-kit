import "reflect-metadata";
import { HttpStatus } from "@nestjs/common";
import {
	epochMs,
	ImpersonateResponseSchema,
	StopImpersonationResponseSchema,
	UserResponseSchema,
	type ImpersonateServiceResponse,
	type StopImpersonationServiceResponse,
	type UserResponse,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { getResponseContract, type RouteResponseContract } from "../../common/decorators/zod-response.decorators";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";

import { ImpersonationController } from "./impersonation.controller";

const CORRELATION_ID = "impersonation-controller-spec";
const EPOCH_ORIGIN_MS = 0;
const TARGET_USER_ID = "3f1c2b7a-9d4e-4f6a-8b2c-1d0e9f8a7b6c";
const ADMIN_USER_ID = "8a7b6c5d-4e3f-4a1b-9c2d-0e1f2a3b4c5d";

/** The handler function itself — the key `ExecutionContext.getHandler()` returns and contracts are registered under. */
function handlerOf<TKey extends keyof ImpersonationController>(key: TKey): ImpersonationController[TKey] {
	const descriptor: TypedPropertyDescriptor<ImpersonationController[TKey]> | undefined = Object.getOwnPropertyDescriptor(ImpersonationController.prototype, key);
	const handler: ImpersonationController[TKey] | undefined = descriptor?.value;
	if (handler === undefined) {
		throw new Error(`ImpersonationController.${key} missing`);
	}
	return handler;
}

function contractOf(key: keyof ImpersonationController): RouteResponseContract {
	const contract: RouteResponseContract | undefined = getResponseContract(handlerOf(key));
	if (contract === undefined) {
		throw new Error(`ImpersonationController.${key} has no response contract`);
	}
	return contract;
}

const user: UserResponse = UserResponseSchema.parse({
	id: TARGET_USER_ID,
	email: "target@example.com",
	fullName: "Target User",
	isActive: true,
	isSuperAdmin: false,
	isEmailVerified: true,
	twoFactorEnabled: false,
	hasAdminAccess: false,
	tokenVersion: 1,
	roles: [],
	createdAt: epochMs(EPOCH_ORIGIN_MS),
	updatedAt: epochMs(EPOCH_ORIGIN_MS),
	isDeleted: false,
	deletedAt: null,
});

describe("ImpersonationController response contracts (ADR 022)", () => {
	it("documents both routes with the client body schemas and keeps their 201 wire status", () => {
		expect(contractOf("impersonate")).toMatchObject({ kind: "single", schema: ImpersonateResponseSchema, status: HttpStatus.CREATED });
		expect(contractOf("stopImpersonation")).toMatchObject({ kind: "single", schema: StopImpersonationResponseSchema, status: HttpStatus.CREATED });
	});

	it("never lets the impersonation access token reach the JSON body", () => {
		const result: ImpersonateServiceResponse = { message: "Now impersonating", impersonating: true, originalUserId: ADMIN_USER_ID, user, accessToken: "impersonation-jwt" };

		const body = ResponseInterceptor.toBody(contractOf("impersonate"), result, "ImpersonationController.impersonate", CORRELATION_ID);

		expect(body).toHaveProperty("data", { message: "Now impersonating", impersonating: true, originalUserId: ADMIN_USER_ID, user });
		expect(JSON.stringify(body)).not.toContain("impersonation-jwt");
	});

	it("never lets the restored admin access token reach the JSON body", () => {
		const result: StopImpersonationServiceResponse = { message: "Impersonation ended", accessToken: "restored-admin-jwt" };

		const body = ResponseInterceptor.toBody(contractOf("stopImpersonation"), result, "ImpersonationController.stopImpersonation", CORRELATION_ID);

		expect(body).toHaveProperty("data", { message: "Impersonation ended" });
		expect(JSON.stringify(body)).not.toContain("restored-admin-jwt");
	});
});
