import { createHash } from "node:crypto";

import type { MfaRecoveryRequestStatus, Prisma, SupportAccessGrantStatus, User } from "@prisma/client";
import { BACKUP_CODE_CHARSET, BACKUP_CODE_COUNT, BACKUP_CODE_LENGTH, DAY_MS } from "@workspace/shared";

import { getApiConfig } from "../../src/config/api-config";
import { TypedConfigService } from "../../src/config/typed-config.service";
import { IMPERSONATION_TOKEN_TTL_SECONDS } from "../../src/modules/auth/constants/impersonation.constants";
import { ImpersonationAuditAction } from "../../src/modules/auth/repositories/impersonation-session.repository";
import { MfaRecoveryAuditAction } from "../../src/modules/auth/repositories/mfa-recovery.repository";
import { CryptoService } from "../../src/modules/auth/services/crypto.service";
import { SecretEncryptionService } from "../../src/modules/auth/services/secret-encryption.service";
import { findActivePolicyVersionInTx } from "../../src/modules/organization/utils/rewardhub-policy-seed.util";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { daysAgo } from "./helpers";
import { requireRow } from "./require-row";

// ---------------------------------------------------------------------------
// Account security — every auth/session table and column, written through the
// app's own invariants:
//   • TOTP secrets encrypted with the app's `SecretEncryptionService` (AES-GCM,
//     the real key ring and AAD context), backup codes / refresh tokens /
//     password history hashed with the app's `CryptoService` (bcrypt).
//   • An ENDED SuperAdmin impersonation session with START/STOP audit rows.
//   • A COMPLETED MFA recovery the SuperAdmin filed while impersonating the
//     user — every transition audited with the real actor, correlation id,
//     client and impersonator; the recovered account's backup codes
//     soft-deleted (deletedBy = approving admin), never removed.
//   • An MFA-enrolled user (live + used backup codes, a live and a consumed
//     login challenge, last TOTP step), a user mid-enrollment (pending setup),
//     a locked-out user, password history, a rotated and a revoked session.
//   • Support-access grants in every lifecycle state with their organization
//     audit rows under the organization's active policy version.
//
// Scenario-independent: each scenario passes its own cast; every row id is
// derived from the cast's namespace + a stable key, and rows are UPSERTED, so
// re-running converges instead of duplicating.
// ---------------------------------------------------------------------------

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

/** TOTP period (RFC 6238 default, as the app verifies). */
const TOTP_PERIOD_SECONDS = 30;
/** Bytes of a TOTP secret (160 bits, RFC 4226 recommendation). */
const TOTP_SECRET_BYTES = 20;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE32_BITS_PER_CHAR = 5;
const BITS_PER_BYTE = 8;
/** Lifetimes mirroring the services that create these rows. */
const LOGIN_CHALLENGE_TTL_MS = 10 * MINUTE_MS;
const PENDING_SETUP_TTL_MS = 15 * MINUTE_MS;
const LOCK_DURATION_MS = 15 * MINUTE_MS;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const MFA_RECOVERY_DELAY_MS = DAY_MS;
const IMPERSONATION_TTL_MS = IMPERSONATION_TOKEN_TTL_SECONDS * SECOND_MS;
/** How long the seeded impersonation lasted before the admin stopped it. */
const IMPERSONATION_DURATION_MS = 6 * MINUTE_MS;
/** How many of the enrolled user's backup codes were already used at login. */
const USED_BACKUP_CODE_COUNT = 2;
const SUPPORT_GRANT_DURATION_MS = 2 * HOUR_MS;

const SUPPORT_IP = "203.0.113.24";
const SUPPORT_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const USER_IP = "198.51.100.73";
// const USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

/** The organization a scenario seeds support-access grants for. */
export interface SupportAccessSeedTarget {
	readonly organizationId: string;
	/** An active OWNER of the organization — the tenant-side approver. */
	readonly owner: User;
}

