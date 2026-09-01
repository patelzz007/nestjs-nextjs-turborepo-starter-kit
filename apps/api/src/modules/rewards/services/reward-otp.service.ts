import { BadRequestException, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import { EmailSenderService } from "../../notifications/email/email-sender.service";
import { RewardClaimOtpEmailTemplate } from "../../notifications/email/templates/reward-claim-otp-email.template";
import { generateOtpCode, sha256Hex } from "../utils/reward-crypto.util";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const OTP_EXPIRES_MINUTES = 5;

@Injectable()
export class RewardOtpService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly emailSender: EmailSenderService,
	) {}

	public async sendClaimOtp(userId: string, phone: string, rewardId: string): Promise<void> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { email: true },
		});

		if (user === null) {
			throw new BadRequestException({ message: "User not found", error: "USER_NOT_FOUND" });
		}

		const reward = await this.prisma.reward.findFirst({
			where: { id: rewardId, isDeleted: false },
			select: { title: true },
		});

		if (reward === null) {
			throw new BadRequestException({ message: "Reward not found", error: "REWARD_NOT_FOUND" });
		}

		const code = generateOtpCode();
		const expiresAt = Date.now() + OTP_TTL_MS;

		await this.prisma.rewardOtpChallenge.create({
			data: {
				userId,
				phone,
				purpose: "CLAIM",
				rewardId,
				codeHash: sha256Hex(code),
				expiresAt,
			},
		});

		// No Twilio — email the logged-in user instead of SMS.
		await this.emailSender.send(
			new RewardClaimOtpEmailTemplate({
				to: user.email,
				rewardTitle: reward.title,
				otpCode: code,
				expiresInMinutes: OTP_EXPIRES_MINUTES,
			}),
		);

		if (process.env.NODE_ENV !== "production") {
			// eslint-disable-next-line no-console -- dev visibility when EMAIL_MODE=log-only
			console.info(`[reward-otp] user=${userId} email=${user.email} phone=${phone} code=${code}`);
		}
	}

	public async verifyClaimOtp(userId: string, phone: string, otp: string): Promise<void> {
		const challenge = await this.prisma.rewardOtpChallenge.findFirst({
			where: {
				userId,
				phone,
				purpose: "CLAIM",
				consumedAt: null,
				isDeleted: false,
				expiresAt: { gte: Date.now() },
			},
			orderBy: { createdAt: "desc" },
		});

		if (challenge === null) {
			throw new BadRequestException({ message: "OTP expired or missing", error: "OTP_INVALID" });
		}

		if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
			throw new BadRequestException({ message: "Too many OTP attempts", error: "OTP_RATE_LIMITED" });
		}

		const valid = challenge.codeHash === sha256Hex(otp);
		await this.prisma.rewardOtpChallenge.update({
			where: { id: challenge.id },
			data: {
				attempts: { increment: 1 },
				failedAttempts: valid ? challenge.failedAttempts : { increment: 1 },
				consumedAt: valid ? Date.now() : challenge.consumedAt,
			},
		});

		if (!valid) {
			throw new BadRequestException({ message: "Invalid OTP", error: "OTP_INVALID" });
		}
	}
}
