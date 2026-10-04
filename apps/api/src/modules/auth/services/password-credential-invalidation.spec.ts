import { Test } from "@nestjs/testing";
import { PASSWORD_RESET_LINK_TTL_HOURS } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { LogService } from "../../logs/logs.service";
import { AuthorizationInvalidationService } from "../../authorization/cache/authorization-invalidation.service";
import { UserRepository } from "../repositories/user.repository";
import { AuthEventsService } from "./auth-events.service";
import { ChangePasswordService } from "./change-password.service";
import { CryptoService } from "./crypto.service";
import { EmailService } from "./email.service";
import { PasswordHistoryService } from "./password-history.service";
import { PasswordResetService } from "./password-reset.service";

/**
 * A password change / reset bumps `tokenVersion` and revokes sessions. The
 * cached access-token state must then be dropped on EVERY API instance —
 * through `AuthorizationInvalidationService` (local apply + Redis broadcast),
 * never just the local `AccessTokenStateService` — and only AFTER the
 * transaction committed.
 */

const USER_ID = "user-1";
const MS_PER_HOUR = 3_600_000;

/** Order of the observable side effects, to prove invalidation follows the commit. */
const effects: string[] = [];

const prisma = {
	user: { findUnique: vi.fn(), update: vi.fn().mockReturnValue("user.update") },
	passwordHistory: { create: vi.fn().mockReturnValue("passwordHistory.create") },
	passwordResetToken: { findFirst: vi.fn(), update: vi.fn().mockReturnValue("passwordResetToken.update"), updateMany: vi.fn(), create: vi.fn() },
	refreshToken: { updateMany: vi.fn().mockReturnValue("refreshToken.updateMany") },
	$transaction: vi.fn(),
};
const invalidation = { invalidateUsers: vi.fn<AuthorizationInvalidationService["invalidateUsers"]>() };
const cryptoService = { compare: vi.fn(), hash: vi.fn(), hashTokenDigest: vi.fn(), generateRandomToken: vi.fn() };
const userRepository = { findResetLookupByEmail: vi.fn() };

async function compile(): Promise<{ readonly changePassword: ChangePasswordService; readonly passwordReset: PasswordResetService }> {
	const moduleRef = await Test.createTestingModule({
		providers: [
			ChangePasswordService,
			PasswordResetService,
			{ provide: PrismaService, useValue: prisma },
			{ provide: UserRepository, useValue: userRepository },
			{ provide: CryptoService, useValue: cryptoService },
			{ provide: PasswordHistoryService, useValue: { isPasswordReused: vi.fn().mockResolvedValue(false) } },
			{ provide: EmailService, useValue: { sendPasswordChangedEmail: vi.fn().mockResolvedValue(undefined), sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined) } },
			{ provide: LogService, useValue: { info: vi.fn(), warn: vi.fn() } },
			{ provide: AuthorizationInvalidationService, useValue: invalidation },
			{ provide: AuthEventsService, useValue: { recordFlow: vi.fn().mockResolvedValue({ recorded: true, eventId: "evt-1" }) } },
		],
	}).compile();
	return { changePassword: moduleRef.get(ChangePasswordService), passwordReset: moduleRef.get(PasswordResetService) };
}

describe("password credential changes invalidate cached state on every instance after commit", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		effects.length = 0;
		prisma.user.findUnique.mockResolvedValue({ id: USER_ID, email: "user@example.com", fullName: "User", passwordHash: "old-hash" });
		prisma.passwordResetToken.findFirst.mockResolvedValue({ id: "reset-1", userId: USER_ID, token: "reset-hash" });
		prisma.$transaction.mockImplementation((operations: readonly string[]): Promise<readonly string[]> => {
			effects.push(`commit:${operations.join(",")}`);
			return Promise.resolve(operations);
		});
		invalidation.invalidateUsers.mockImplementation((userIds: readonly string[]): Promise<void> => {
			effects.push(`invalidate:${userIds.join(",")}`);
			return Promise.resolve();
		});
		cryptoService.compare.mockResolvedValue(true);
		cryptoService.hash.mockResolvedValue("new-hash");
		cryptoService.hashTokenDigest.mockReturnValue("digest");
	});

	it("change-password revokes the other sessions in the same transaction, then broadcasts the invalidation", async () => {
		const { changePassword } = await compile();

		await changePassword.changePassword(USER_ID, { currentPassword: "Old@12345", newPassword: "New@12345", confirmPassword: "New@12345" }, "current-rt");

		expect(effects).toEqual(["commit:user.update,passwordHistory.create,refreshToken.updateMany", `invalidate:${USER_ID}`]);
		expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: USER_ID, isDeleted: false, id: { not: "current-rt" } } }));
		expect(invalidation.invalidateUsers).toHaveBeenCalledWith([USER_ID], { accessTokenState: true, trigger: "password_changed" });
	});

	it("reset-password revokes every session in the same transaction, then broadcasts the invalidation", async () => {
		const { passwordReset } = await compile();

		await passwordReset.resetPassword({ token: "raw-token", password: "New@12345" });

		expect(effects).toEqual(["commit:user.update,passwordResetToken.update,passwordHistory.create,refreshToken.updateMany", `invalidate:${USER_ID}`]);
		expect(invalidation.invalidateUsers).toHaveBeenCalledWith([USER_ID], { accessTokenState: true, trigger: "password_reset" });
	});

	it("invalidates nothing when the transaction fails (no commit, no stale broadcast)", async () => {
		prisma.$transaction.mockRejectedValue(new Error("serialization failure"));
		const { changePassword, passwordReset } = await compile();

		await expect(changePassword.changePassword(USER_ID, { currentPassword: "Old@12345", newPassword: "New@12345", confirmPassword: "New@12345" })).rejects.toThrow(
			"serialization failure",
		);
		await expect(passwordReset.resetPassword({ token: "raw-token", password: "New@12345" })).rejects.toThrow("serialization failure");

		expect(invalidation.invalidateUsers).not.toHaveBeenCalled();
	});

	it("stores a password-reset token that expires after exactly PASSWORD_RESET_LINK_TTL_HOURS", async () => {
		const now = 1_800_000_000_000;
		vi.spyOn(Date, "now").mockReturnValue(now);
		userRepository.findResetLookupByEmail.mockResolvedValue({ id: USER_ID, isActive: true, isDeleted: false });
		cryptoService.generateRandomToken.mockReturnValue("raw-token");
		const { passwordReset } = await compile();

		await passwordReset.forgotPassword({ email: "user@example.com" });

		expect(prisma.passwordResetToken.create.mock.lastCall?.[0]).toMatchObject({
			data: { userId: USER_ID, expiresAt: now + PASSWORD_RESET_LINK_TTL_HOURS * MS_PER_HOUR },
		});
		vi.restoreAllMocks();
	});
});
