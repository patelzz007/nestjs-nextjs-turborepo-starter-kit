import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { ChangePasswordInput, ChangePasswordResponse } from "@workspace/shared";

import { LogService } from "../../../modules/logs/logs.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { identifyAuthFlowSubject, TrackAuthFlow } from "../decorators/track-auth-flow.decorator";
import { AuthorizationInvalidationService } from "../../authorization/cache/authorization-invalidation.service";
import { revokedByUser, sessionRevokerColumn } from "../../sessions/device/session-revoker";
import { AuthEventsService } from "./auth-events.service";
import { CryptoService } from "./crypto.service";
import { EmailService } from "./email.service";
import { PasswordHistoryService } from "./password-history.service";

/**
 * Authenticated password change — verifies the current password, enforces
 * password history, revokes other sessions, and sends a confirmation email.
 */
@Injectable()
export class ChangePasswordService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly cryptoService: CryptoService,
		private readonly passwordHistoryService: PasswordHistoryService,
		private readonly emailService: EmailService,
		private readonly logService: LogService,
		private readonly authorizationInvalidation: AuthorizationInvalidationService,
		/** Read by `@TrackAuthFlow` to record the change-password outcome. */
		private readonly authEvents: AuthEventsService,
	) {}

	@TrackAuthFlow({ flow: "change-password" })
	public async changePassword(userId: string, dto: ChangePasswordInput, currentRefreshTokenId?: string): Promise<ChangePasswordResponse> {
		identifyAuthFlowSubject(userId);
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				email: true,
				fullName: true,
				passwordHash: true,
			},
		});

		if (user === null) {
			throw new UnauthorizedException("User not found");
		}

		const currentValid = await this.cryptoService.compare(dto.currentPassword, user.passwordHash);
		if (!currentValid) {
			throw new UnauthorizedException("Current password is incorrect");
		}

		const reused = await this.passwordHistoryService.isPasswordReused(userId, dto.newPassword);
		if (reused) {
			throw new BadRequestException("Password cannot be one of your last 5 passwords");
		}

		const newPasswordHash = await this.cryptoService.hash(dto.newPassword);

		// Password, history and the revocation of every other session commit together.
		const changedAt: number = Date.now();
		await this.prisma.$transaction([
			this.prisma.user.update({
				where: { id: userId },
				data: {
					passwordHash: newPasswordHash,
					tokenVersion: { increment: 1 },
					updatedAt: changedAt,
				},
			}),
			this.prisma.passwordHistory.create({
				data: {
					userId,
					passwordHash: newPasswordHash,
				},
			}),
			this.prisma.refreshToken.updateMany({
				where: {
					userId,
					isDeleted: false,
					...(currentRefreshTokenId === undefined ? {} : { id: { not: currentRefreshTokenId } }),
				},
				// The user changed their own password: they are the actor of the sign-out.
				data: { isDeleted: true, deletedAt: changedAt, deletedBy: sessionRevokerColumn(revokedByUser(userId)), updatedAt: changedAt },
			}),
		]);

		// After commit: drop the cached token/authorization state on EVERY API instance.
		await this.authorizationInvalidation.invalidateUsers([userId], { accessTokenState: true, trigger: "password_changed" });

		await this.emailService.sendPasswordChangedEmail(user.email);

		this.logService.info("Password changed", {
			userId,
			context: "ChangePasswordService",
			metadata: { userId },
		});

		return { message: "Password changed successfully" };
	}
}
