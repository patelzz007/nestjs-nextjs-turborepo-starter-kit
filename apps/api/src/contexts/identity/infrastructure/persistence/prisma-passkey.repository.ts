import type { Prisma } from "@prisma/client";
import { epochMs, PasskeyDeviceTypeSchema, PasskeyTransportSchema, type EpochMs, type PasskeyTransport } from "@workspace/shared";
import { z } from "zod";

import { isUniqueViolationOf } from "../../../../platform/infrastructure/persistence/unique-violation";
import { Passkey, type PasskeyChange } from "../../domain/aggregates/passkey.aggregate";
import { WebAuthnChallenge, type WebAuthnChallengePurpose } from "../../domain/aggregates/web-authn-challenge.aggregate";
import { PasskeyAlreadyRegisteredError, PasskeyChallengeInvalidError, PasskeyNotFoundError, PasskeyVerificationFailedError } from "../../domain/errors/identity.errors";
import type { PasskeyRepository, WebAuthnChallengeRepository } from "../../domain/repositories/passkey.repository";
import { epochOrNull } from "./identity-row.mappers";

/** The unique index Postgres names for `WebAuthnCredential.credentialId`. */
const CREDENTIAL_ID_UNIQUE_INDEX = "WebAuthnCredential_credentialId_key";

/** Stored transports are written from the validated enum only; a stored value outside it is corrupt. */
const StoredTransportsSchema = z.array(PasskeyTransportSchema);

const PASSKEY_SELECT = {
	id: true,
	userId: true,
	credentialId: true,
	publicKey: true,
	counter: true,
	transports: true,
	deviceType: true,
	backedUp: true,
	aaguid: true,
	name: true,
	createdAt: true,
	lastUsedAt: true,
} satisfies Prisma.WebAuthnCredentialSelect;

type PasskeyRow = Prisma.WebAuthnCredentialGetPayload<{ select: typeof PASSKEY_SELECT }>;

function toPasskey(row: PasskeyRow): Passkey {
	const transports: PasskeyTransport[] = StoredTransportsSchema.parse(row.transports);
	return Passkey.rehydrate({
		...row,
		counter: Number(row.counter),
		transports,
		deviceType: PasskeyDeviceTypeSchema.parse(row.deviceType),
		createdAt: epochMs(Number(row.createdAt)),
		lastUsedAt: epochOrNull(row.lastUsedAt),
	});
}

/** Soft-deletes the account's live passkeys, attributed to `actorId` (a completed MFA recovery, ADR 080). */
export async function retirePasskeys(db: Prisma.TransactionClient, userId: string, actorId: string, at: EpochMs): Promise<void> {
	await db.webAuthnCredential.updateMany({ where: { userId, isDeleted: false }, data: { isDeleted: true, deletedAt: at, deletedBy: actorId, updatedAt: at } });
}