/** Who plays which part in a scenario's account-security history. */
export interface AccountSecurityCast {
	/** Namespace of every deterministic row id — one per scenario. */
	readonly namespace: string;
	readonly superAdmin: User;
	/** Filed an MFA recovery (through the SuperAdmin's impersonation session) that was completed. */
	readonly recoveredUser: User;
	/** MFA enrolled: encrypted secret, backup codes, login challenges, rotated session. */
	readonly mfaUser: User;
	/** Mid-enrollment: an unconfirmed pending setup. */
	readonly enrollingUser: User;
	/** Locked out after too many failed logins. */
	readonly lockedUser: User;
	readonly supportAccess: SupportAccessSeedTarget;
}

export interface AccountSecuritySeedSummary {
	readonly impersonationSessions: number;
	readonly mfaRecoveryRequests: number;
	readonly backupCodes: number;
	readonly loginChallenges: number;
	readonly pendingSetups: number;
	readonly passwordHistoryRows: number;
	readonly supportAccessGrants: number;
	/** Seed-only credentials so a developer can sign in as the MFA user. */
	readonly mfaUserTotpSecret: string;
	readonly mfaUserUnusedBackupCode: string;
}

/** A create input whose id is known (the upsert key). */
type WithId<T> = T & { readonly id: string };

/** RFC 4648 base32 (no padding) — the encoding authenticator apps expect. */
function toBase32(bytes: Buffer): string {
	let bits = 0;
	let value = 0;
	let output = "";
	for (const byte of bytes) {
		value = (value << BITS_PER_BYTE) | byte;
		bits += BITS_PER_BYTE;
		while (bits >= BASE32_BITS_PER_CHAR) {
			output += BASE32_ALPHABET.charAt((value >>> (bits - BASE32_BITS_PER_CHAR)) & (BASE32_ALPHABET.length - 1));
			bits -= BASE32_BITS_PER_CHAR;
		}
	}
	if (bits > 0) {
		output += BASE32_ALPHABET.charAt((value << (BASE32_BITS_PER_CHAR - bits)) & (BASE32_ALPHABET.length - 1));
	}
	return output;
}

/**
 * Seeds the account-security cast. Collaborators are the app's own services,
 * constructed from the validated API config, so every secret is produced the
 * way production produces it.
 */
export class AccountSecuritySeeder {
	private readonly crypto: CryptoService;
	private readonly secrets: SecretEncryptionService;

	public constructor(private readonly cast: AccountSecurityCast) {
		const config = new TypedConfigService(getApiConfig());
		this.crypto = new CryptoService(config);
		this.secrets = new SecretEncryptionService(config);
	}

	public async seed(): Promise<AccountSecuritySeedSummary> {
		const now: number = Date.now();
		const impersonation = await this.seedRecoveryUnderImpersonation(now);
		const mfa = await this.seedEnrolledMfaUser(now);
		await this.seedEnrollingUser(now);
		await this.seedLockedUser(now);
		const passwordHistoryRows: number = await this.seedPasswordHistory();
		const supportAccessGrants: number = await this.seedSupportAccess(now);
		return {
			impersonationSessions: impersonation,
			mfaRecoveryRequests: 1,
			backupCodes: BACKUP_CODE_COUNT * 2,
			loginChallenges: 2,
			pendingSetups: 1,
			passwordHistoryRows,
			supportAccessGrants,
			mfaUserTotpSecret: mfa.totpSecret,
			mfaUserUnusedBackupCode: mfa.unusedBackupCode,
		};
	}

	private id(key: string): string {
		return deterministicUuid(this.cast.namespace, key);
	}

	/** Deterministic secret material for `purpose` — stable across re-seeds of the same cast. */
	private material(purpose: string): Buffer {
		return createHash("sha256").update(`${this.cast.namespace}:${purpose}`).digest();
	}

	private totpSecret(user: User): string {
		return toBase32(this.material(`totp:${user.id}`).subarray(0, TOTP_SECRET_BYTES));
	}

	private backupCodes(user: User): string[] {
		const codes: string[] = [];
		for (let index = 0; index < BACKUP_CODE_COUNT; index += 1) {
			const bytes = this.material(`backup:${user.id}:${String(index)}`).subarray(0, BACKUP_CODE_LENGTH);
			codes.push([...bytes].map((byte: number) => BACKUP_CODE_CHARSET.charAt(byte % BACKUP_CODE_CHARSET.length)).join(""));
		}
		return codes;
	}

