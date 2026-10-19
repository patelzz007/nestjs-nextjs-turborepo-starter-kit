import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { PrismaService } from "../src/prisma/prisma.service";
import { createE2eApp, login, markSeedUserEmailVerified, type LoginResult } from "./e2e-helpers";
import { expectNoNPlusOne } from "./support/sql-statement-counter";

/**
 * The hot list endpoints issue the same number of SQL statements for a 1-row page and a 25-row page
 * (migration plan §11). Rows the seed does not hold enough of are cloned from a seeded row with a
 * unique marker, and removed again afterwards.
 */
const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const HTTP_OK = 200;
const SUPER_ADMIN = { email: "superadmin@example.com", password: "SuperAdmin@123" };
const CONSUMER = { email: "user@example.com", password: "User@123" };
const MERCHANT_OWNER = { email: "brew.owner@kl-rewards.demo", password: "BrewOwner@123" };
const MERCHANT_SLUG = "brew-bean-kl";

const PageSchema = z.object({ data: z.array(z.object({}).loose()) });
const IdRowSchema = z.object({ id: z.string() });

describe("hot lists have no N+1 (e2e)", () => {
	const marker = `nplus${randomUUID().slice(0, 8)}`;
	const clonedUserIds: string[] = [];
	const clonedOrganizationIds: string[] = [];
	const clonedRewardIds: string[] = [];
	let app: NestFastifyApplication;
	let pool: Pool;
	let admin: LoginResult;
	let consumer: LoginResult;
	let owner: LoginResult;

	/**
	 * Inserts a copy of row `sourceId` of `table` with a new id and the `overrides` (column → value). Every other
	 * column — required ones included — is copied, so the clone is as valid as its source.
	 */
	async function cloneRow(table: string, sourceId: string, overrides: ReadonlyMap<string, string>): Promise<string> {
		const columns = (
			await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [table])
		).rows.map((row): string => z.object({ column_name: z.string() }).parse(row).column_name);
		const id = randomUUID();
		const values: string[] = [id, sourceId];
		const selected = columns.map((column: string): string => {
			if (column === "id") {
				return "$1";
			}
			const override = overrides.get(column);
			if (override === undefined) {
				return `"${column}"`;
			}
			values.push(override);
			return `$${String(values.length)}`;
		});
		const quoted = columns.map((column: string): string => `"${column}"`).join(", ");
		await pool.query(`INSERT INTO public."${table}" (${quoted}) SELECT ${selected.join(", ")} FROM public."${table}" WHERE id = $2`, values);
		return id;
	}

	async function idOf(sql: string, values: readonly string[]): Promise<string> {
		return IdRowSchema.parse((await pool.query(sql, [...values])).rows.at(0)).id;
	}

	/** Cloned users (and their memberships) are kept from one seed size to the next; this tops them up to `rows`. */
	async function cloneUsers(rows: number, sourceUserId: string): Promise<void> {
		while (clonedUserIds.length < rows) {
			const index = String(clonedUserIds.length);
			clonedUserIds.push(
				await cloneRow(
					"User",
					sourceUserId,
					new Map([
						["email", `${marker}-${index}@example.com`],
						["fullName", `${marker} ${index}`],
					]),
				),
			);
		}
	}

	/** The session cookies of one client (web, admin or merchant), and the client type header that selects them. */
	function sessionHeaders(session: LoginResult, client: "web" | "admin" | "merchant"): Record<string, string> {
		const access = client === "web" ? "accessToken" : `${client}AccessToken`;
		const refresh = client === "web" ? "refreshToken" : `${client}RefreshToken`;
		return { cookie: `${access}=${session.accessToken}; ${refresh}=${session.refreshToken}`, "x-client-type": client };
	}

	async function expectFlatList(url: (limit: number) => string, headers: Record<string, string>, seed: (rows: number) => Promise<void>): Promise<void> {
		const request = async (limit: number): Promise<void> => {
			const response = await app.inject({ method: "GET", url: url(limit), headers });
			expect(response.statusCode, response.body).toBe(HTTP_OK);
			// The comparison only means something when the page really is that full.
			expect(PageSchema.parse(response.json()).data).toHaveLength(limit);
		};
		await seed(1);
		await request(1);
		await expectNoNPlusOne(app.get(PrismaService).connectionPool(), request, seed);
	}

	const noSeed = (): Promise<void> => Promise.resolve();

	beforeAll(async (): Promise<void> => {
		pool = new Pool({ connectionString: DATABASE_URL });
		app = await createE2eApp();
		admin = await login(app, SUPER_ADMIN.email, SUPER_ADMIN.password, "admin");
		// Seeded unverified on purpose (it demos verify-email); a verified address lifts the restricted session.
		await markSeedUserEmailVerified(pool, CONSUMER.email);
		consumer = await login(app, CONSUMER.email, CONSUMER.password);
		owner = await login(app, MERCHANT_OWNER.email, MERCHANT_OWNER.password, "merchant");
	});

	afterAll(async (): Promise<void> => {
		await pool.query(`DELETE FROM public."OrganizationMembership" WHERE "userId" = ANY($1)`, [clonedUserIds]);
		await pool.query(`DELETE FROM public."User" WHERE id = ANY($1)`, [clonedUserIds]);
		await pool.query(`DELETE FROM public."Reward" WHERE id = ANY($1)`, [clonedRewardIds]);
		await pool.query(`DELETE FROM public."Organization" WHERE id = ANY($1)`, [clonedOrganizationIds]);
		await pool.end();
		await app.close();
	});

	it("GET /auth/admin/users", async (): Promise<void> => {
		const sourceUserId = await idOf(`SELECT id FROM public."User" WHERE email = $1`, [CONSUMER.email]);
		await expectFlatList(
			(limit) => `${API_VERSION_PREFIX}/auth/admin/users?search=${marker}&limit=${String(limit)}`,
			sessionHeaders(admin, "admin"),
			(rows) => cloneUsers(rows, sourceUserId),
		);
	});

	it("GET /admin/merchants", async (): Promise<void> => {
		const sourceOrganizationId = await idOf(`SELECT id FROM public."Organization" WHERE slug = $1`, [MERCHANT_SLUG]);
		// The list holds organizations with a merchant profile, so each clone gets its own.
		const sourceProfileId = await idOf(`SELECT id FROM public."OrganizationMerchantProfile" WHERE "organizationId" = $1`, [sourceOrganizationId]);
		await expectFlatList(
			(limit) => `${API_VERSION_PREFIX}/admin/merchants?search=${marker}&limit=${String(limit)}`,
			sessionHeaders(admin, "admin"),
			async (rows) => {
				while (clonedOrganizationIds.length < rows) {
					const index = String(clonedOrganizationIds.length);
					const organizationId = await cloneRow(
						"Organization",
						sourceOrganizationId,
						new Map([
							["slug", `${marker}-${index}`],
							["displayName", `${marker} ${index}`],
						]),
					);
					clonedOrganizationIds.push(organizationId);
					await cloneRow("OrganizationMerchantProfile", sourceProfileId, new Map([["organizationId", organizationId]]));
				}
			},
		);
	});

	it("GET /orgs/:orgSlug/members", async (): Promise<void> => {
		const organizationId = await idOf(`SELECT id FROM public."Organization" WHERE slug = $1`, [MERCHANT_SLUG]);
		const sourceUserId = await idOf(`SELECT id FROM public."User" WHERE email = $1`, [CONSUMER.email]);
		const sourceMembershipId = await idOf(`SELECT id FROM public."OrganizationMembership" WHERE "organizationId" = $1 AND NOT "isDeleted" ORDER BY "createdAt" LIMIT 1`, [
			organizationId,
		]);
		const memberships = new Set<string>();
		await expectFlatList(
			(limit) => `${API_VERSION_PREFIX}/orgs/${MERCHANT_SLUG}/members?limit=${String(limit)}`,
			sessionHeaders(owner, "merchant"),
			async (rows) => {
				await cloneUsers(rows, sourceUserId);
				for (const userId of clonedUserIds.slice(0, rows)) {
					if (!memberships.has(userId)) {
						memberships.add(userId);
						await cloneRow(
							"OrganizationMembership",
							sourceMembershipId,
							new Map([
								["userId", userId],
								["role", "MEMBER"],
							]),
						);
					}
				}
			},
		);
	});

	it("GET /rewards (marketplace)", async (): Promise<void> => {
		const headers = sessionHeaders(consumer, "web");
		// Clone a reward the marketplace already shows, so every clone is just as visible.
		const shown = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/rewards?limit=1`, headers });
		const sourceRewardId = IdRowSchema.parse(PageSchema.parse(shown.json()).data.at(0)).id;
		await expectFlatList(
			(limit) => `${API_VERSION_PREFIX}/rewards?search=${marker}&limit=${String(limit)}`,
			headers,
			async (rows) => {
				while (clonedRewardIds.length < rows) {
					const rewardId = await cloneRow("Reward", sourceRewardId, new Map([["title", `${marker} ${String(clonedRewardIds.length)}`]]));
					clonedRewardIds.push(rewardId);
					// A marketplace card needs the reward's images: copy the source's (cascade-deleted with the clone).
					const images = await pool.query(`SELECT id FROM public."RewardImage" WHERE "rewardId" = $1 AND NOT "isDeleted"`, [sourceRewardId]);
					for (const image of images.rows) {
						await cloneRow("RewardImage", IdRowSchema.parse(image).id, new Map([["rewardId", rewardId]]));
					}
				}
			},
		);
	});

	it("GET /claims (own claims)", async (): Promise<void> => {
		await expectFlatList((limit) => `${API_VERSION_PREFIX}/claims?limit=${String(limit)}`, sessionHeaders(consumer, "web"), noSeed);
	});
});
