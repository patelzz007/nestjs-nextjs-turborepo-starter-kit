import { Prisma } from "@prisma/client";
import { epochMs } from "@workspace/shared";
import { z } from "zod";

import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { AuthorizationChange, AuthorizationChangeFeedPort } from "../../application/ports/authorization-change-feed.port";
import { AUTHORIZATION_CHANGE_SWEEP_OPERATION } from "../../application/ports/identity.tokens";

const AuthorizationChangeRowSchema = z.object({ id: z.string(), authorizationChangedAt: z.bigint() });

const SWEEP_REASON = "Drop cached authorization of accounts whose access changed recently";

/**
 * Reads the access-change stamps under `maintenance.authorization_change_sweep`, whose bypass covers `User`
 * only. The window is measured on the database clock — the clock the `users_authorization_change_stamp`
 * trigger stamps with — so API clock skew never shifts it. Served by `User ("authorizationChangedAt")`.
 */
export class PrismaAuthorizationChangeFeedReadRepository implements AuthorizationChangeFeedPort {
	public constructor(private readonly transactions: TenantTransactionService) {}

	public async changedWithin(windowMs: number, after: AuthorizationChange | null, limit: number): Promise<readonly AuthorizationChange[]> {
		const afterCursor: Prisma.Sql = after === null ? Prisma.empty : Prisma.sql`AND ("authorizationChangedAt", id) > (${BigInt(after.changedAt)}, ${after.userId})`;
		const rows = await this.transactions.withSystemOperation(
			{ operation: AUTHORIZATION_CHANGE_SWEEP_OPERATION, reason: SWEEP_REASON, actorUserId: null },
			(tx) =>
				tx.$queryRaw`
				SELECT id, "authorizationChangedAt"
				  FROM "User"
				 WHERE "authorizationChangedAt" > (extract(epoch FROM clock_timestamp()) * 1000)::bigint - ${windowMs}
				   ${afterCursor}
				 ORDER BY "authorizationChangedAt", id
				 LIMIT ${limit}`,
		);
		return AuthorizationChangeRowSchema.array()
			.parse(rows)
			.map((row): AuthorizationChange => ({ userId: row.id, changedAt: epochMs(Number(row.authorizationChangedAt)) }));
	}
}