	/** Backup codes are only hashed when first seeded: re-seeding keeps the stored hashes. */
	private async upsertBackupCodes(
		user: User,
		key: string,
		state: { readonly createdAt: number; readonly usedCount: number; readonly deletedAt: number | null; readonly deletedBy: string | null },
	): Promise<string[]> {
		const codes = this.backupCodes(user);
		for (const [index, code] of codes.entries()) {
			const id = this.id(`${key}-${String(index)}`);
			const lifecycle = {
				usedAt: index < state.usedCount ? state.createdAt + (index + 1) * DAY_MS : null,
				isDeleted: state.deletedAt !== null,
				deletedAt: state.deletedAt,
				deletedBy: state.deletedBy,
			};
			const existing = await prisma.backupCode.findUnique({ where: { id }, select: { id: true } });
			if (existing === null) {
				await prisma.backupCode.create({ data: { id, userId: user.id, codeHash: await this.crypto.hash(code), createdAt: state.createdAt, ...lifecycle } });
			} else {
				await prisma.backupCode.update({ where: { id }, data: lifecycle });
			}
		}
		return codes;
	}

	/**
	 * The user lost their phone and called support: the SuperAdmin impersonated
	 * them to file the MFA recovery (requester of record = the user, the
	 * impersonator recorded on the audit row), stopped impersonating, approved
	 * the request a day later, and the scheduled unlock completed it.
	 */
	private async seedRecoveryUnderImpersonation(now: number): Promise<number> {
		const { superAdmin, recoveredUser } = this.cast;
		const sessionId = this.id("impersonation-session-1");
		const requestId = this.id("mfa-recovery-request-1");
		const startedAt = now - 10 * DAY_MS;
		const requestedAt = startedAt + 2 * MINUTE_MS;
		const endedAt = startedAt + IMPERSONATION_DURATION_MS;
		const reviewedAt = now - 9 * DAY_MS;
		const completedAt = reviewedAt + MFA_RECOVERY_DELAY_MS;

		const session: Omit<Prisma.ImpersonationSessionUncheckedCreateInput, "id"> = {
			impersonatorId: superAdmin.id,
			targetUserId: recoveredUser.id,
			startedAt,
			expiresAt: startedAt + IMPERSONATION_TTL_MS,
			endedAt,
			endedBy: superAdmin.id,
			endReason: "STOPPED",
			ipAddress: SUPPORT_IP,
			userAgent: SUPPORT_USER_AGENT,
			createdAt: startedAt,
			updatedAt: endedAt,
		};
		await prisma.impersonationSession.upsert({ where: { id: sessionId }, create: { id: sessionId, ...session }, update: session });

		const impersonationAudit = (key: string, action: string, at: number): WithId<Prisma.ImpersonationAuditLogUncheckedCreateInput> => ({
			id: this.id(key),
			impersonatorId: superAdmin.id,
			targetUserId: recoveredUser.id,
			sessionId,
			action,
			ipAddress: SUPPORT_IP,
			userAgent: SUPPORT_USER_AGENT,
			createdAt: at,
		});
		for (const row of [
			impersonationAudit("impersonation-audit-start", ImpersonationAuditAction.START, startedAt),
			impersonationAudit("impersonation-audit-stop", ImpersonationAuditAction.STOP, endedAt),
		]) {
			await prisma.impersonationAuditLog.upsert({ where: { id: row.id }, create: row, update: row });
		}

		// The recovered account's codes: issued at enrollment, soft-deleted by the completed recovery.
		await this.upsertBackupCodes(recoveredUser, "recovered-backup-code", {
			createdAt: now - 90 * DAY_MS,
			usedCount: 1,
			deletedAt: completedAt,
			deletedBy: superAdmin.id,
		});

		const request: Omit<Prisma.MfaRecoveryRequestUncheckedCreateInput, "id"> = {
			userId: recoveredUser.id,
			status: "COMPLETED",
			requestedAt,
			reviewedBy: superAdmin.id,
			reviewedAt,
			scheduledUnlockAt: completedAt,
			completedAt,
			notes: "Lost authenticator device; identity verified by video call against government ID.",
			createdAt: requestedAt,
			updatedAt: completedAt,
		};
		await prisma.mfaRecoveryRequest.upsert({ where: { id: requestId }, create: { id: requestId, ...request }, update: request });

		const recoveryAudit = (
			key: string,
			action: string,
			actorUserId: string,
			transition: { readonly from: MfaRecoveryRequestStatus | null; readonly to: MfaRecoveryRequestStatus },
			at: number,
			client: { readonly ip: string; readonly userAgent: string; readonly impersonatorId: string | null } | null,
		): WithId<Prisma.MfaRecoveryAuditLogUncheckedCreateInput> => ({
			id: this.id(key),
			requestId,
			subjectUserId: recoveredUser.id,
			actorUserId,
			action,
			fromStatus: transition.from,
			toStatus: transition.to,
			// HTTP-driven transitions carry the request's correlation id and client; the scheduled unlock runs outside a request.
			correlationId: client === null ? null : this.id(`${key}:correlation`).replaceAll("-", "").slice(0, 21),
			impersonatorId: client?.impersonatorId ?? null,
			ipAddress: client?.ip ?? null,
			userAgent: client?.userAgent ?? null,
			createdAt: at,
		});
		const auditRows: WithId<Prisma.MfaRecoveryAuditLogUncheckedCreateInput>[] = [
			// Filed while impersonating: actor = the user (sub), impersonator = the SuperAdmin.
			recoveryAudit("mfa-audit-requested", MfaRecoveryAuditAction.REQUESTED, recoveredUser.id, { from: null, to: "PENDING" }, requestedAt, {
				ip: SUPPORT_IP,
				userAgent: SUPPORT_USER_AGENT,
				impersonatorId: superAdmin.id,
			}),
			recoveryAudit("mfa-audit-approved", MfaRecoveryAuditAction.APPROVED, superAdmin.id, { from: "PENDING", to: "APPROVED" }, reviewedAt, {
				ip: SUPPORT_IP,
				userAgent: SUPPORT_USER_AGENT,
				impersonatorId: null,
			}),
			recoveryAudit("mfa-audit-completed", MfaRecoveryAuditAction.COMPLETED, superAdmin.id, { from: "APPROVED", to: "COMPLETED" }, completedAt, null),
		];
		for (const row of auditRows) {
			await prisma.mfaRecoveryAuditLog.upsert({ where: { id: row.id }, create: row, update: row });
		}
		return 1;
	}

