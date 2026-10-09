import { JwtService } from "@nestjs/jwt";
import type { FlatUserResponse } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { TokenService } from "./token.service";

const tokens = new TokenService(new JwtService(), createTestTypedConfig());

const USER: FlatUserResponse = {
	id: "user-1",
	email: "member@example.com",
	fullName: "Member",
	isActive: true,
	isSuperAdmin: false,
	isEmailVerified: true,
	hasAdminAccess: false,
	tokenVersion: 0,
	roles: [],
	permissions: [],
};

describe("TokenService.generateSessionTokens", () => {
	it("mints a different refresh token on every rotation of the same session, even within the same second", async () => {
		const first = await tokens.generateSessionTokens(USER, "session-1", { sessionScope: "full" });
		const second = await tokens.generateSessionTokens(USER, "session-1", { sessionScope: "full" });

		expect(second.refreshToken).not.toBe(first.refreshToken);
	});

	it("keeps the session id as jti so the refresh token still identifies its session row", async () => {
		const { refreshToken } = await tokens.generateSessionTokens(USER, "session-1", { sessionScope: "full" });

		await expect(tokens.verifyRefreshToken(refreshToken)).resolves.toMatchObject({ sub: "user-1", jti: "session-1", tokenType: "refresh" });
	});

	it("stamps the session id as the access token's sid, the same on every rotation (ADR 034)", async () => {
		const first = await tokens.generateSessionTokens(USER, "session-1", { sessionScope: "full" });
		const rotated = await tokens.generateSessionTokens(USER, "session-1", { sessionScope: "full" });

		await expect(tokens.verifyAccessToken(first.accessToken)).resolves.toMatchObject({ sub: "user-1", sid: "session-1" });
		await expect(tokens.verifyAccessToken(rotated.accessToken)).resolves.toMatchObject({ sid: "session-1" });
	});
});

describe("TokenService.generateAccessToken", () => {
	it("mints an access token without sid (it belongs to no device session)", async () => {
		const accessToken: string = await tokens.generateAccessToken(USER);

		expect(await tokens.verifyAccessToken(accessToken)).not.toHaveProperty("sid");
	});
});
