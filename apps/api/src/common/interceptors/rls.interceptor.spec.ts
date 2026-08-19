import { describe, expect, it, vi } from "vitest";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { of } from "rxjs";
import type { FastifyRequest } from "fastify";

import { RlsInterceptor } from "./rls.interceptor";
import { RLS_BYPASS_KEY } from "../../modules/auth/decorators/rls-bypass.decorator";
import { rlsStorage } from "../../prisma/rls-context";

function runInterceptor(user: FastifyRequest["user"], rlsBypass = false): { userId: string; bypass: boolean } {
	const reflector = {
		getAllAndOverride: vi.fn((key: string) => (key === RLS_BYPASS_KEY ? rlsBypass : undefined)),
	} as unknown as Reflector;
	const interceptor = new RlsInterceptor(reflector);
	const context = {
		getHandler: () => ({}),
		getClass: () => ({}),
		switchToHttp: () => ({
			getRequest: () => ({ user }) as FastifyRequest,
		}),
	} as ExecutionContext;
	const handler: CallHandler<string> = { handle: () => of("ok") };
	let captured = { userId: "", bypass: true };
	interceptor.intercept(context, handler).subscribe({
		next: () => {
			captured = rlsStorage.getStore() ?? captured;
		},
	});
	return captured;
}

describe("RlsInterceptor", () => {
	it("scopes non-admin JWT users when not @RlsBypass", () => {
		expect(runInterceptor({ sub: "user-1", hasAdminAccess: false, isSuperAdmin: false } as FastifyRequest["user"])).toEqual({
			userId: "user-1",
			bypass: false,
		});
	});

	it("bypasses when @RlsBypass is set", () => {
		expect(runInterceptor({ sub: "user-1", hasAdminAccess: false, isSuperAdmin: false } as FastifyRequest["user"], true)).toEqual({
			userId: "",
			bypass: true,
		});
	});

	it("bypasses admin JWTs", () => {
		expect(runInterceptor({ sub: "admin-1", hasAdminAccess: true, isSuperAdmin: false } as FastifyRequest["user"])).toEqual({
			userId: "admin-1",
			bypass: true,
		});
	});
});
