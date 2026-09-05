import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { ChangePasswordInput, ChangePasswordResponse } from "@workspace/shared";

import { LogService } from "../../../modules/logs/logs.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TrackAuthFlow } from "../decorators/track-auth-flow.decorator";
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
	) {}

	@TrackAuthFlow({ flow: "change-password" })
	public async changePassword(userId: string, dto: ChangePasswordInput, currentRefreshTokenId?: string): Promise<ChangePasswordResponse> {
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

		await this.prisma.$transaction([
			this.prisma.user.update({
				where: { id: userId },
				data: {
					passwordHash: newPasswordHash,
					tokenVersion: { increment: 1 },
					updatedAt: Date.now(),
				},
			}),
			this.prisma.passwordHistory.create({
				data: {
					userId,
					passwordHash: newPasswordHash,
				},
			}),
		]);

		if (currentRefreshTokenId !== undefined) {
			await this.prisma.refreshToken.updateMany({
				where: {
					userId,
					id: { not: currentRefreshTokenId },
					isDeleted: false,
				},
				data: { isDeleted: true, deletedAt: Date.now(), updatedAt: Date.now() },
			});
		} else {
			await this.prisma.refreshToken.updateMany({
				where: { userId, isDeleted: false },
				data: { isDeleted: true, deletedAt: Date.now(), updatedAt: Date.now() },
			});
		}

		await this.emailService.sendPasswordChangedEmail(user.email);

		this.logService.info("Password changed", {
			userId,
			context: "ChangePasswordService",
			metadata: { userId },
		});

		return { message: "Password changed successfully" };
	}
}