	/** A fully enrolled user: encrypted TOTP secret, backup codes (some used), login challenges, sessions. */
	private async seedEnrolledMfaUser(now: number): Promise<{ readonly totpSecret: string; readonly unusedBackupCode: string }> {
		const { mfaUser } = this.cast;
		const totpSecret = this.totpSecret(mfaUser);
		const enrolledAt = now - 60 * DAY_MS;
		const lastLoginAt = now - 2 * HOUR_MS;

		const current = await prisma.user.findUniqueOrThrow({ where: { id: mfaUser.id }, select: { twoFactorEnabled: true } });
		if (!current.twoFactorEnabled) {
			const encrypted = this.secrets.encrypt(totpSecret, "totp-secret");
			await prisma.user.update({
				where: { id: mfaUser.id },
				data: {
					twoFactorEnabled: true,
					twoFactorSecretCiphertext: encrypted.ciphertext,
					twoFactorSecretIv: encrypted.iv,
					twoFactorSecretKeyVersion: encrypted.keyVersion,
				},
			});
		}
		await prisma.user.update({
			where: { id: mfaUser.id },
			data: {
				twoFactorLastTotpStep: BigInt(Math.floor(lastLoginAt / SECOND_MS / TOTP_PERIOD_SECONDS)),
				mfaEnrolledAt: enrolledAt,
				mfaAssuredAt: lastLoginAt,
				lastLoginAt,
			},
		});

		const codes = await this.upsertBackupCodes(mfaUser, "mfa-user-backup-code", {
			createdAt: enrolledAt,
			usedCount: USED_BACKUP_CODE_COUNT,
			deletedAt: null,
			deletedBy: null,
		});

		// A consumed login challenge (yesterday's sign-in) and a live one (sign-in in progress).
		const challenges: WithId<Prisma.TwoFactorLoginChallengeUncheckedCreateInput>[] = [
			{
				id: this.id("login-challenge-consumed"),
				userId: mfaUser.id,
				purpose: "LOGIN",
				clientType: "web",
				deviceInfo: "Safari on iOS",
				ipAddress: USER_IP,
				attemptCount: 1,
				consumedAt: lastLoginAt,
				expiresAt: lastLoginAt - MINUTE_MS + LOGIN_CHALLENGE_TTL_MS,
				createdAt: lastLoginAt - MINUTE_MS,
			},
			{
				id: this.id("login-challenge-live"),
				userId: mfaUser.id,
				purpose: "LOGIN",
				clientType: "web",
				deviceInfo: "Chrome on Windows",
				ipAddress: USER_IP,
				attemptCount: 0,
				consumedAt: null,
				expiresAt: now + LOGIN_CHALLENGE_TTL_MS,
				createdAt: now,
			},
		];
		for (const challenge of challenges) {
			await prisma.twoFactorLoginChallenge.upsert({ where: { id: challenge.id }, create: challenge, update: challenge });
		}

		await this.seedRotatedSessions(now);
		const unusedBackupCode: string = requireRow(codes.at(USED_BACKUP_CODE_COUNT), "first unused backup code");
		return { totpSecret, unusedBackupCode };
	}

