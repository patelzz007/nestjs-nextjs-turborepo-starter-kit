import * as crypto from "crypto";

import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { generateSecret, generateURI, verifySync } from "otplib";
import * as QRCode from "qrcode";
import type {
	DisableTwoFactorInput,
	EnableTwoFactorInput,
	LoginTwoFactorInput,
	LoginTwoFactorPendingResponse,
	LoginServiceResponse,
	LoginVerificationPendingResponse,
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
import { CryptoService } from "./crypto.service";
import { EmailService } from "./email.service";
import { LoginVerificationService } from "./login-verification.service";
import { TokenService } from "./token.service";

const SETUP_TTL_MS = 15 * 60 * 1000;
const BACKUP_CODE_COUNT = 8;
const MAX_VERIFY_ATTEMPTS = 5;
/** Allow ±1 TOTP period for clock skew between server and authenticator app. */
const TOTP_EPOCH_TOLERANCE_SECONDS = 30;

const BackupCodesHashesSchema = z.array(z.string().min(1));

@Injectable()
export class TwoFactorService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly cryptoService: CryptoService,
		private readonly config: TypedConfigService,
		private readonly tokenService: TokenService,
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
		const expiresAt = Date.now() + SETUP_TTL_MS;

		await this.prisma.twoFactorPendingSetup.upsert({
			where: { userId },
			update: {
				secret,
				backupCodesHashes,
				expiresAt,
			},
			create: {
				userId,
				secret,
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

		const verification = verifySync({ token: dto.token, secret: pending.secret, epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS });
		if (!verification.valid) {
			throw new UnauthorizedException("Invalid 2FA token");
		}

		const backupHashes = this.parseBackupCodeHashes(pending.backupCodesHashes);

		await this.prisma.$transaction([
			this.prisma.user.update({
				where: { id: userId },
				data: {
					twoFactorEnabled: true,
					twoFactorSecret: pending.secret,
					updatedAt: Date.now(),
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

		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { email: true },
		});

		if (user !== null) {
			await this.emailService.sendTwoFactorEnabledEmail(user.email);
		}

		this.logService.info("2FA enabled", { userId, context: "TwoFactorService" });

		return { message: "Two-factor authentication enabled successfully" };
	}

	public async disableTwoFactor(userId: string, dto: DisableTwoFactorInput): Promise<TwoFactorMessageResponse> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { email: true, passwordHash: true, twoFactorEnabled: true },
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

		await this.prisma.$transaction([
			this.prisma.user.update({
				where: { id: userId },
				data: {
					twoFactorEnabled: false,
					twoFactorSecret: null,
					updatedAt: Date.now(),
				},
			}),
			this.prisma.backupCode.deleteMany({ where: { userId } }),
			this.prisma.twoFactorPendingSetup.deleteMany({ where: { userId } }),
		]);

		await this.emailService.sendTwoFactorDisabledEmail(user.email);

		return { message: "Two-factor authentication disabled successfully" };
	}

	public async verifyBackupCode(userId: string, dto: VerifyBackupCodeInput): Promise<VerifyBackupCodeResponse> {
		const valid = await this.consumeBackupCode(userId, dto.backupCode);
		return { valid };
	}

	public async createLoginChallenge(userId: string, clientType?: string, deviceInfo?: string, ipAddress?: string): Promise<LoginTwoFactorPendingResponse> {
		const tempToken = await this.tokenService.generateTwoFactorPendingToken(userId, clientType ?? null, deviceInfo ?? null, ipAddress ?? null);
		return {
			requiresTwoFactor: true,
			tempToken,
			message: "Two-factor authentication required",
		};
	}

	public async completeLoginWithTotp(dto: LoginTwoFactorInput): Promise<LoginServiceResponse | LoginVerificationPendingResponse> {
		const pending = await this.tokenService.verifyTwoFactorPendingToken(dto.tempToken);
		const user = await this.prisma.user.findUnique({
			where: { id: pending.sub },
			select: { twoFactorEnabled: true, twoFactorSecret: true },
		});

		if (user === null || !user.twoFactorEnabled || user.twoFactorSecret === null) {
			throw new UnauthorizedException("Two-factor authentication is not enabled for this account");
		}

		const verification = verifySync({ token: dto.token, secret: user.twoFactorSecret, epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS });
		if (!verification.valid) {
			throw new UnauthorizedException("Invalid 2FA code");
		}

		return this.loginVerificationService.maybeRequireVerification({
			userId: pending.sub,
			clientType: pending.clientType,
			deviceInfo: pending.deviceInfo,
			ipAddress: pending.ipAddress,
		});
	}

	public async completeLoginWithBackupCode(dto: VerifyBackupCodeLoginInput): Promise<LoginServiceResponse | LoginVerificationPendingResponse> {
		const pending = await this.tokenService.verifyTwoFactorPendingToken(dto.tempToken);
		const valid = await this.consumeBackupCode(pending.sub, dto.backupCode);

		if (!valid) {
			throw new UnauthorizedException("Invalid or used backup code");
		}

		return this.loginVerificationService.maybeRequireVerification({
			userId: pending.sub,
			clientType: pending.clientType,
			deviceInfo: pending.deviceInfo,
			ipAddress: pending.ipAddress,
		});
	}

	private async consumeBackupCode(userId: string, backupCode: string): Promise<boolean> {
		const records = await this.prisma.backupCode.findMany({
			where: { userId, usedAt: null },
			select: { id: true, codeHash: true },
		});

		for (const record of records) {
			const matches = await this.cryptoService.compare(backupCode, record.codeHash);
			if (matches) {
				await this.prisma.backupCode.update({
					where: { id: record.id },
					data: { usedAt: Date.now() },
				});
				return true;
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
		const digits: number[] = [];
		for (let index = 0; index < 7; index += 1) {
			digits.push(crypto.randomInt(0, 10));
		}
		const checksum = this.calculateLuhnChecksum(digits);
		return [...digits, checksum].join("");
	}

	private calculateLuhnChecksum(digits: readonly number[]): number {
		const reversed = [...digits].reverse();
		let sum = 0;
		for (let index = 0; index < reversed.length; index += 1) {
			let digit = reversed[index] ?? 0;
			if (index % 2 === 0) {
				digit *= 2;
				if (digit > 9) {
					digit -= 9;
				}
			}
			sum += digit;
		}
		return (10 - (sum % 10)) % 10;
	}

	private parseBackupCodeHashes(value: unknown): readonly string[] {
		return BackupCodesHashesSchema.parse(value);
	}
}
