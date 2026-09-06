import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { TwoFactorLoginChallengePurpose } from "@prisma/client";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { CaughtValueSchema, TwoFactorChallengeRefPayloadSchema, type TwoFactorChallengeRefPayload } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AccountLockoutService } from "./account-lockout.service";

const { TokenExpiredError } = jwt;

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_JWT_EXPIRY_SECONDS = 600;

export interface VerifiedMfaChallengeRef {
	readonly userId: string;
	readonly challengeId: string;
	readonly purpose: TwoFactorChallengeRefPayload["purpose"];
	readonly clientType: string | null;
	readonly deviceInfo: string | null;
	readonly ipAddress: string | null;
}

@Injectable()
export class MfaChallengeService {
	private readonly logger: Logger = new Logger(MfaChallengeService.name);

	public constructor(
		private readonly prisma: PrismaService,
		private readonly jwtService: JwtService,
		private readonly config: TypedConfigService,
		private readonly accountLockoutService: AccountLockoutService,
	) {}

	public async createLoginChallenge(userId: string, purpose: TwoFactorLoginChallengePurpose, clientType?: string, deviceInfo?: string, ipAddress?: string): Promise<string> {
		const challenge = await this.prisma.twoFactorLoginChallenge.create({
			data: {
				userId,
				purpose,
				clientType: clientType ?? null,
				deviceInfo: deviceInfo ?? null,
				ipAddress: ipAddress ?? null,
				expiresAt: Date.now() + CHALLENGE_TTL_MS,
			},
			select: { id: true },
		});

		return challenge.id;
	}

	public async signChallengeRef(challengeId: string): Promise<string> {
		const challenge = await this.prisma.twoFactorLoginChallenge.findUnique({
			where: { id: challengeId },
			select: {
				id: true,
				userId: true,
				purpose: true,
				clientType: true,
				deviceInfo: true,
				ipAddress: true,
				consumedAt: true,
				expiresAt: true,
				attemptCount: true,
				maxAttempts: true,
			},
		});

		if (challenge === null) {
			throw new BadRequestException("Invalid MFA challenge");
		}

		this.assertChallengeActiveState(challenge);

		const payload: TwoFactorChallengeRefPayload = {
			sub: challenge.userId,
			challengeId: challenge.id,
			purpose: challenge.purpose,
			clientType: challenge.clientType,
			deviceInfo: challenge.deviceInfo,
			ipAddress: challenge.ipAddress,
		};

		return this.jwtService.signAsync(payload, {
			secret: this.config.twoFactorPendingSecret,
			expiresIn: CHALLENGE_JWT_EXPIRY_SECONDS,
		});
	}

	public async verifyChallengeRef(token: string): Promise<VerifiedMfaChallengeRef> {
		try {
			const payload = TwoFactorChallengeRefPayloadSchema.parse(
				await this.jwtService.verifyAsync(token, {
					secret: this.config.twoFactorPendingSecret,
				}),
			);

			return {
				userId: payload.sub,
				challengeId: payload.challengeId,
				purpose: payload.purpose,
				clientType: payload.clientType,
				deviceInfo: payload.deviceInfo,
				ipAddress: payload.ipAddress,
			};
		} catch (error) {
			const caught = CaughtValueSchema.parse(error);
			if (caught instanceof UnauthorizedException) {
				throw caught;
			}
			if (caught instanceof TokenExpiredError) {
				throw new UnauthorizedException("MFA challenge expired — sign in again");
			}
			if (caught instanceof ZodError) {
				this.logger.error(`MFA challenge ref payload failed schema validation: ${caught.message}`);
			}
			throw new UnauthorizedException("Invalid or expired MFA challenge");
		}
	}

	public async recordFailedAttempt(challengeId: string): Promise<void> {
		const challenge = await this.prisma.twoFactorLoginChallenge.findUnique({
			where: { id: challengeId },
			select: {
				id: true,
				userId: true,
				clientType: true,
				attemptCount: true,
				maxAttempts: true,
				consumedAt: true,
				expiresAt: true,
				user: {
					select: {
						id: true,
						email: true,
						failedLoginAttempts: true,
					},
				},
			},
		});

		if (challenge === null) {
			throw new UnauthorizedException("Invalid or expired MFA challenge");
		}

		this.assertChallengeActiveState(challenge);

		const nextAttemptCount = challenge.attemptCount + 1;
		await this.prisma.twoFactorLoginChallenge.update({
			where: { id: challengeId },
			data: { attemptCount: nextAttemptCount },
		});

		if (nextAttemptCount >= challenge.maxAttempts) {
			await this.consumeChallenge(challengeId);
			await this.accountLockoutService.recordFailedAttempt(
				{
					id: challenge.user.id,
					email: challenge.user.email,
					failedLoginAttempts: challenge.user.failedLoginAttempts,
				},
				challenge.clientType ?? undefined,
				Date.now(),
			);
		}

		throw new UnauthorizedException("Invalid 2FA code");
	}

	public async consumeChallenge(challengeId: string): Promise<void> {
		await this.prisma.twoFactorLoginChallenge.updateMany({
			where: { id: challengeId, consumedAt: null },
			data: { consumedAt: Date.now() },
		});
	}

	public async assertChallengeActive(challengeId: string): Promise<void> {
		const challenge = await this.prisma.twoFactorLoginChallenge.findUnique({
			where: { id: challengeId },
			select: {
				consumedAt: true,
				expiresAt: true,
				attemptCount: true,
				maxAttempts: true,
			},
		});

		if (challenge === null) {
			throw new UnauthorizedException("Invalid or expired MFA challenge");
		}

		this.assertChallengeActiveState(challenge);
	}

	private assertChallengeActiveState(challenge: {
		readonly consumedAt: bigint | null;
		readonly expiresAt: bigint;
		readonly attemptCount: number;
		readonly maxAttempts: number;
	}): void {
		if (challenge.consumedAt !== null) {
			throw new UnauthorizedException("MFA challenge has already been used");
		}

		if (challenge.expiresAt < Date.now()) {
			throw new UnauthorizedException("MFA challenge expired — sign in again");
		}

		if (challenge.attemptCount >= challenge.maxAttempts) {
			throw new UnauthorizedException("Too many MFA attempts — sign in again");
		}
	}
}