	/** A session rotated three times (previous token hash kept for the grace window) and a revoked one. */
	private async seedRotatedSessions(now: number): Promise<void> {
		const { mfaUser } = this.cast;
		const rotatedId = this.id("refresh-rotated");
		if ((await prisma.refreshToken.findUnique({ where: { id: rotatedId }, select: { id: true } })) === null) {
			const [currentHash, previousHash, revokedHash] = await Promise.all([
				this.crypto.hash(this.material("refresh:current").toString("hex")),
				this.crypto.hash(this.material("refresh:previous").toString("hex")),
				this.crypto.hash(this.material("refresh:revoked").toString("hex")),
			]);
			await prisma.refreshToken.create({
				data: {
					id: rotatedId,
					userId: mfaUser.id,
					token: currentHash,
					previousTokenHash: previousHash,
					rotationVersion: 3,
					deviceInfo: "Safari on iOS",
					ipAddress: USER_IP,
					expiresAt: now + 7 * DAY_MS,
					createdAt: now - 3 * DAY_MS,
					updatedAt: now - 2 * HOUR_MS,
				},
			});
			await prisma.refreshToken.create({
				data: {
					id: this.id("refresh-revoked"),
					userId: mfaUser.id,
					token: revokedHash,
					deviceInfo: "Firefox on Linux",
					ipAddress: USER_IP,
					expiresAt: now + 5 * DAY_MS,
					isDeleted: true,
					deletedAt: now - DAY_MS,
					createdAt: now - 2 * DAY_MS,
					updatedAt: now - DAY_MS,
				},
			});
		}
	}

	/** A user who scanned the QR code but has not confirmed the first TOTP yet. */
	private async seedEnrollingUser(now: number): Promise<void> {
		const { enrollingUser } = this.cast;
		const existing = await prisma.twoFactorPendingSetup.findUnique({ where: { userId: enrollingUser.id }, select: { id: true } });
		if (existing === null) {
			const encrypted = this.secrets.encrypt(this.totpSecret(enrollingUser), "totp-pending");
			const hashes: string[] = await Promise.all(this.backupCodes(enrollingUser).map((code: string) => this.crypto.hash(code)));
			await prisma.twoFactorPendingSetup.create({
				data: {
					id: this.id("pending-setup"),
					userId: enrollingUser.id,
					secretCiphertext: encrypted.ciphertext,
					secretIv: encrypted.iv,
					secretKeyVersion: encrypted.keyVersion,
					backupCodesHashes: hashes,
					expiresAt: now + PENDING_SETUP_TTL_MS,
					createdAt: now,
				},
			});
		} else {
			await prisma.twoFactorPendingSetup.update({ where: { userId: enrollingUser.id }, data: { expiresAt: now + PENDING_SETUP_TTL_MS } });
		}
		await prisma.user.update({ where: { id: enrollingUser.id }, data: { lastLoginAt: now - 5 * MINUTE_MS } });
	}

