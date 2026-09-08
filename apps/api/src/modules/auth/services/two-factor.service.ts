import * as crypto from "crypto";

import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { TwoFactorLoginChallengePurpose } from "@prisma/client";
import { generateSecret, generateURI, verifySync } from "otplib";
import * as QRCode from "qrcode";
import type {
	BackupCodesRemainingResponse,
	EnableTwoFactorInput,
	LoginTwoFactorInput,
	LoginTwoFactorPendingResponse,
	LoginRestrictedEnrollmentResponse,
	LoginServiceResponse,
	LoginVerificationPendingResponse,
	RotateTwoFactorInput,
	TwoFactorMessageResponse,
	TwoFactorSetupResponse,
	VerifyBackupCodeInput,
	VerifyBackupCodeLoginInput,
	VerifyBackupCodeResponse,
} from "@workspace/shared";

import { z } from "zod";

import { TypedConfigService } from "../../../config/typed-config.service";
import { LogService } from "../../../modules/logs/logs.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AccessTokenStateService } from "./access-token-state.service";
import { AccountLockoutService } from "./account-lockout.service";
import { CryptoService } from "./crypto.service";
import { EmailService } from "./email.service";
import { LoginVerificationService } from "./login-verification.service";
import { MfaChallengeService } from "./mfa-challenge.service";
import { SecretEncryptionService } from "./secret-encryption.service";

const SETUP_TTL_MS = 15 * 60 * 1000;
const BACKUP_CODE_COUNT = 10;
/** Allow ±1 TOTP period for clock skew between server and authenticator app. */
const TOTP_EPOCH_TOLERANCE_SECONDS = 30;
/** A–Z and 2–9, excluding ambiguous 0/O, 1/I/L. */
const BACKUP_CODE_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

const TOTP_PERIOD_SECONDS = 30;

const BackupCodesHashesSchema = z.array(z.string().min(1));

interface TotpVerificationSuccess {
	readonly valid: true;
	readonly timeStep: number;
}

interface TotpVerificationFailure {
	readonly valid: false;
}

type TotpVerificationResult = TotpVerificationSuccess | TotpVerificationFailure;

interface EnabledTotpSecretFields {
	readonly twoFactorSecretCiphertext: string | null;
	readonly twoFactorSecretIv: string | null;
	readonly twoFactorSecretKeyVersion: number | null;
}

