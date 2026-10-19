import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Prisma } from "@prisma/client";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { DeviceSessionsRevoked } from "../src/contexts/identity/domain/events/identity.events";
import { createIdentityTransactionalPorts, type IdentityTransactionalPorts } from "../src/contexts/identity/infrastructure/persistence/identity-transactional-ports";
import { TransactionalEventCollector } from "../src/platform/application/events/transactional-event-collector";
import { systemRlsContext } from "../src/prisma/rls-context";
import { TenantTransactionService } from "../src/prisma/tenant-transaction.service";
import { createE2eApp } from "./e2e-helpers";

/**
 * Identity's ports bound to ANOTHER context's transaction (authorization's RBAC writes, organizations'
 * invite registration): they write in the caller's transaction, against the real schema.
 */

const SESSION_TTL_MS = 3_600_000;
const TARGET_EMAIL = "user@example.com";

const SessionRowSchema = z.object({ isDeleted: z.boolean(), deletedBy: z.string().nullable() });
const TokenVersionRowSchema = z.object({ tokenVersion: z.number().int() });

describe("createIdentityTransactionalPorts (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let userId: string;

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		const result = await pool.query<{ id: string }>(`SELECT id FROM public."User" WHERE email = $1`, [TARGET_EMAIL]);
		const id = result.rows.at(0)?.id;
		if (id === undefined) {
			throw new Error(`Seed user missing: ${TARGET_EMAIL} — run pnpm db:seed`);
		}
		userId = id;
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	/**
	 * Runs `work` on identity's ports bound to one RLS-stamped transaction of the app, the way a calling
	 * context's unit of work opens it (here a bypass-scoped system operation, as the routes that reach
	 * these ports run).
	 */
	async function inTransaction<Result>(events: TransactionalEventCollector | null, work: (ports: IdentityTransactionalPorts) => Promise<Result>): Promise<Result> {
		return app
			.get(TenantTransactionService)
			.withRlsContext({ context: systemRlsContext("route.rls_bypass"), reason: "identity transactional ports e2e" }, async (tx: Prisma.TransactionClient): Promise<Result> =>
				work(createIdentityTransactionalPorts(tx, { newId: randomUUID }, events)),
			);
	}

	async function openSession(): Promise<string> {
		const sessionId: string = randomUUID();
		await pool.query(`INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt") VALUES ($1, $2, $3, $4)`, [
			sessionId,
			`e2e-${sessionId}`,
			userId,
			Date.now() + SESSION_TTL_MS,
		]);
		return sessionId;
	}

	async function sessionRow(sessionId: string): Promise<z.output<typeof SessionRowSchema>> {
		const result = await pool.query(`SELECT "isDeleted" AS "isDeleted", "deletedBy" AS "deletedBy" FROM public."RefreshToken" WHERE id = $1`, [sessionId]);
		return SessionRowSchema.parse(result.rows.at(0));
	}

	async function tokenVersion(): Promise<number> {
		const result = await pool.query(`SELECT "tokenVersion" AS "tokenVersion" FROM public."User" WHERE id = $1`, [userId]);
		return TokenVersionRowSchema.parse(result.rows.at(0)).tokenVersion;
	}

	it("revokes every live session of the users once, bumps their token generation and records the revocation", async () => {
		const first = await openSession();
		const second = await openSession();
		const versionBefore = await tokenVersion();
		const events = new TransactionalEventCollector();

		await inTransaction(events, (ports) => ports.sessions.revokeAllSessions([userId, userId], { kind: "user", userId }));

		expect(await sessionRow(first)).toEqual({ isDeleted: true, deletedBy: userId });
		expect(await sessionRow(second)).toEqual({ isDeleted: true, deletedBy: userId });
		expect(await tokenVersion()).toBe(versionBefore + 1);
		const [event] = events.take();
		expect(event).toBeInstanceOf(DeviceSessionsRevoked);
		expect(event).toMatchObject({ userIds: [userId], reason: "rbac_mutation" });
	});

	it("marks a system revocation with its system marker", async () => {
		const session = await openSession();

		await inTransaction(null, (ports) => ports.sessions.revokeAllSessions([userId], { kind: "system", marker: "system:rbac-mutation" }));

		expect((await sessionRow(session)).deletedBy).toBe("system:rbac-mutation");
	});

	it("does nothing for an empty user list", async () => {
		const versionBefore = await tokenVersion();
		const events = new TransactionalEventCollector();

		await inTransaction(events, (ports) => ports.sessions.revokeAllSessions([], { kind: "user", userId }));

		expect(await tokenVersion()).toBe(versionBefore);
		expect(events.pendingCount()).toBe(0);
	});

	it("creates an account with its first referral code and default role, and answers email_taken for a taken address", async () => {
		const email = `tx-ports-${randomUUID()}@example.com`;
		const account = { email, fullName: "Tx Ports", passwordHash: "argon2-hash" };

		const created = await inTransaction(null, (ports) => ports.accounts.createAccount(account));
		const taken = await inTransaction(null, (ports) => ports.accounts.createAccount(account));

		expect(created.kind).toBe("created");
		expect(taken).toEqual({ kind: "email_taken" });
		const found = await inTransaction(null, (ports) => ports.accounts.findAccountIdByEmail(email));
		expect(created).toEqual({ kind: "created", userId: found });
		const codes = await pool.query(`SELECT count(*)::int AS count FROM public."SignupReferralCode" WHERE "userId" = $1`, [found]);
		const roles = await pool.query(`SELECT count(*)::int AS count FROM public."UserRole" WHERE "userId" = $1`, [found]);
		expect(z.object({ count: z.number() }).parse(codes.rows.at(0)).count).toBe(1);
		expect(z.object({ count: z.number() }).parse(roles.rows.at(0)).count).toBe(1);
	});

	it("names an account by the name it registered with, and answers null for an unknown id", async () => {
		const stored = await pool.query(`SELECT "fullName" AS "fullName" FROM public."User" WHERE id = $1`, [userId]);
		const fullName = z.object({ fullName: z.string() }).parse(stored.rows.at(0)).fullName;

		await expect(inTransaction(null, (ports) => ports.consumerClaimants.displayName(userId))).resolves.toBe(fullName);
		await expect(inTransaction(null, (ports) => ports.consumerClaimants.displayName(randomUUID()))).resolves.toBeNull();
	});
});