	/** Five wrong passwords in a row: locked for the lockout window. */
	private async seedLockedUser(now: number): Promise<void> {
		await prisma.user.update({
			where: { id: this.cast.lockedUser.id },
			data: { failedLoginAttempts: MAX_FAILED_LOGIN_ATTEMPTS, lockedUntil: now + LOCK_DURATION_MS, lastLoginAt: now - 6 * DAY_MS },
		});
	}

	/** Two earlier passwords per cast user, then the current one — as change/reset write them. */
	private async seedPasswordHistory(): Promise<number> {
		const users: User[] = [this.cast.mfaUser, this.cast.lockedUser, this.cast.recoveredUser];
		let rows = 0;
		for (const user of users) {
			const entries: { readonly key: string; readonly createdAt: number; readonly hash: () => Promise<string> }[] = [
				{ key: "oldest", createdAt: daysAgo(400), hash: async () => this.crypto.hash(this.material(`password:${user.id}:oldest`).toString("base64")) },
				{ key: "previous", createdAt: daysAgo(180), hash: async () => this.crypto.hash(this.material(`password:${user.id}:previous`).toString("base64")) },
				{ key: "current", createdAt: daysAgo(30), hash: async () => Promise.resolve(user.passwordHash) },
			];
			for (const entry of entries) {
				const id = this.id(`password-history:${user.id}:${entry.key}`);
				if ((await prisma.passwordHistory.findUnique({ where: { id }, select: { id: true } })) === null) {
					await prisma.passwordHistory.create({ data: { id, userId: user.id, passwordHash: await entry.hash(), createdAt: entry.createdAt } });
				}
				rows += 1;
			}
		}
		return rows;
	}

	/** One grant per lifecycle state, each transition with its organization audit row (real actor + active policy version). */
	private async seedSupportAccess(now: number): Promise<number> {
		const { superAdmin, supportAccess } = this.cast;
		const policyVersion: number = await findActivePolicyVersionInTx(prisma, supportAccess.organizationId);
		const grants: {
			readonly key: string;
			readonly status: SupportAccessGrantStatus;
			readonly requestedAt: number;
			readonly approved: boolean;
			readonly revokedAt: number | null;
			readonly mode: "READ_ONLY" | "WRITE_ELEVATED";
		}[] = [
			{ key: "active", status: "ACTIVE", requestedAt: now - 30 * MINUTE_MS, approved: true, revokedAt: null, mode: "READ_ONLY" },
			{ key: "pending", status: "PENDING_TENANT_APPROVAL", requestedAt: now - 5 * MINUTE_MS, approved: false, revokedAt: null, mode: "READ_ONLY" },
			{ key: "revoked", status: "REVOKED", requestedAt: now - 3 * DAY_MS, approved: true, revokedAt: now - 3 * DAY_MS + HOUR_MS, mode: "WRITE_ELEVATED" },
			{ key: "expired", status: "EXPIRED", requestedAt: now - 20 * DAY_MS, approved: true, revokedAt: null, mode: "READ_ONLY" },
		];
		for (const grant of grants) {
			const id = this.id(`support-grant:${grant.key}`);
			const data: Omit<Prisma.SupportAccessGrantUncheckedCreateInput, "id"> = {
				organizationId: supportAccess.organizationId,
				supportUserId: superAdmin.id,
				mode: grant.mode,
				status: grant.status,
				reason: `Customer ticket: investigating ${grant.key === "revoked" ? "a disputed refund" : "missing reward redemptions"}`,
				ticketRef: `SUP-${String(4500 + grants.indexOf(grant))}`,
				tenantApprovedById: grant.approved ? supportAccess.owner.id : null,
				expiresAt: grant.requestedAt + SUPPORT_GRANT_DURATION_MS,
				revokedAt: grant.revokedAt,
				createdAt: grant.requestedAt,
			};
			await prisma.supportAccessGrant.upsert({ where: { id }, create: { id, ...data }, update: data });

			const audits: WithId<Prisma.OrganizationAuditLogUncheckedCreateInput>[] = [
				this.supportAudit(id, "requested", superAdmin.id, policyVersion, grant.requestedAt, { mode: grant.mode }),
			];
			if (grant.approved) {
				audits.push(this.supportAudit(id, "approved", supportAccess.owner.id, policyVersion, grant.requestedAt + 2 * MINUTE_MS, null));
			}
			if (grant.revokedAt !== null) {
				audits.push(this.supportAudit(id, "revoked", superAdmin.id, policyVersion, grant.revokedAt, null));
			}
			for (const audit of audits) {
				await prisma.organizationAuditLog.upsert({ where: { id: audit.id }, create: audit, update: audit });
			}
		}
		return grants.length;
	}

