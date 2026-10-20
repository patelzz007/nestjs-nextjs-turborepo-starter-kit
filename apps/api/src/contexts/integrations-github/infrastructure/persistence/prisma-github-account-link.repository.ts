import { GithubAccountLinkStatus, type GithubAccountLink, type Prisma } from "@prisma/client";
import { nowEpochMs } from "@workspace/shared";

import {
	GithubAccountLinkStatusSchema,
	type GithubAccountLinkInput,
	type GithubAccountLinkRecord,
	type GithubAccountLinkRepository,
} from "../../application/ports/github-account-link.port";

/** What an unlinked row keeps in place of the token: nothing that opens anything. */
const WIPED_CIPHERTEXT = "";

/** The `GithubAccountLink` delegate a repository reads and writes through. */
export type GithubAccountLinkDb = Pick<Prisma.TransactionClient, "githubAccountLink">;

/** A row as the application reads it (bigints → epoch numbers, the status enum validated). */
export function toGithubAccountLinkRecord(row: GithubAccountLink): GithubAccountLinkRecord {
	return {
		userId: row.userId,
		githubUserId: Number(row.githubUserId),
		githubLogin: row.githubLogin,
		token: { ciphertext: row.tokenCiphertext, keyVersion: row.tokenKeyVersion },
		tokenExpiresAt: row.tokenExpiresAt === null ? null : Number(row.tokenExpiresAt),
		status: GithubAccountLinkStatusSchema.parse(row.status),
		linkedAt: Number(row.linkedAt),
	};
}

/** The user's link, unless they unlinked it. */
export async function findLiveGithubAccountLink(db: GithubAccountLinkDb, userId: string): Promise<GithubAccountLinkRecord | null> {
	const row = await db.githubAccountLink.findFirst({ where: { userId, isDeleted: false } });
	return row === null ? null : toGithubAccountLinkRecord(row);
}

/**
 * `GithubAccountLink` — one row per user (ADR 052), bound to one
 * unit-of-work transaction under the caller's own RLS session
 * (`app_owns(user_id)`): a session only ever reads or writes its own link.
 * Every write is one statement, so concurrent links of one user cannot leave
 * two rows or a half-written token.
 */
export class PrismaGithubAccountLinkRepository implements GithubAccountLinkRepository {
	public constructor(private readonly db: GithubAccountLinkDb) {}

	public findLive(userId: string): Promise<GithubAccountLinkRecord | null> {
		return findLiveGithubAccountLink(this.db, userId);
	}

	public async upsert(input: GithubAccountLinkInput): Promise<GithubAccountLinkRecord> {
		const now = BigInt(nowEpochMs());
		const fields = {
			githubUserId: BigInt(input.githubUserId),
			githubLogin: input.githubLogin,
			tokenCiphertext: input.token.ciphertext,
			tokenKeyVersion: input.token.keyVersion,
			tokenExpiresAt: input.tokenExpiresAt === null ? null : BigInt(input.tokenExpiresAt),
			status: GithubAccountLinkStatus.ACTIVE,
			linkedAt: now,
		};
		const row = await this.db.githubAccountLink.upsert({
			where: { userId: input.userId },
			create: { userId: input.userId, ...fields, createdAt: now, updatedAt: now },
			update: { ...fields, isDeleted: false, deletedAt: null, deletedBy: null, updatedAt: now },
		});
		return toGithubAccountLinkRecord(row);
	}

	public async unlink(userId: string, actorUserId: string): Promise<boolean> {
		const now = BigInt(nowEpochMs());
		const result = await this.db.githubAccountLink.updateMany({
			where: { userId, isDeleted: false },
			data: { isDeleted: true, deletedAt: now, deletedBy: actorUserId, tokenCiphertext: WIPED_CIPHERTEXT, updatedAt: now },
		});
		return result.count > 0;
	}

	public async markRejected(userId: string): Promise<void> {
		await this.db.githubAccountLink.updateMany({
			where: { userId, isDeleted: false, status: GithubAccountLinkStatus.ACTIVE },
			data: { status: GithubAccountLinkStatus.REJECTED, updatedAt: BigInt(nowEpochMs()) },
		});
	}
}