@Injectable()
export class TwoFactorService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly cryptoService: CryptoService,
		private readonly config: TypedConfigService,
		private readonly secretEncryptionService: SecretEncryptionService,
		private readonly mfaChallengeService: MfaChallengeService,
		private readonly accessTokenStateService: AccessTokenStateService,
		private readonly accountLockoutService: AccountLockoutService,
		private readonly emailService: EmailService,
		private readonly loginVerificationService: LoginVerificationService,
		private readonly logService: LogService,
	) {}

	public async generateSetup(userId: string): Promise<TwoFactorSetupResponse> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { email: true, twoFactorEnabled: true },
		});

		if (user === null) {
			throw new NotFoundException("User not found");
		}

		if (user.twoFactorEnabled) {
			throw new BadRequestException("Two-factor authentication is already enabled");
		}

		const secret = generateSecret();
		const backupCodes = this.generateBackupCodes();
		const backupCodesHashes = await Promise.all(backupCodes.map((code) => this.cryptoService.hash(code)));
		const encryptedSecret = this.secretEncryptionService.encrypt(secret, "totp-pending");
		const expiresAt = Date.now() + SETUP_TTL_MS;

		await this.prisma.twoFactorPendingSetup.upsert({
			where: { userId },
			update: {
				secretCiphertext: encryptedSecret.ciphertext,
				secretIv: encryptedSecret.iv,
				secretKeyVersion: encryptedSecret.keyVersion,
				backupCodesHashes,
				expiresAt,
			},
			create: {
				userId,
				secretCiphertext: encryptedSecret.ciphertext,
				secretIv: encryptedSecret.iv,
				secretKeyVersion: encryptedSecret.keyVersion,
				backupCodesHashes,
				expiresAt,
			},
		});

		const otpAuthUrl = generateURI({
			issuer: this.config.appName,
			label: user.email,
			secret,
		});
		const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

		return {
			secret,
			qrCodeDataUrl,
			backupCodes,
		};
	}

	public async enableTwoFactor(userId: string, dto: EnableTwoFactorInput): Promise<TwoFactorMessageResponse> {
		const pending = await this.prisma.twoFactorPendingSetup.findUnique({
			where: { userId },
		});

		if (pending === null || pending.expiresAt < Date.now()) {
			throw new BadRequestException("2FA setup expired or not initiated");
		}

		const secret = this.secretEncryptionService.decrypt(pending.secretCiphertext, pending.secretIv, pending.secretKeyVersion, "totp-pending");

		const verification = verifySync({ token: dto.token, secret, epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS });
		if (!verification.valid) {
			throw new UnauthorizedException("Invalid 2FA token");
		}

		const backupHashes = this.parseBackupCodeHashes(pending.backupCodesHashes);
		const encryptedSecret = this.secretEncryptionService.encrypt(secret, "totp-secret");
		const enrolledAt = Date.now();
		const verifiedTimeStep = this.resolveVerifiedTimeStep(verification.delta);

		await this.prisma.$transaction([
			this.prisma.user.update({
				where: { id: userId },
				data: {
					twoFactorEnabled: true,
					twoFactorSecret: null,
					twoFactorSecretCiphertext: encryptedSecret.ciphertext,
					twoFactorSecretIv: encryptedSecret.iv,
					twoFactorSecretKeyVersion: encryptedSecret.keyVersion,
					twoFactorLastTotpStep: BigInt(verifiedTimeStep),
					mfaEnrolledAt: enrolledAt,
					mfaAssuredAt: enrolledAt,
					updatedAt: enrolledAt,
				},
			}),
			this.prisma.backupCode.deleteMany({ where: { userId } }),
			this.prisma.backupCode.createMany({
				data: backupHashes.map((codeHash) => ({
					userId,
					codeHash,
				})),
			}),
			this.prisma.twoFactorPendingSetup.delete({ where: { userId } }),
		]);

		await this.accessTokenStateService.bumpTokenVersion(userId);

		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { email: true },
		});

		if (user !== null) {
			await this.emailService.sendTwoFactorEnabledEmail(user.email);
		}

		this.logService.info("MFA enrollment completed", {
			userId,
			context: "TwoFactorService",
			metadata: { event: "mfa.enrollment", enrolledAt },
		});

		return { message: "Two-factor authentication enabled successfully" };
	}

	public async rotateTwoFactor(userId: string, dto: RotateTwoFactorInput): Promise<TwoFactorSetupResponse> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				passwordHash: true,
				twoFactorEnabled: true,
				twoFactorSecretCiphertext: true,
				twoFactorSecretIv: true,
				twoFactorSecretKeyVersion: true,
				twoFactorLastTotpStep: true,
			},
		});

		if (user === null) {
			throw new NotFoundException("User not found");
		}

		if (!user.twoFactorEnabled) {
			throw new BadRequestException("Two-factor authentication is not enabled");
		}

		const passwordValid = await this.cryptoService.compare(dto.password, user.passwordHash);
		if (!passwordValid) {
			throw new UnauthorizedException("Invalid password");
		}

		if (dto.token !== undefined) {
			const secret = this.decryptEnabledTotpSecret(user);
			const verification = this.verifyTotpToken(secret, dto.token, user.twoFactorLastTotpStep);
			if (!verification.valid) {
				throw new UnauthorizedException("Invalid 2FA token");
			}
		} else if (dto.backupCode !== undefined) {
			const backupValid = await this.matchesUnusedBackupCode(userId, dto.backupCode);
			if (!backupValid) {
				throw new UnauthorizedException("Invalid or used backup code");
			}
			this.logService.info("MFA backup code used for rotation verification", {
				userId,
				context: "TwoFactorService",
				metadata: { event: "mfa.backup_code.use", context: "rotation_verify" },
			});
		}

		await this.clearTwoFactorState(userId);
		await this.accessTokenStateService.bumpTokenVersion(userId);

		this.logService.info("MFA rotation initiated", {
			userId,
			context: "TwoFactorService",
			metadata: {
				event: "mfa.rotation",
				verificationMethod: dto.token !== undefined ? "totp" : "backup_code",
			},
		});

		return this.generateSetup(userId);
	}

	public async verifyBackupCode(userId: string, dto: VerifyBackupCodeInput): Promise<VerifyBackupCodeResponse> {
		const valid = await this.matchesUnusedBackupCode(userId, dto.backupCode);
		return { valid };
	}

	public async getBackupCodesRemaining(userId: string): Promise<BackupCodesRemainingResponse> {
		const remaining = await this.prisma.backupCode.count({
			where: { userId, usedAt: null },
		});

		return { remaining };
	}

	public async createLoginChallenge(userId: string, clientType?: string, deviceInfo?: string, ipAddress?: string): Promise<LoginTwoFactorPendingResponse> {
		const challengeId = await this.mfaChallengeService.createLoginChallenge(userId, TwoFactorLoginChallengePurpose.LOGIN, clientType, deviceInfo, ipAddress);
		const tempToken = await this.mfaChallengeService.signChallengeRef(challengeId);

		return {
			requiresTwoFactor: true,
			tempToken,
			message: "Two-factor authentication required",
		};
	}

	public async completeLoginWithTotp(dto: LoginTwoFactorInput): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse> {
		const challenge = await this.mfaChallengeService.verifyChallengeRef(dto.tempToken);
		if (challenge.purpose !== "LOGIN") {
			throw new UnauthorizedException("Invalid MFA challenge");
		}

		await this.mfaChallengeService.assertChallengeActive(challenge.challengeId);

		const user = await this.prisma.user.findUnique({
			where: { id: challenge.userId },
			select: {
				twoFactorEnabled: true,
				twoFactorSecretCiphertext: true,
				twoFactorSecretIv: true,
				twoFactorSecretKeyVersion: true,
				twoFactorLastTotpStep: true,
			},
		});

		if (!user?.twoFactorEnabled) {
			throw new UnauthorizedException("Two-factor authentication is not enabled for this account");
		}

		const secret = this.decryptEnabledTotpSecret(user);
		const verification = this.verifyTotpToken(secret, dto.token, user.twoFactorLastTotpStep);

		if (!verification.valid) {
			await this.mfaChallengeService.recordFailedAttempt(challenge.challengeId);
			this.logService.info("MFA login challenge failed", {
				userId: challenge.userId,
				context: "TwoFactorService",
				metadata: { event: "mfa.challenge.fail", challengeId: challenge.challengeId, method: "totp" },
			});
		} else {
			const assuredAt = Date.now();

			await this.mfaChallengeService.consumeChallenge(challenge.challengeId);
			await this.accountLockoutService.resetAttempts(challenge.userId);
			await this.prisma.user.update({
				where: { id: challenge.userId },
				data: {
					twoFactorLastTotpStep: BigInt(verification.timeStep),
					mfaAssuredAt: assuredAt,
					updatedAt: assuredAt,
				},
			});

			this.logService.info("MFA login challenge succeeded", {
				userId: challenge.userId,
				context: "TwoFactorService",
				metadata: { event: "mfa.challenge.success", challengeId: challenge.challengeId, method: "totp" },
			});

			return this.loginVerificationService.maybeRequireVerification({
				userId: challenge.userId,
				clientType: challenge.clientType,
				deviceInfo: challenge.deviceInfo,
				ipAddress: challenge.ipAddress,
				mfaAssured: true,
			});
		}

		throw new UnauthorizedException("Invalid 2FA code");
	}

	public async completeLoginWithBackupCode(
		dto: VerifyBackupCodeLoginInput,
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse> {
		const challenge = await this.mfaChallengeService.verifyChallengeRef(dto.tempToken);
		if (challenge.purpose !== "LOGIN") {
			throw new UnauthorizedException("Invalid MFA challenge");
		}

		await this.mfaChallengeService.assertChallengeActive(challenge.challengeId);

		const valid = await this.consumeBackupCode(challenge.userId, dto.backupCode, "login");
		if (!valid) {
			this.logService.info("MFA login challenge failed", {
				userId: challenge.userId,
				context: "TwoFactorService",
				metadata: { event: "mfa.challenge.fail", challengeId: challenge.challengeId, method: "backup_code" },
			});
			throw new UnauthorizedException("Invalid or used backup code");
		}

		const assuredAt = Date.now();

		await this.mfaChallengeService.consumeChallenge(challenge.challengeId);
		await this.accountLockoutService.resetAttempts(challenge.userId);
		await this.prisma.user.update({
			where: { id: challenge.userId },
			data: {
				mfaAssuredAt: assuredAt,
				updatedAt: assuredAt,
			},
		});

		this.logService.info("MFA login challenge succeeded", {
			userId: challenge.userId,
			context: "TwoFactorService",
			metadata: { event: "mfa.challenge.success", challengeId: challenge.challengeId, method: "backup_code" },
		});

		return this.loginVerificationService.maybeRequireVerification({
			userId: challenge.userId,
			clientType: challenge.clientType,
			deviceInfo: challenge.deviceInfo,
			ipAddress: challenge.ipAddress,
			mfaAssured: true,
		});
	}

	private async clearTwoFactorState(userId: string): Promise<void> {
		await this.prisma.$transaction([
			this.prisma.user.update({
				where: { id: userId },
				data: {
					twoFactorEnabled: false,
					twoFactorSecret: null,
					twoFactorSecretCiphertext: null,
					twoFactorSecretIv: null,
					twoFactorSecretKeyVersion: null,
					twoFactorLastTotpStep: null,
					mfaAssuredAt: null,
					mfaEnrolledAt: null,
					updatedAt: Date.now(),
				},
			}),
			this.prisma.backupCode.deleteMany({ where: { userId } }),
			this.prisma.twoFactorPendingSetup.deleteMany({ where: { userId } }),
		]);
	}

	private decryptEnabledTotpSecret(user: EnabledTotpSecretFields): string {
		if (user.twoFactorSecretCiphertext === null || user.twoFactorSecretIv === null || user.twoFactorSecretKeyVersion === null) {
			throw new UnauthorizedException("Two-factor authentication is not configured for this account");
		}

		return this.secretEncryptionService.decrypt(user.twoFactorSecretCiphertext, user.twoFactorSecretIv, user.twoFactorSecretKeyVersion, "totp-secret");
	}

	private verifyTotpToken(secret: string, token: string, lastTotpStep: bigint | null): TotpVerificationResult {
		const afterTimeStep = lastTotpStep !== null ? Number(lastTotpStep) : undefined;
		const verification = verifySync({
			token,
			secret,
			epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
			afterTimeStep,
		});

		if (!verification.valid) {
			return { valid: false };
		}

		return { valid: true, timeStep: this.resolveVerifiedTimeStep(verification.delta) };
	}

	private async matchesUnusedBackupCode(userId: string, backupCode: string): Promise<boolean> {
		const records = await this.prisma.backupCode.findMany({
			where: { userId, usedAt: null },
			select: { codeHash: true },
		});

		for (const record of records) {
			const matches = await this.cryptoService.compare(backupCode, record.codeHash);
			if (matches) {
				return true;
			}
		}

		return false;
	}

	private async consumeBackupCode(userId: string, backupCode: string, usageContext: string): Promise<boolean> {
		const records = await this.prisma.backupCode.findMany({
			where: { userId, usedAt: null },
			select: { id: true, codeHash: true },
		});

		for (const record of records) {
			const matches = await this.cryptoService.compare(backupCode, record.codeHash);
			if (matches) {
				const consumedAt = Date.now();
				const updatedCount = await this.prisma.$transaction(async (tx) => {
					const result = await tx.backupCode.updateMany({
						where: { id: record.id, usedAt: null },
						data: { usedAt: consumedAt },
					});
					return result.count;
				});

				if (updatedCount === 1) {
					this.logService.info("MFA backup code consumed", {
						userId,
						context: "TwoFactorService",
						metadata: { event: "mfa.backup_code.use", usageContext, backupCodeId: record.id },
					});
				}

				return updatedCount === 1;
			}
		}

		return false;
	}

	private generateBackupCodes(): string[] {
		const codes: string[] = [];
		for (let index = 0; index < BACKUP_CODE_COUNT; index += 1) {
			codes.push(this.generateBackupCode());
		}
		return codes;
	}

	private generateBackupCode(): string {
		const chars: string[] = [];
		for (let index = 0; index < 16; index += 1) {
			const charIndex = crypto.randomInt(0, BACKUP_CODE_CHARSET.length);
			chars.push(BACKUP_CODE_CHARSET.charAt(charIndex));
		}
		return chars.join("");
	}

	private resolveVerifiedTimeStep(delta: number): number {
		const currentEpoch = Math.floor(Date.now() / 1000);
		const currentTimeStep = Math.floor(currentEpoch / TOTP_PERIOD_SECONDS);
		return currentTimeStep + delta;
	}

	private parseBackupCodeHashes(value: Parameters<typeof BackupCodesHashesSchema.parse>[0]): readonly string[] {
		return BackupCodesHashesSchema.parse(value);
	}
}
