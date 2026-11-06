import { LIST_SLOT_INDEX } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { UserInvalidationTrigger } from "../src/contexts/authorization/public-api";
import type { AuthorizationChange } from "../src/contexts/identity/application/ports/authorization-change-feed.port";
import { AUTHORIZATION_CHANGE_SWEEP_WINDOW_MS, AuthorizationChangeSweep } from "../src/contexts/identity/application/services/authorization-change-sweep";
import { PrismaAuthorizationChangeFeedReadRepository } from "../src/contexts/identity/infrastructure/persistence/prisma-authorization-change-feed.read-repository";
import { getApiConfig } from "../src/config/api-config";
import { TypedConfigService } from "../src/config/typed-config.service";
import { RequestContextService } from "../src/platform/infrastructure/context/request-context";
import { PrismaService } from "../src/prisma/prisma.service";
import { TenantTransactionService } from "../src/prisma/tenant-transaction.service";

/**
 * The durable backstop of cache invalidation, against the real database: the
 * `users_authorization_change_stamp` trigger (prisma/rls/30-authorization-change-stamp.sql)
 * stamps every access change in its own transaction, the feed reads the stamps
 * under `maintenance.authorization_change_sweep` (whose bypass reaches `User`
 * only), and the sweep drops the swept accounts from this instance's caches.
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

/** Records which accounts this instance dropped (authorization cache + session cache). */
class RecordingCaches {
	public readonly authorization: string[] = [];
	public readonly sessions: string[] = [];

	public invalidateUsersOnThisInstance(userIds: readonly string[], _trigger: UserInvalidationTrigger): void {
		this.authorization.push(...userIds);
	}

	public invalidateUsers(userIds: readonly string[]): Promise<void> {
		this.sessions.push(...userIds);
		return Promise.resolve();
	}
}

describe("Authorization change sweep (integration)", () => {
	let verifier: Pool;
	let prisma: PrismaService;
	let feed: PrismaAuthorizationChangeFeedReadRepository;
	let userId = "";

	async function stampOf(id: string): Promise<string | null> {
		const result = await verifier.query<{ stamp: string | null }>('SELECT "authorizationChangedAt"::text AS stamp FROM public."User" WHERE id = $1', [id]);
		return result.rows[LIST_SLOT_INDEX.first]?.stamp ?? null;
	}

	async function inWindow(): Promise<readonly AuthorizationChange[]> {
		return feed.changedWithin(AUTHORIZATION_CHANGE_SWEEP_WINDOW_MS, null, 500);
	}

	beforeAll(async () => {
		verifier = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaService(new TypedConfigService(getApiConfig()));
		prisma.onModuleInit();
		await prisma.ensureConnected();
		feed = new PrismaAuthorizationChangeFeedReadRepository(new TenantTransactionService(prisma, new RequestContextService()));
		const user = await verifier.query<{ id: string }>('SELECT id FROM public."User" WHERE "isDeleted" = false ORDER BY id LIMIT 1');
		userId = user.rows[LIST_SLOT_INDEX.first]?.id ?? "";
	});

	afterAll(async () => {
		await prisma.onModuleDestroy();
		await verifier.end();
	});

	it("stamps a revocation in the same transaction, and leaves an unrelated edit unstamped", async () => {
		const before: string | null = await stampOf(userId);
		await verifier.query('UPDATE public."User" SET "fullName" = "fullName", "profileVersion" = "profileVersion" WHERE id = $1', [userId]);
		expect(await stampOf(userId)).toBe(before);

		await verifier.query('UPDATE public."User" SET "tokenVersion" = "tokenVersion" + 1 WHERE id = $1', [userId]);
		await verifier.query('UPDATE public."User" SET "tokenVersion" = "tokenVersion" - 1 WHERE id = $1', [userId]);

		expect(await stampOf(userId)).not.toBe(before);
	});

	it("serves the stamped account inside the window, oldest first, and pages past it with the keyset cursor", async () => {
		await verifier.query('UPDATE public."User" SET "tokenVersion" = "tokenVersion" + 1 WHERE id = $1', [userId]);
		await verifier.query('UPDATE public."User" SET "tokenVersion" = "tokenVersion" - 1 WHERE id = $1', [userId]);

		const changes: readonly AuthorizationChange[] = await inWindow();
		const swept: AuthorizationChange | undefined = changes.find((change): boolean => change.userId === userId);
		expect(swept).toBeDefined();
		const stamps: number[] = changes.map((change): number => change.changedAt);
		expect(stamps).toEqual([...stamps].sort((a, b): number => a - b));

		const after: readonly AuthorizationChange[] = await feed.changedWithin(AUTHORIZATION_CHANGE_SWEEP_WINDOW_MS, changes.at(-1) ?? null, 500);
		expect(after).toEqual([]);
	});

	it("drops the stamped account from this instance's caches once, then again only after a newer change", async () => {
		const caches = new RecordingCaches();
		const sweep = new AuthorizationChangeSweep(feed, caches, caches);
		await verifier.query('UPDATE public."User" SET "tokenVersion" = "tokenVersion" + 1 WHERE id = $1', [userId]);
		await verifier.query('UPDATE public."User" SET "tokenVersion" = "tokenVersion" - 1 WHERE id = $1', [userId]);

		await sweep.sweepOnce();
		expect(caches.authorization).toContain(userId);
		expect(caches.sessions).toContain(userId);

		const dropped: number = caches.authorization.length;
		await sweep.sweepOnce();
		expect(caches.authorization).toHaveLength(dropped);

		await verifier.query('UPDATE public."User" SET "isActive" = NOT "isActive" WHERE id = $1', [userId]);
		await verifier.query('UPDATE public."User" SET "isActive" = NOT "isActive" WHERE id = $1', [userId]);
		await sweep.sweepOnce();
		expect(caches.authorization.filter((id: string): boolean => id === userId)).toHaveLength(2);
	});
});
