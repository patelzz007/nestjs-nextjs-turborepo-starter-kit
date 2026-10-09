import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { accessToken } from "../../../test/support/http-execution-context";
import { SessionsController } from "./sessions.controller";
import { SessionRevokeDuringImpersonationError } from "./session.errors";
import { SessionsService } from "./sessions.service";

vi.mock("./sessions.service", () => ({ SessionsService: class {} }));

const SESSION_ID = "8f6f2d55-1c0f-4c3e-9b8e-6a1f2b3c4d5e";

describe("SessionsController", () => {
	const service = {
		revokeSession: vi.fn<SessionsService["revokeSession"]>(),
		getSessions: vi.fn<SessionsService["getSessions"]>(),
	};
	let controller: SessionsController;

	beforeEach(async () => {
		vi.clearAllMocks();
		service.revokeSession.mockResolvedValue({ revokedCurrentSession: false });
		service.getSessions.mockResolvedValue([]);
		// A typed stand-in resolved from a Nest testing container — the real service pulls in Prisma, JWT and the outbox.
		const moduleRef = await Test.createTestingModule({ providers: [{ provide: SessionsService, useValue: service }] }).compile();
		controller = new SessionsController(moduleRef.get(SessionsService));
	});

	it("lists the caller's sessions with the access token's sid as the current one", async () => {
		await controller.getSessions(accessToken({ sub: "user-1", sid: "session-current" }));

		expect(service.getSessions).toHaveBeenCalledWith("user-1", "session-current");
	});

	it("revokes one of the caller's sessions, passing its own sid so a self-revoke is a sign-out", async () => {
		service.revokeSession.mockResolvedValue({ revokedCurrentSession: true });

		await expect(controller.revokeSession(accessToken({ sub: "user-1", sid: SESSION_ID }), SESSION_ID)).resolves.toEqual({
			message: "Signed out of this device",
			revokedCurrentSession: true,
		});
		expect(service.revokeSession).toHaveBeenCalledWith("user-1", SESSION_ID, SESSION_ID);
	});

	it("answers that another device was signed out", async () => {
		await expect(controller.revokeSession(accessToken({ sub: "user-1", sid: "session-current" }), SESSION_ID)).resolves.toEqual({
			message: "Device signed out",
			revokedCurrentSession: false,
		});
	});

	it("refuses (403) to sign out a device during impersonation — the user would be recorded as the actor", async () => {
		const impersonation = accessToken({ sub: "user-1", isImpersonating: true, originalUserId: "admin-1", impersonationSessionId: "imp-1" });

		await expect(controller.revokeSession(impersonation, SESSION_ID)).rejects.toBeInstanceOf(SessionRevokeDuringImpersonationError);
		await expect(controller.revokeSession(impersonation, SESSION_ID)).rejects.toMatchObject({ code: "SESSION_REVOKE_DURING_IMPERSONATION", httpStatus: 403 });
		expect(service.revokeSession).not.toHaveBeenCalled();
	});
});