export class PrismaPasskeyRepository implements PasskeyRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async listLive(userId: string): Promise<readonly Passkey[]> {
		const rows = await this.db.webAuthnCredential.findMany({ where: { userId, isDeleted: false }, select: PASSKEY_SELECT, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
		return rows.map(toPasskey);
	}

	public countLive(userId: string): Promise<number> {
		return this.db.webAuthnCredential.count({ where: { userId, isDeleted: false } });
	}

	public async findLiveById(id: string): Promise<Passkey | null> {
		const row = await this.db.webAuthnCredential.findFirst({ where: { id, isDeleted: false }, select: PASSKEY_SELECT });
		return row === null ? null : toPasskey(row);
	}

	public async findLiveByCredentialId(credentialId: string): Promise<Passkey | null> {
		const row = await this.db.webAuthnCredential.findFirst({ where: { credentialId, isDeleted: false }, select: PASSKEY_SELECT });
		return row === null ? null : toPasskey(row);
	}

	public async add(passkey: Passkey): Promise<void> {
		const state = passkey.snapshot;
		try {
			await this.db.webAuthnCredential.create({
				data: {
					id: state.id,
					userId: state.userId,
					credentialId: state.credentialId,
					publicKey: state.publicKey,
					counter: BigInt(state.counter),
					transports: [...state.transports],
					deviceType: state.deviceType,
					backedUp: state.backedUp,
					aaguid: state.aaguid,
					name: state.name,
					createdAt: state.createdAt,
					updatedAt: state.createdAt,
				},
			});
		} catch (error) {
			if (error instanceof Error && isUniqueViolationOf(error, CREDENTIAL_ID_UNIQUE_INDEX)) {
				throw new PasskeyAlreadyRegisteredError();
			}
			throw error;
		}
	}

	public async save(passkey: Passkey): Promise<void> {
		for (const change of passkey.pendingChanges) {
			await this.apply(passkey.id, change);
		}
	}

	private async apply(id: string, change: PasskeyChange): Promise<void> {
		switch (change.kind) {
			case "renamed": {
				const written = await this.db.webAuthnCredential.updateMany({ where: { id, isDeleted: false }, data: { name: change.name, updatedAt: change.at } });
				if (written.count !== 1) {
					throw new PasskeyNotFoundError();
				}
				return;
			}
			case "used": {
				// The counter only moves forward: a concurrent use of the same counter value loses here.
				const written = await this.db.webAuthnCredential.updateMany({
					where: { id, isDeleted: false, counter: BigInt(change.previousCounter) },
					data: { counter: BigInt(change.counter), backedUp: change.backedUp, lastUsedAt: change.at, updatedAt: change.at },
				});
				if (written.count !== 1) {
					throw new PasskeyVerificationFailedError();
				}
				return;
			}
			case "removed": {
				const written = await this.db.webAuthnCredential.updateMany({
					where: { id, isDeleted: false },
					data: { isDeleted: true, deletedAt: change.at, deletedBy: change.by, updatedAt: change.at },
				});
				if (written.count !== 1) {
					throw new PasskeyNotFoundError();
				}
				return;
			}
		}
	}
}

const CHALLENGE_SELECT = {
	id: true,
	userId: true,
	purpose: true,
	challengeHash: true,
	loginChallengeId: true,
	expiresAt: true,
	consumedAt: true,
} satisfies Prisma.WebAuthnChallengeSelect;

export class PrismaWebAuthnChallengeRepository implements WebAuthnChallengeRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async add(challenge: WebAuthnChallenge): Promise<void> {
		const state = challenge.snapshot;
		await this.db.webAuthnChallenge.create({
			data: {
				id: state.id,
				userId: state.userId,
				purpose: state.purpose,
				challengeHash: state.challengeHash,
				loginChallengeId: state.loginChallengeId,
				expiresAt: state.expiresAt,
			},
		});
	}

	public async findById(id: string): Promise<WebAuthnChallenge | null> {
		const row = await this.db.webAuthnChallenge.findFirst({ where: { id, isDeleted: false }, select: CHALLENGE_SELECT });
		if (row === null) {
			return null;
		}
		const purpose: WebAuthnChallengePurpose = row.purpose;
		return WebAuthnChallenge.rehydrate({ ...row, purpose, expiresAt: epochMs(Number(row.expiresAt)), consumedAt: epochOrNull(row.consumedAt) });
	}

	public async saveConsumed(challenge: WebAuthnChallenge): Promise<void> {
		const consumedAt: EpochMs | null = challenge.snapshot.consumedAt;
		if (!challenge.wasConsumed || consumedAt === null) {
			return;
		}
		const written = await this.db.webAuthnChallenge.updateMany({
			where: { id: challenge.id, consumedAt: null, isDeleted: false },
			data: { consumedAt, updatedAt: consumedAt },
		});
		if (written.count !== 1) {
			throw new PasskeyChallengeInvalidError();
		}
	}

	public async retireExpired(now: EpochMs, retentionMs: number): Promise<number> {
		// Soft delete (never DELETE): a retired challenge keeps its row for the sign-in trail.
		const result = await this.db.webAuthnChallenge.updateMany({
			where: { isDeleted: false, expiresAt: { lte: now - retentionMs } },
			data: { isDeleted: true, deletedAt: now, updatedAt: now },
		});
		return result.count;
	}
}
