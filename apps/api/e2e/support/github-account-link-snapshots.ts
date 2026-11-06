// Snapshots of `GithubAccountLink` rows for e2e suites that link tokens:
// taken before the suite, written back after it, so running the suites never
// replaces a developer's own linked GitHub token.

import { JsonValueSchema } from "@workspace/shared";
import type { Pool } from "pg";
import { z } from "zod";

/** One link row as Postgres hands it back (`row_to_json`), kept only to be written back unchanged. */
const LinkSnapshotSchema = z.object({ userId: z.string(), row: JsonValueSchema });
export type GithubAccountLinkSnapshot = z.output<typeof LinkSnapshotSchema>;

export async function snapshotGithubAccountLinks(pool: Pool, userIds: readonly string[]): Promise<readonly GithubAccountLinkSnapshot[]> {
	const result = await pool.query('SELECT "userId" AS "userId", row_to_json(l) AS "row" FROM public."GithubAccountLink" l WHERE "userId" = ANY($1::text[])', [userIds]);
	return z.array(LinkSnapshotSchema).parse(result.rows);
}

/** Every column back to the snapshot — an update in place, never a delete (the table is soft-delete only). */
export async function restoreGithubAccountLinks(pool: Pool, snapshots: readonly GithubAccountLinkSnapshot[]): Promise<void> {
	for (const { userId, row } of snapshots) {
		await pool.query(
			'UPDATE public."GithubAccountLink" AS l SET ("githubUserId", "githubLogin", "tokenCiphertext", "tokenKeyVersion", "tokenExpiresAt", status, "linkedAt", "isDeleted", "deletedAt", "deletedBy", "createdAt", "updatedAt") = ' +
				'(SELECT "githubUserId", "githubLogin", "tokenCiphertext", "tokenKeyVersion", "tokenExpiresAt", status, "linkedAt", "isDeleted", "deletedAt", "deletedBy", "createdAt", "updatedAt" ' +
				'FROM json_populate_record(NULL::public."GithubAccountLink", $1::json)) WHERE l."userId" = $2',
			[JSON.stringify(row), userId],
		);
	}
}
