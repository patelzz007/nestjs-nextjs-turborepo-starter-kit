import type { Prisma } from "@prisma/client";
import { epochMs } from "@workspace/shared";

import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import {
	ACCOUNT_ERASE_OPERATION,
	ACCOUNT_ERASURE_REQUEST_OPERATION,
	type ErasureAccountGateway,
	type ErasureBlocker,
	type ErasureSubject,
	type PersonalDataEraser,
} from "../../../../platform/application/personal-data/personal-data-erasure.registry";
import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import type { IdentityScope } from "../../application/identity-scope";
import type { CredentialCryptoPort } from "../../application/ports/credential-crypto.port";
import { DeviceSessionsRevoked } from "../../domain/events/identity.events";
import { revokedBySystem, revokedByUser, type SessionRevoker } from "../../domain/value-objects/session-revoker.value-object";

const REQUEST_OPERATION = ACCOUNT_ERASURE_REQUEST_OPERATION;
const ERASE_OPERATION = ACCOUNT_ERASE_OPERATION;

/** The transaction method identity's erasure pieces need. */
export interface IdentityErasureTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, handler: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/** The tombstone's email: unique per account, under `.invalid`, a top-level domain that can never receive mail (RFC 2606). */
export function tombstoneEmailOf(userId: string): string {
	return `erased+${userId}@erased.invalid`;
}

function revokerOf(actor: ActorContext): SessionRevoker {
	const userId = actingUserId(actor);
	return userId === null ? revokedBySystem("system:account-erasure") : revokedByUser(userId);
}

/** What erasure needs from the account (ADR 077): identity's own rules, through its unit of work. */
export class IdentityErasureGateway implements ErasureAccountGateway {
	public constructor(
		private readonly transactions: IdentityErasureTransactions,
		private readonly uow: UnitOfWork<IdentityScope>,
		private readonly crypto: CredentialCryptoPort,
		private readonly clock: Clock,
	) {}

	public async confirmPassword(userId: string, password: string): Promise<boolean> {
		const row = await this.transactions.withSystemOperation({ operation: REQUEST_OPERATION, reason: "Erasure: confirm the account's password", actorUserId: userId }, (tx) =>
			tx.user.findFirst({ where: { id: userId, isDeleted: false, erasedAt: null }, select: { passwordHash: true } }),
		);
		return row !== null && (await this.crypto.compare(password, row.passwordHash));
	}

	public async emailOf(userId: string): Promise<string | null> {
		const row = await this.transactions.withSystemOperation({ operation: ERASE_OPERATION, reason: "Erasure: read the account's email", actorUserId: null }, (tx) =>
			tx.user.findFirst({ where: { id: userId, isDeleted: false, erasedAt: null }, select: { email: true } }),
		);
		return row?.email ?? null;
	}

	public async endSessions(userId: string, actor: ActorContext): Promise<void> {
		await this.uow.runSystemOperation(REQUEST_OPERATION, actor, async (scope: IdentityScope): Promise<void> => {
			const now = this.clock.now();
			await scope.sessions.revokeAllOf([userId], revokerOf(actor), now, null);
			scope.events.collect(new DeviceSessionsRevoked([userId], "account_erasure", now));
		});
	}

	public async tombstone(userId: string, erasedAt: number, actor: ActorContext): Promise<void> {
		const unusablePasswordHash = await this.crypto.hash(this.crypto.generateRandomToken());
		await this.uow.runSystemOperation(ERASE_OPERATION, actor, async (scope: IdentityScope): Promise<void> => {
			const account = await scope.accounts.lockById(userId);
			if (account === null) {
				return;
			}
			const at = epochMs(erasedAt);
			account.eraseAsTombstone(tombstoneEmailOf(userId), unusablePasswordHash, at);
			await scope.accounts.save(account);
			await scope.sessions.revokeAllOf([userId], revokerOf(actor), at, null);
			scope.events.collectFrom(account);
			scope.events.collect(new DeviceSessionsRevoked([userId], "account_erasure", at));
		});
	}
}

/** Identity's own rows about the person (ERASE in `prisma/personal-data.ts`). */
export class IdentityPersonalDataEraser implements PersonalDataEraser {
	public readonly section = "account";

	public constructor(private readonly transactions: IdentityErasureTransactions) {}

	public erase({ userId, actor }: ErasureSubject): Promise<number> {
		return this.transactions.withSystemOperation(
			{ operation: ERASE_OPERATION, reason: "Erasure: remove the account's sign-in artefacts and settings", actorUserId: actingUserId(actor) },
			async (tx) => {
				const changed = await Promise.all([
					tx.passwordResetToken.deleteMany({ where: { userId } }),
					tx.passwordHistory.deleteMany({ where: { userId } }),
					tx.backupCode.deleteMany({ where: { userId } }),
					tx.twoFactorPendingSetup.deleteMany({ where: { userId } }),
					tx.webAuthnChallenge.deleteMany({ where: { userId } }),
					tx.twoFactorLoginChallenge.deleteMany({ where: { userId } }),
					tx.webAuthnCredential.deleteMany({ where: { userId } }),
					tx.userAvatar.deleteMany({ where: { userId } }),
					tx.refreshToken.updateMany({
						where: { userId },
						data: {
							isDeleted: true,
							browserName: null,
							browserVersion: null,
							osName: null,
							osVersion: null,
							deviceModel: null,
							deviceName: null,
							ipAddress: null,
							lastIpAddress: null,
							locationCountry: null,
							locationRegion: null,
							locationCity: null,
						},
					}),
					// Never deleted (soft delete only): its value is emptied instead.
					tx.userPreference.updateMany({ where: { userId }, data: { isDeleted: true, value: {} } }),
				]);
				return changed.reduce((total, result) => total + result.count, 0);
			},
		);
	}
}

/** An open MFA recovery request blocks erasure until it is decided (ADR 077). */
export class OpenMfaRecoveryBlocker implements ErasureBlocker {
	public readonly name = "mfa-recovery";

	public constructor(private readonly transactions: IdentityErasureTransactions) {}

	public async blockers(userId: string): Promise<readonly string[]> {
		const open = await this.transactions.withSystemOperation(
			{ operation: REQUEST_OPERATION, reason: "Erasure: check for an open MFA recovery request", actorUserId: null },
			(tx) => tx.mfaRecoveryRequest.count({ where: { userId, isDeleted: false, status: { in: ["PENDING", "APPROVED"] } } }),
		);
		return open > 0 ? ["An account recovery request is still open. It must be completed or withdrawn first."] : [];
	}
}
