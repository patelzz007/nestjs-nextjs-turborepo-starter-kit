import type { Prisma } from "@prisma/client";
import { epochMs, nowEpochMs, type EpochMs } from "@workspace/shared";

import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { AccountProfile, CreatedAccount, NewAccount, TransactionalAccountProvisioningPort } from "../../../../platform/application/ports/account-provisioning.port";
import type { IdentitySessionsPort, SessionRevocationActor } from "../../../../platform/application/ports/identity-sessions.port";
import { createAuthorizationTransactionalPorts } from "../../../authorization/public-api";
import { createReferralsTransactionalPorts } from "../../../referrals/public-api";
import type { ConsumerClaimant, ConsumerClaimantPort } from "../../application/ports/consumer-claimant.port";
import { UserAccount } from "../../domain/aggregates/user-account.aggregate";
import { DeviceSessionsRevoked } from "../../domain/events/identity.events";
import { EmailAddress } from "../../domain/value-objects/email-address.value-object";
import { revokedBySystem, revokedByUser } from "../../domain/value-objects/session-revoker.value-object";
import { PrismaDeviceSessionRepository } from "./prisma-device-session.repository";
import { PrismaUserAccountRepository } from "./prisma-user-account.repository";

/** Identity's ports bound to ANOTHER context's transaction (§5.4 cross-context scopes). */
export interface IdentityTransactionalPorts {
	readonly sessions: IdentitySessionsPort;
	readonly accounts: TransactionalAccountProvisioningPort;
	readonly consumerClaimants: ConsumerClaimantPort;
}

/** What the transactional ports need besides the caller's transaction. */
export interface IdentityTransactionalDependencies {
	readonly newId: () => string;
}

/**
 * Build identity's transactional ports on `db`, the caller's transaction (authorization's RBAC unit of
 * work, organizations' invite registration, claims' OTP-backed claim). New instances every call.
 * `events`, when given, receives `DeviceSessionsRevoked` so identity drops the revoked `sid`s on every
 * instance after the caller commits.
 */
export function createIdentityTransactionalPorts(
	db: Prisma.TransactionClient,
	dependencies: IdentityTransactionalDependencies,
	events: TransactionalEventCollector | null,
): IdentityTransactionalPorts {
	const accounts = new PrismaUserAccountRepository(db);
	const sessions = new PrismaDeviceSessionRepository(db);
	return {
		sessions: {
			async revokeAllSessions(userIds: readonly string[], revokedBy: SessionRevocationActor): Promise<void> {
				const unique: string[] = [...new Set<string>(userIds)];
				if (unique.length === 0) {
					return;
				}
				const now: EpochMs = nowEpochMs();
				await sessions.revokeAllOf(unique, revokedBy.kind === "user" ? revokedByUser(revokedBy.userId) : revokedBySystem(revokedBy.marker), now, null);
				await accounts.bumpTokenVersions(unique, now);
				events?.collect(new DeviceSessionsRevoked(unique, "rbac_mutation", now));
			},
		},
		accounts: {
			async findAccountIdByEmail(email: string): Promise<string | null> {
				return (await accounts.findByEmail(EmailAddress.of(email)))?.id ?? null;
			},
			async createAccount(account: NewAccount): Promise<CreatedAccount> {
				const now: EpochMs = nowEpochMs();
				const created: UserAccount = UserAccount.register(
					{
						id: dependencies.newId(),
						email: EmailAddress.of(account.email),
						fullName: account.fullName,
						passwordHash: account.passwordHash,
						isSuperAdmin: false,
						emailVerifiedAt: null,
						mfaEnrollmentDeadline: null,
					},
					now,
				);
				// `ON CONFLICT DO NOTHING`: a taken address (also by a concurrent registration) answers
				// `email_taken` without aborting the caller's transaction.
				if (!(await accounts.addIfEmailFree(created))) {
					return { kind: "email_taken" };
				}
				await createReferralsTransactionalPorts(db).signupReferrals.issueFirstCode(created.id, now);
				await createAuthorizationTransactionalPorts(db).defaultRoleAssignment.assignDefaultRole(created.id);
				return { kind: "created", userId: created.id };
			},
			async listProfiles(userIds: readonly string[]): Promise<readonly AccountProfile[]> {
				const rows = await db.user.findMany({ where: { id: { in: [...userIds] }, isDeleted: false }, select: { id: true, email: true, fullName: true } });
				return rows.map((row): AccountProfile => ({ userId: row.id, email: row.email, fullName: row.fullName }));
			},
		},
		consumerClaimants: {
			async findClaimant(userId: string, options: { readonly lock: boolean }): Promise<ConsumerClaimant | null> {
				if (options.lock) {
					await db.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
				}
				const row = await db.user.findFirst({
					where: { id: userId, isDeleted: false },
					select: { email: true, phone: true, phoneVerifiedAt: true, pendingAttributionToken: true, pendingAttributionExpiresAt: true },
				});
				return row === null
					? null
					: {
							email: row.email,
							phone: row.phone,
							phoneVerifiedAt: row.phoneVerifiedAt === null ? null : epochMs(Number(row.phoneVerifiedAt)),
							pendingAttributionToken: row.pendingAttributionToken,
							pendingAttributionExpiresAt: row.pendingAttributionExpiresAt === null ? null : epochMs(Number(row.pendingAttributionExpiresAt)),
						};
			},
			async displayName(userId: string): Promise<string | null> {
				const row = await db.user.findUnique({ where: { id: userId }, select: { fullName: true } });
				return row?.fullName ?? null;
			},
			async markPhoneVerified(userId: string, phone: string, verifiedAt: EpochMs): Promise<void> {
				await db.user.update({ where: { id: userId }, data: { phone, phoneVerifiedAt: verifiedAt, pendingAttributionToken: null, pendingAttributionExpiresAt: null } });
			},
		},
	};
}
