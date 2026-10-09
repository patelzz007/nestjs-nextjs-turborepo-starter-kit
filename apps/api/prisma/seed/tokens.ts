import type { User } from "@prisma/client";
import * as crypto from "crypto";
import * as bcrypt from "bcrypt";

import { PASSWORD_RESET_LINK_TTL_HOURS } from "@workspace/shared";

import { getApiConfig } from "../../src/config/api-config";
import { TypedConfigService } from "../../src/config/typed-config.service";
import { CryptoService } from "../../src/modules/auth/services/crypto.service";
import { prisma } from "./client";
import { SEED_BROWSER_PROFILES, SEED_MOBILE_PROFILES, SEED_SESSION_LOCATIONS, SEED_SIGN_IN_METHODS, seedSessionRow } from "./device-sessions";
import { daysAgo, daysFromNow, rand, randInt, randomIpv4 } from "./helpers";

/** bcrypt cost for seeded secrets (matches the users seeder; the app's cost comes from BCRYPT_SALT_ROUNDS). */
const SEED_BCRYPT_ROUNDS = 10;

/** Bytes of entropy behind each seeded (never-issued) refresh token secret. */
const SEED_REFRESH_SECRET_BYTES = 32;
const MINUTE_MS = 60_000;

/**
 * Two demo device sessions per active user — one in a browser app (web,
 * merchant or admin) and one in the mobile app (iOS or Android) — with every
 * device detail a real sign-in stores (`seedSessionRow`, through the API's own
 * User-Agent parser and header validation), the sign-in method, the sign-in
 * and last-refresh IPs, the last activity and a location. The `token` column
 * holds a bcrypt HASH of a random, discarded secret — never a usable token:
 * these rows populate the device lists, they cannot be used to refresh.
 */
export async function createRefreshTokens(users: User[]): Promise<void> {
	const activeUsers = users.filter((u) => u.isActive);
	const hashedSecret = async (): Promise<string> => bcrypt.hash(crypto.randomBytes(SEED_REFRESH_SECRET_BYTES).toString("hex"), SEED_BCRYPT_ROUNDS);
	for (const u of activeUsers) {
		const browserSignedInAt: number = daysAgo(randInt(1, 6));
		const mobileSignedInAt: number = daysAgo(randInt(1, 20));
		const browserIp: string = randomIpv4();
		const mobileIp: string = randomIpv4();
		await prisma.refreshToken.createMany({
			data: [
				seedSessionRow({
					userId: u.id,
					tokenHash: await hashedSecret(),
					profile: rand(SEED_BROWSER_PROFILES),
					signInMethod: rand(SEED_SIGN_IN_METHODS),
					ipAddress: browserIp,
					lastIpAddress: rand([browserIp, randomIpv4()]),
					location: rand([...SEED_SESSION_LOCATIONS, null]),
					createdAt: browserSignedInAt,
					lastActiveAt: Date.now() - randInt(1, 600) * MINUTE_MS,
					expiresAt: daysFromNow(7),
				}),
				seedSessionRow({
					userId: u.id,
					tokenHash: await hashedSecret(),
					profile: rand(SEED_MOBILE_PROFILES),
					signInMethod: rand(SEED_SIGN_IN_METHODS),
					ipAddress: mobileIp,
					lastIpAddress: randomIpv4(),
					location: rand(SEED_SESSION_LOCATIONS),
					createdAt: mobileSignedInAt,
					lastActiveAt: Date.now() - randInt(1, 2_000) * MINUTE_MS,
					expiresAt: daysFromNow(7),
				}),
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
