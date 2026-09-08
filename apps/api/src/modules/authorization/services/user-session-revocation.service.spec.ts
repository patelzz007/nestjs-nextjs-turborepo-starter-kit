import { describe, expect, it, vi } from "vitest";

import type { AccessTokenStateService } from "../../auth/services/access-token-state.service";
import type { RefreshTokenRepository } from "../../sessions/repositories/refresh-token.repository";
import type { SessionUserRepository } from "../../sessions/repositories/session-user.repository";

import { UserSessionRevocationService } from "./user-session-revocation.service";

describe("UserSessionRevocationService", () => {
	it("revokes refresh tokens, bumps tokenVersion, and invalidates access-token cache", async () => {
		const refreshTokens = {
			revokeAllForUsers: vi.fn().mockResolvedValue(undefined),
		};
		const sessionUsers = {
			bumpTokenVersions: vi.fn().mockResolvedValue(undefined),
		};
		const accessTokenState = {
			invalidate: vi.fn(),
		};

		const service = new UserSessionRevocationService(
			refreshTokens as unknown as RefreshTokenRepository,
			sessionUsers as unknown as SessionUserRepository,
			accessTokenState as unknown as AccessTokenStateService,
		);

		await service.revokeAllSessionsForUsers(["user-1", "user-1"]);

		expect(refreshTokens.revokeAllForUsers).toHaveBeenCalledWith(["user-1"]);
		expect(sessionUsers.bumpTokenVersions).toHaveBeenCalledWith(["user-1"]);
		expect(accessTokenState.invalidate).toHaveBeenCalledWith("user-1");
	});

	it("no-ops when userIds is empty", async () => {
		const refreshTokens = { revokeAllForUsers: vi.fn() };
		const sessionUsers = { bumpTokenVersions: vi.fn() };
		const accessTokenState = { invalidate: vi.fn() };
		const service = new UserSessionRevocationService(
			refreshTokens as unknown as RefreshTokenRepository,
			sessionUsers as unknown as SessionUserRepository,
			accessTokenState as unknown as AccessTokenStateService,
		);

		await service.revokeAllSessionsForUsers([]);

		expect(refreshTokens.revokeAllForUsers).not.toHaveBeenCalled();
		expect(sessionUsers.bumpTokenVersions).not.toHaveBeenCalled();
		expect(accessTokenState.invalidate).not.toHaveBeenCalled();
	});
});
