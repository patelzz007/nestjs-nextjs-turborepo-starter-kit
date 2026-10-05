import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { TypedConfigService } from "../../../config/typed-config.service";
import { LogService } from "../../logs/logs.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AccessTokenStateService } from "./access-token-state.service";
import { AccountLockoutService } from "./account-lockout.service";
import { CryptoService } from "./crypto.service";
import { EmailService } from "./email.service";
import { LoginVerificationService } from "./login-verification.service";
import { MfaChallengeService } from "./mfa-challenge.service";
import { SecretEncryptionService } from "./secret-encryption.service";
import { TwoFactorService } from "./two-factor.service";

const otplib = vi.hoisted(() => ({
	generateURI: vi.fn((_options: { readonly issuer: string; readonly label: string; readonly secret: string }): string => "otpauth://totp/test"),
}));

vi.mock("otplib", () => ({
	generateSecret: (): string => "SECRET",
	generateURI: otplib.generateURI,
	verifySync: (): { readonly valid: true; readonly delta: number } => ({ valid: true, delta: 0 }),
}));

const USER_ID = "user-1";

/** The soft-delete write's `data` — parsed, not cast. */
const SoftDeleteArgsSchema = z.object({ data: z.object({ deletedAt: z.number() }) });

/** Every write the transaction batch receives, recorded as `{ model.operation: args }`. */
interface RecordedWrite {
	readonly operation: string;
	readonly args: object;
}

const writes: RecordedWrite[] = [];

function recorder(operation: string): (args: object) => RecordedWrite {
	return (args: object): RecordedWrite => ({ operation, args });
}

const prismaDouble = {
	twoFactorPendingSetup: {
		findUnique: vi.fn(() =>
			Promise.resolve({
				userId: USER_ID,
				secretCiphertext: "c",
				secretIv: "iv",
				secretKeyVersion: 1,
				backupCodesHashes: ["hash-1", "hash-2"],
				expiresAt: BigInt(Date.now() + 60_000),
			}),
		),
		delete: recorder("twoFactorPendingSetup.delete"),
		upsert: vi.fn(() => Promise.resolve({})),
	},
	user: {
		update: recorder("user.update"),
		findUnique: vi.fn(() => Promise.resolve({ email: "member@example.com" })),
	},
	backupCode: {
		deleteMany: recorder("backupCode.deleteMany"),
		updateMany: recorder("backupCode.updateMany"),
		createMany: recorder("backupCode.createMany"),
	},
	$transaction: vi.fn((batch: readonly RecordedWrite[]) => {
		writes.push(...batch);
		return Promise.resolve([]);
	}),
};

async function createService(): Promise<TwoFactorService> {
	const moduleRef = await Test.createTestingModule({
		providers: [
			TwoFactorService,
			{ provide: PrismaService, useValue: prismaDouble },
			{ provide: CryptoService, useValue: { hash: (): Promise<string> => Promise.resolve("hash") } },
			{ provide: TypedConfigService, useValue: { runtime: { appName: "Test" }, auth: { twoFactorIssuer: "Issuer Co" } } },
			{
				provide: SecretEncryptionService,
				useValue: {
					decrypt: (): string => "SECRET",
					encrypt: (): { readonly ciphertext: string; readonly iv: string; readonly keyVersion: number } => ({ ciphertext: "c2", iv: "iv2", keyVersion: 1 }),
				},
			},
			{ provide: MfaChallengeService, useValue: {} },
			{ provide: AccessTokenStateService, useValue: { bumpTokenVersion: (): Promise<void> => Promise.resolve() } },
			{ provide: AccountLockoutService, useValue: {} },
			{ provide: EmailService, useValue: { sendTwoFactorEnabledEmail: (): Promise<void> => Promise.resolve() } },
			{ provide: LoginVerificationService, useValue: {} },
			{ provide: LogService, useValue: { info: (): void => undefined } },
		],
	})
		.useMocker((token) => {
			throw new Error(`Unexpected dependency ${String(token)}`);
		})
		.compile();
	return moduleRef.get(TwoFactorService);
}

describe("TwoFactorService.generateSetup", () => {
	it("labels the authenticator entry with the configured TWO_FACTOR_ISSUER, not the app name", async () => {
		const service = await createService();

		await service.generateSetup(USER_ID);

		expect(otplib.generateURI).toHaveBeenCalledWith({ issuer: "Issuer Co", label: "member@example.com", secret: "SECRET" });
	});
});

describe("TwoFactorService.enableTwoFactor", () => {
	beforeEach(() => {
		writes.length = 0;
	});

	it("soft-deletes the previous backup codes (attributed to the member) — never a hard delete", async () => {
		const service = await createService();

		await service.enableTwoFactor(USER_ID, { token: "123456" });

		const operations: string[] = writes.map((write: RecordedWrite): string => write.operation);
		expect(operations).not.toContain("backupCode.deleteMany");
		const softDelete = writes.find((write: RecordedWrite): boolean => write.operation === "backupCode.updateMany");
		expect(softDelete?.args).toMatchObject({ where: { userId: USER_ID, isDeleted: false }, data: { isDeleted: true, deletedBy: USER_ID } });
		const { data } = SoftDeleteArgsSchema.parse(softDelete?.args);
		expect(data.deletedAt).toBeGreaterThan(0);
		expect(operations.indexOf("backupCode.updateMany")).toBeLessThan(operations.indexOf("backupCode.createMany"));
	});
});
