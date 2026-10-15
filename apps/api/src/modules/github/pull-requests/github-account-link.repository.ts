import { Injectable } from "@nestjs/common";
import { GithubAccountLinkStatus, type GithubAccountLink } from "@prisma/client";
import { nowEpochMs } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import type { EncryptedGithubToken } from "./github-credential.cipher";

/** A live (not unlinked) link, as the service reads it. */
export interface GithubAccountLinkRecord {
	readonly userId: string;
	readonly githubUserId: number;
	readonly githubLogin: string;
	readonly token: EncryptedGithubToken;
	readonly tokenExpiresAt: number | null;
	readonly status: GithubAccountLinkStatus;
	/** When the current token was linked. */
	readonly linkedAt: number;
}

/** What a link stores: the account the token belongs to, and the sealed token. */
export interface GithubAccountLinkInput {
	readonly userId: string;
	readonly githubUserId: number;
	readonly githubLogin: string;
	readonly token: EncryptedGithubToken;
	readonly tokenExpiresAt: number | null;
}

/** What an unlinked row keeps in place of the token: nothing that opens anything. */
const WIPED_CIPHERTEXT = "";

function toRecord(row: GithubAccountLink): GithubAccountLinkRecord {
	return {
		userId: row.userId,
		githubUserId: Number(row.githubUserId),
		githubLogin: row.githubLogin,
		token: { ciphertext: row.tokenCiphertext, keyVersion: row.tokenKeyVersion },
		tokenExpiresAt: row.tokenExpiresAt === null ? null : Number(row.tokenExpiresAt),
		status: row.status,
		linkedAt: Number(row.linkedAt),
	};
}

/**
 * `github_account_links` — one row per user (ADR 052). Runs in the caller's
 * own RLS scope (`app_owns(user_id)`): a session only ever reads or writes its
 * own link. Every write is one statement, so concurrent links of one user
 * cannot leave two rows or a half-written token.
 */
@Injectable()
export class GithubAccountLinkRepository {
	public constructor(private readonly prisma: PrismaService) {}

	/** The user's link, unless they unlinked it. */
	public async findLive(userId: string): Promise<GithubAccountLinkRecord | null> {
		const row = await this.prisma.githubAccountLink.findFirst({ where: { userId, isDeleted: false } });
		return row === null ? null : toRecord(row);
	}

	/** Stores (or replaces) the user's token — a new link, a replaced token, or a re-link after unlinking. */
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
		const row = await this.prisma.githubAccountLink.upsert({
			where: { userId: input.userId },
			create: { userId: input.userId, ...fields, createdAt: now, updatedAt: now },
			update: { ...fields, isDeleted: false, deletedAt: null, deletedBy: null, updatedAt: now },
		});
		return toRecord(row);
	}

	/** Unlinks: soft-deletes the row and wipes the token from it. `false` when there was no live link. */
	public async unlink(userId: string, actorUserId: string): Promise<boolean> {
		const now = BigInt(nowEpochMs());
		const result = await this.prisma.githubAccountLink.updateMany({
			where: { userId, isDeleted: false },
			data: { isDeleted: true, deletedAt: now, deletedBy: actorUserId, tokenCiphertext: WIPED_CIPHERTEXT, updatedAt: now },
		});
		return result.count > 0;
	}

	/** Records that GitHub refused the stored token; the next link replaces it. */
	public async markRejected(userId: string): Promise<void> {
		await this.prisma.githubAccountLink.updateMany({
			where: { userId, isDeleted: false, status: GithubAccountLinkStatus.ACTIVE },
			data: { status: GithubAccountLinkStatus.REJECTED, updatedAt: BigInt(nowEpochMs()) },
		});
	}
}
