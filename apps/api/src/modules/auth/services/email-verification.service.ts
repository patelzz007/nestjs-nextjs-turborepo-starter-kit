import { Injectable, NotFoundException } from "@nestjs/common";
import type { ResendVerificationInput, ResendVerificationResponse, VerifyEmailResponse } from "@workspace/shared";

import { TrackAuthFlow } from "../decorators/track-auth-flow.decorator";
import { UserRepository } from "../repositories/user.repository";
import { AuthEventsService } from "./auth-events.service";
import { EmailService } from "./email.service";
import { IdentityService } from "./identity.service";
import { TokenService } from "./token.service";

/**
 * Handles email verification: resending verification emails and verifying
 * tokens.
 *
 * Extracted from `AuthService` to follow single-responsibility principle.
 */
@Injectable()
export class EmailVerificationService {
	constructor(
		private readonly userRepo: UserRepository,
		private readonly tokenService: TokenService,
		private readonly emailService: EmailService,
		private readonly authEvents: AuthEventsService,
		private readonly identityService: IdentityService,
	) {}

	/**
	 * Resend the email verification link.
	 * Always returns the same response to prevent email enumeration.
	 */
	public async resendVerificationEmail(dto: ResendVerificationInput, clientType?: string): Promise<ResendVerificationResponse> {
		const { email } = dto;

		const user = await this.userRepo.findForVerifyByEmail(email);

		if (!user?.isActive || user.emailVerifiedAt) {
			return { message: "If an account with that email exists, a verification email has been sent." };
		}

		const verificationToken = await this.tokenService.generateEmailVerificationToken(email);
		await this.emailService.sendVerificationEmail(email, verificationToken, clientType);

		return { message: "If an account with that email exists, a verification email has been sent." };
	}

	/** Sends a verification email when the account exists and is not yet verified. */
	public async sendVerificationEmailIfUnverified(email: string, clientType?: string): Promise<void> {
		const user = await this.userRepo.findForVerifyByEmail(email);
		if (user === null || !user.isActive || user.emailVerifiedAt !== null) {
			return;
		}

		const verificationToken = await this.tokenService.generateEmailVerificationToken(email);
		await this.emailService.sendVerificationEmail(email, verificationToken, clientType);
	}

	/**
	 * Verify a user's email address using a verification token.
	 */
	@TrackAuthFlow({ flow: "verify-email" })
	public async verifyEmail(token: string): Promise<VerifyEmailResponse> {
		const email = await this.tokenService.verifyEmailToken(token);

		const user = await this.userRepo.findProfileByEmail(email);
		if (!user) {
			throw new NotFoundException("User not found");
		}

		if (user.emailVerifiedAt) {
			return { message: "Email already verified" };
		}

		await this.userRepo.update(user.id, { emailVerifiedAt: Date.now() });
		this.identityService.invalidateMe(user.id);

		return { message: "Email verified successfully" };
	}
}
