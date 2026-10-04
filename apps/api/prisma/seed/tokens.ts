import type { User } from "@prisma/client";
import * as crypto from "crypto";
import * as bcrypt from "bcrypt";

import { PASSWORD_RESET_LINK_TTL_HOURS } from "@workspace/shared";

import { getApiConfig } from "../../src/config/api-config";
import { TypedConfigService } from "../../src/config/typed-config.service";
import { CryptoService } from "../../src/modules/auth/services/crypto.service";
import { prisma } from "./client";
import { daysAgo, daysFromNow, rand, randomIpv4 } from "./helpers";

/** bcrypt cost for seeded secrets (matches the users seeder; the app's cost comes from BCRYPT_SALT_ROUNDS). */
const SEED_BCRYPT_ROUNDS = 10;

/** Bytes of entropy behind each seeded (never-issued) refresh token secret. */
const SEED_REFRESH_SECRET_BYTES = 32;

/**
 * Two demo sessions per active user. Like the app (`AuthSessionService`), the
 * `token` column holds a bcrypt HASH — never a usable plaintext. The secrets
 * are random and discarded: these rows populate session lists, they cannot be
 * used to refresh.
 */
export async function createRefreshTokens(users: User[]): Promise<void> {
	const activeUsers = users.filter((u) => u.isActive);
	const hashedSecret = async (): Promise<string> => bcrypt.hash(crypto.randomBytes(SEED_REFRESH_SECRET_BYTES).toString("hex"), SEED_BCRYPT_ROUNDS);
	for (const u of activeUsers) {
		await prisma.refreshToken.createMany({
			data: [
				{
					userId: u.id,
					token: await hashedSecret(),
					deviceInfo: rand(["Chrome on Windows", "Safari on macOS", "Firefox on Linux"]),
					ipAddress: randomIpv4(),
					expiresAt: daysFromNow(7),
				},
				{
					userId: u.id,
					token: await hashedSecret(),
					deviceInfo: rand(["Chrome on Android", "Safari on iOS", "Samsung Internet"]),
					ipAddress: randomIpv4(),
					expiresAt: daysFromNow(30),
				},
			],
		});
	}
}

/** Milliseconds per hour — converts the shared reset-link lifetime to an expiry. */
const MS_PER_HOUR = 3_600_000;
/** The cleanup retires an expired token one hour after its expiry (mirrors `TaskScheduleService`). */
const RESET_TOKEN_CLEANUP_GRACE_MS = MS_PER_HOUR;

type ResetTokenState = "pending" | "used" | "expired" | "retired";

/** One seeded reset token: whose, and in which lifecycle state the app would leave it. */
interface ResetTokenSeed {
	readonly email: string;
	readonly state: ResetTokenState;
}

const RESET_TOKEN_SEEDS: readonly ResetTokenSeed[] = [
	{ email: "user@example.com", state: "pending" },
	{ email: "alice.johnson@example.com", state: "pending" },
	{ email: "henry.moore@example.com", state: "used" },
	{ email: "carol.white@example.com", state: "expired" },
	{ email: "alice.johnson@example.com", state: "retired" },
];

/**
 * Password-reset tokens in every state `PasswordResetService` produces, written
 * the way it writes them: bcrypt `token` + SHA-256 `tokenDigest` of a random
 * raw secret (discarded — these links were "emailed"), and `expiresAt` from the
 * shared `PASSWORD_RESET_LINK_TTL_HOURS`. `used` = consumed by a reset
 * (`usedAt`); `expired` = past its lifetime, not yet cleaned up; `retired` =
 * expired and soft-deleted by the hourly cleanup (`TaskScheduleService`).
 */
export async function createPasswordResetTokens(users: User[]): Promise<void> {
	const tokenCrypto = new CryptoService(new TypedConfigService(getApiConfig()));
	const lifetimeMs: number = PASSWORD_RESET_LINK_TTL_HOURS * MS_PER_HOUR;
	const activeUsers = users.filter((u) => u.isActive);

	for (const seed of RESET_TOKEN_SEEDS) {
		const user = activeUsers.find((u) => u.email === seed.email);
		if (!user) continue;
		const rawToken: string = tokenCrypto.generateRandomToken();
		const issuedAt: number = seed.state === "pending" ? Date.now() - MS_PER_HOUR / 4 : daysAgo(2);
		await prisma.passwordResetToken.create({
			data: {
				userId: user.id,
				token: await tokenCrypto.hash(rawToken),
				tokenDigest: tokenCrypto.hashTokenDigest(rawToken),
				expiresAt: issuedAt + lifetimeMs,
				usedAt: seed.state === "used" ? issuedAt + lifetimeMs / 2 : null,
				isDeleted: seed.state === "retired",
				deletedAt: seed.state === "retired" ? issuedAt + lifetimeMs + RESET_TOKEN_CLEANUP_GRACE_MS : null,
				createdAt: issuedAt,
				updatedAt: issuedAt,
			},
		});
	}
}
