import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccessTokenStateService } from "../../auth/services/access-token-state.service";
import { RefreshTokenRepository } from "../../sessions/repositories/refresh-token.repository";
import { SessionUserRepository } from "../../sessions/repositories/session-user.repository";

import { UserSessionRevocationService } from "./user-session-revocation.service";

const mocks = vi.hoisted(() => ({
	revokeAllForUsers: vi.fn(),
	bumpTokenVersions: vi.fn(),
	invalidate: vi.fn(),
}));

vi.mock("../../sessions/repositories/refresh-token.repository", () => ({
	RefreshTokenRepository: class {
		public readonly revokeAllForUsers = mocks.revokeAllForUsers;
	},
}));

vi.mock("../../sessions/repositories/session-user.repository", () => ({
	SessionUserRepository: class {
		public readonly bumpTokenVersions = mocks.bumpTokenVersions;
	},
}));

vi.mock("../../auth/services/access-token-state.service", () => ({
	AccessTokenStateService: class {
		public readonly invalidate = mocks.invalidate;
	},
}));

function createService(): UserSessionRevocationService {
	return new UserSessionRevocationService(new RefreshTokenRepository(), new SessionUserRepository(), new AccessTokenStateService());
}

describe("UserSessionRevocationService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.revokeAllForUsers.mockResolvedValue(undefined);
		mocks.bumpTokenVersions.mockResolvedValue(undefined);
	});

	it("revokes refresh tokens, bumps tokenVersion, and invalidates access-token cache", async () => {
		await createService().revokeAllSessionsForUsers(["user-1", "user-1"]);

		expect(mocks.revokeAllForUsers).toHaveBeenCalledWith(["user-1"]);
		expect(mocks.bumpTokenVersions).toHaveBeenCalledWith(["user-1"]);
		expect(mocks.invalidate).toHaveBeenCalledWith("user-1");
	});

	it("no-ops when userIds is empty", async () => {
		await createService().revokeAllSessionsForUsers([]);

		expect(mocks.revokeAllForUsers).not.toHaveBeenCalled();
		expect(mocks.bumpTokenVersions).not.toHaveBeenCalled();
		expect(mocks.invalidate).not.toHaveBeenCalled();
	});
});
