import { Injectable, BadRequestException, UnauthorizedException } from "@nestjs/common";
import type { ForgotPasswordInput, ForgotPasswordResponse, ResetPasswordInput, ResetPasswordResponse, ValidateResetTokenResponse } from "@workspace/shared";

import { LogService } from "../../../modules/logs/logs.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TrackAuthFlow } from "../decorators/track-auth-flow.decorator";
import { UserRepository } from "../repositories/user.repository";
import { AuthEventsService } from "./auth-events.service";
import { CryptoService } from "./crypto.service";
import { EmailService } from "./email.service";
import { PasswordHistoryService } from "./password-history.service";

/**
 * Handles the password reset flow: initiating a reset (forgot password)
 * and completing it with a valid token (reset password).
 *
 * Extracted from `AuthService` to follow single-responsibility principle.
 */
@Injectable()
export class PasswordResetService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly userRepo: UserRepository,
		private readonly cryptoService: CryptoService,
		private readonly emailService: EmailService,
		private readonly passwordHistoryService: PasswordHistoryService,
		private readonly authEvents: AuthEventsService,
		private readonly logService: LogService,
	) {}

	/**
	 * Initiate a password reset flow.
	 * Always returns the same response regardless of whether the email exists,
	 * to prevent email enumeration attacks.
	 */
	@TrackAuthFlow({ flow: "forgot-password", clientType: (_dto: unknown, clientType?: unknown) => (typeof clientType === "string" ? clientType : null) })
	public async forgotPassword(dto: ForgotPasswordInput, clientType?: string): Promise<ForgotPasswordResponse> {
		const { email } = dto;

		const user = await this.userRepo.findResetLookupByEmail(email);

		if (!user?.isActive || user.isDeleted) {
			return { message: "If an account with that email exists, a password reset link has been sent." };
		}

		// Invalidate any existing unused tokens for this user
		await this.prisma.passwordResetToken.updateMany({
			where: { userId: user.id, usedAt: null, expiresAt: { gte: Date.now() } },
			data: { expiresAt: Date.now(), updatedAt: Date.now() },
		});

		const rawToken = this.cryptoService.generateRandomToken();
		const tokenHash = await this.cryptoService.hash(rawToken);

		await this.prisma.passwordResetToken.create({
			data: {
				userId: user.id,
				token: tokenHash,
				expiresAt: Date.now() + 3_600_000, // 1 hour
			},
		});

		await this.emailService.sendPasswordResetEmail(email, rawToken, clientType);

		return { message: "If an account with that email exists, a password reset link has been sent." };
	}

	/** Check whether a raw reset token is valid without consuming it. */
	public async validateResetToken(rawToken: string): Promise<ValidateResetTokenResponse> {
		const valid = await this.isResetTokenValid(rawToken);
		return { valid };
	}

	/**
	 * Reset a user's password using a valid reset token.
	 */
	@TrackAuthFlow({ flow: "reset-password" })
	public async resetPassword(dto: ResetPasswordInput): Promise<ResetPasswordResponse> {
		const { token: rawToken, password } = dto;

		const matchedToken = await this.findValidResetToken(rawToken);
		if (!matchedToken) {
			throw new UnauthorizedException("Invalid or expired reset token");
		}

		const reused = await this.passwordHistoryService.isPasswordReused(matchedToken.userId, password);
		if (reused) {
			throw new BadRequestException("Password cannot be one of your last 5 passwords");
		}

		const newPasswordHash = await this.cryptoService.hash(password);

		await this.prisma.$transaction([
			this.prisma.user.update({
				where: { id: matchedToken.userId },
				data: { passwordHash: newPasswordHash, updatedAt: Date.now() },
			}),
			this.prisma.passwordResetToken.update({
				where: { id: matchedToken.id },
				data: { usedAt: Date.now(), updatedAt: Date.now() },
			}),
			this.prisma.passwordHistory.create({
				data: {
					userId: matchedToken.userId,
					passwordHash: newPasswordHash,
				},
			}),
		]);

		// Revoke all existing refresh tokens (force re-login)
		await this.prisma.refreshToken.updateMany({
			where: { userId: matchedToken.userId },
			data: { isDeleted: true, deletedAt: Date.now(), updatedAt: Date.now() },
		});

		const user = await this.prisma.user.findUnique({
			where: { id: matchedToken.userId },
			select: { email: true },
		});

		if (user !== null) {
			await this.emailService.sendPasswordChangedEmail(user.email);
		}

		this.logService.info("Password reset completed", {
			userId: matchedToken.userId,
			context: "PasswordResetService",
			metadata: { userId: matchedToken.userId },
		});

		return { message: "Password has been reset successfully. Please log in with your new password." };
	}

	private async isResetTokenValid(rawToken: string): Promise<boolean> {
		const matched = await this.findValidResetToken(rawToken);
		return matched !== null;
	}

	private async findValidResetToken(rawToken: string): Promise<{ readonly id: string; readonly userId: string } | null> {
		const candidates = await this.prisma.passwordResetToken.findMany({
			where: {
				usedAt: null,
				expiresAt: { gte: Date.now() },
			},
			select: { id: true, userId: true, token: true },
		});

		for (const candidate of candidates) {
			const isValid = await this.cryptoService.compare(rawToken, candidate.token);
			if (isValid) {
				return { id: candidate.id, userId: candidate.userId };
			}
		}

		return null;
	}
}