	private supportAudit(
		grantId: string,
		transition: "requested" | "approved" | "revoked",
		actorUserId: string,
		policyVersion: number,
		at: number,
		metadata: Prisma.InputJsonObject | null,
	): WithId<Prisma.OrganizationAuditLogUncheckedCreateInput> {
		const id = this.id(`support-audit:${grantId}:${transition}`);
		return {
			id,
			organizationId: this.cast.supportAccess.organizationId,
			actorUserId,
			action: `support.grant_${transition}`,
			resourceType: "SupportAccessGrant",
			resourceId: grantId,
			decision: transition === "approved" ? "Allow" : null,
			policyVersion,
			correlationId: id.replaceAll("-", "").slice(0, 21),
			...(metadata === null ? {} : { metadata }),
			createdAt: at,
		};
	}
}

/** The cast by e-mail, as a scenario declares it (resolved against the seeded users). */
export interface AccountSecurityCastEmails {
	readonly namespace: string;
	readonly superAdmin: string;
	readonly recoveredUser: string;
	readonly mfaUser: string;
	readonly enrollingUser: string;
	readonly lockedUser: string;
	readonly supportAccess: { readonly organizationId: string; readonly ownerEmail: string };
}

/** Resolves the cast's users, seeds everything and logs the developer credentials. */
export async function seedAccountSecurity(emails: AccountSecurityCastEmails, log: (line: string) => void): Promise<AccountSecuritySeedSummary> {
	const user = async (email: string): Promise<User> => prisma.user.findUniqueOrThrow({ where: { email } });
	const summary = await new AccountSecuritySeeder({
		namespace: emails.namespace,
		superAdmin: await user(emails.superAdmin),
		recoveredUser: await user(emails.recoveredUser),
		mfaUser: await user(emails.mfaUser),
		enrollingUser: await user(emails.enrollingUser),
		lockedUser: await user(emails.lockedUser),
		supportAccess: { organizationId: emails.supportAccess.organizationId, owner: await user(emails.supportAccess.ownerEmail) },
	}).seed();
	log(
		`✅ Account security: ${String(summary.impersonationSessions)} impersonation session, ${String(summary.mfaRecoveryRequests)} completed MFA recovery, ${String(summary.backupCodes)} backup codes, ${String(summary.loginChallenges)} login challenges, ${String(summary.pendingSetups)} pending 2FA setup, ${String(summary.passwordHistoryRows)} password-history rows, ${String(summary.supportAccessGrants)} support-access grants`,
	);
	log(`   MFA demo user ${emails.mfaUser}: TOTP secret ${summary.mfaUserTotpSecret} · unused backup code ${summary.mfaUserUnusedBackupCode}`);
	log(`   Locked demo user ${emails.lockedUser} (15 min) · mid-enrollment demo user ${emails.enrollingUser}`);
	return summary;
}
