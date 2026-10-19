import { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { EncryptedGithubToken } from "./github-credentials.port";

/** A link's health: `REJECTED` once GitHub refused the stored token (the next link replaces it). */
export const GithubAccountLinkStatusSchema = z.enum(["ACTIVE", "REJECTED"]);
export type GithubAccountLinkStatus = z.output<typeof GithubAccountLinkStatusSchema>;

/** A live (not unlinked) link. */
export interface GithubAccountLinkRecord {
	readonly userId: string;
	readonly githubUserId: number;
	readonly githubLogin: string;
	readonly token: EncryptedGithubToken;
	readonly tokenExpiresAt: number | null;
	readonly status: GithubAccountLinkStatus;
	/** When the current token was linked (epoch ms). */
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

/**
 * `GithubAccountLink`, bound to one unit-of-work transaction under the
 * caller's RLS session (`app_owns(user_id)`). Every write is one statement.
 */
export interface GithubAccountLinkRepository {
	findLive(userId: string): Promise<GithubAccountLinkRecord | null>;
	/** A new link, a replaced token, or a re-link after unlinking. */
	upsert(input: GithubAccountLinkInput): Promise<GithubAccountLinkRecord>;
	/** Soft-deletes the row and wipes the token from it. `false` when there was no live link. */
	unlink(userId: string, actorUserId: string): Promise<boolean>;
	/** Records that GitHub refused the stored token. */
	markRejected(userId: string): Promise<void>;
}

/** Reads the caller's own link under their RLS session. */
export interface GithubAccountLinkReadPort {
	findLive(actor: ActorContext, userId: string): Promise<GithubAccountLinkRecord | null>;
}
