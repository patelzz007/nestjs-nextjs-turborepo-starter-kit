import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Prisma } from "@prisma/client";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { API_VERSION_PREFIX, getFileCategoryPolicy, ImageRulesSchema, LIST_SLOT_INDEX, RewardResponseSchema } from "@workspace/shared";

import { systemActor, type ActorContext } from "../src/platform/application/actor-context";
import { ServerFileIngest } from "../src/contexts/files/public-api";
import { LOAD_TEST_PURGE_OPERATION, LOAD_TEST_WRITE_OPERATION } from "../src/contexts/operations/application/ports/operations.tokens";
import { RandomLoadTestPasswords } from "../src/contexts/operations/infrastructure/load-test/load-test-queue";
import { LoadTestRewardImage } from "../src/contexts/operations/infrastructure/load-test/load-test-reward-image";
import { createPrismaLoadTestTenant, LOAD_TEST_REWARD_COUNT, LOAD_TEST_TENANT_SLUG } from "../src/contexts/operations/infrastructure/load-test/prisma-load-test-tenant";
import { TenantTransactionService } from "../src/prisma/tenant-transaction.service";
import { createE2eApp, login, parseSuccessEnvelope } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

/** A run's size where five shared staff accounts ran out of sessions (5 × 5 = 25). */
const VIRTUAL_USERS = 26;
const STAFF = 6;
const BCRYPT_TEST_ROUNDS = 4;

/** A reward of the Load Test tenant as the database holds it, with its live images' files. */
interface ProvisionedRewardFacts {
	readonly id: string;
	readonly status: string;
	readonly images: readonly { readonly fileId: string; readonly position: number; readonly status: string; readonly category: string }[];
}

/**
 * The Load Test tenant's provisioning on a real database (ADR 068): its published rewards keep the
 * reward invariants (each shows a READY picture the files context stored like an upload), a second
 * run adds nothing, and the purge keeps the provisioned rewards and their picture.
 */
describe("Load Test tenant provisioning (e2e)", () => {
	let app: NestFastifyApplication;
	let transactions: TenantTransactionService;
	let operator: ActorContext;
	let operatorId: string;

	async function provision(passwordHash: string, rewardImageFileId: string): Promise<void> {
		await transactions.withSystemOperation({ operation: LOAD_TEST_WRITE_OPERATION, reason: "e2e: provision the Load Test tenant", actorUserId: operatorId }, (tx) =>
			createPrismaLoadTestTenant(tx).provision({ customers: VIRTUAL_USERS, staff: STAFF, passwordHash, rewardImageFileId }),
		);
	}

	async function purge(): Promise<void> {
		await transactions.withSystemOperation({ operation: LOAD_TEST_PURGE_OPERATION, reason: "e2e: purge load-test data", actorUserId: operatorId }, (tx) =>
			createPrismaLoadTestTenant(tx).purge(),
		);
	}

	async function rewards(): Promise<ProvisionedRewardFacts[]> {
		return transactions.withSystemOperation({ operation: LOAD_TEST_WRITE_OPERATION, reason: "e2e: read the Load Test rewards", actorUserId: operatorId }, async (tx) => {
			const rows = await tx.reward.findMany({
				where: { tenant: { slug: LOAD_TEST_TENANT_SLUG }, isDeleted: false },
				// A stable order: without one PostgreSQL returns rows as they lie on disk, which the purge's writes change.
				orderBy: { id: "asc" },
				select: {
					id: true,
					status: true,
					images: { where: { isDeleted: false }, orderBy: { position: "asc" }, select: { fileId: true, position: true, file: { select: { status: true, category: true } } } },
				},
			});
			return rows.map((row) => ({
				id: row.id,
				status: row.status,
				images: row.images.map((image) => ({ fileId: image.fileId, position: image.position, status: image.file.status, category: image.file.category })),
			}));
		});
	}

	beforeAll(async () => {
		app = await createE2eApp();
		transactions = app.get(TenantTransactionService);
		const pool = new Pool({ connectionString: DATABASE_URL });
		try {
			operatorId = z
				.object({ id: z.string() })
				.parse((await pool.query('SELECT id FROM public."User" WHERE email = $1', ["superadmin@example.com"])).rows.at(LIST_SLOT_INDEX.first)).id;
		} finally {
			await pool.end();
		}
		operator = systemActor(LOAD_TEST_WRITE_OPERATION, "cli", null, "e2e: start a load test", operatorId);
		// Whatever earlier load tests left in this database copy (rewards from before they were marked included) goes first.
		await purge();
	});

	afterAll(async () => {
		await app.close();
	});

	it("publishes rewards that each show a READY, scanned and rendered picture, stored once, and adds nothing on a second run", async () => {
		const tenantId = await transactions.withSystemOperation(
			{ operation: LOAD_TEST_WRITE_OPERATION, reason: "e2e: ensure the Load Test tenant", actorUserId: operatorId },
			(tx) => createPrismaLoadTestTenant(tx).ensureTenant(),
		);
		const pictures = new LoadTestRewardImage(app.get(ServerFileIngest));
		const first = await pictures.ensure(operator, tenantId, operatorId);
		const credentials = await new RandomLoadTestPasswords(BCRYPT_TEST_ROUNDS).issue();
		await provision(credentials.hash, first);

		const second = await pictures.ensure(operator, tenantId, operatorId);
		await provision(credentials.hash, second);

		expect(second).toBe(first);
		const provisioned = await rewards();
		expect(provisioned).toHaveLength(LOAD_TEST_REWARD_COUNT);
		for (const reward of provisioned) {
			expect(reward.status).toBe("PUBLISHED");
			expect(reward.images).toEqual([{ fileId: first, position: 0, status: "READY", category: "REWARD_IMAGE" }]);
		}

		// The public marketplace and the merchant list map every one of them (no "reward has no images").
		const [cover] = provisioned;
		const detail = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/rewards/${cover?.id ?? ""}` });
		expect(detail.statusCode).toBe(200);
		const [picture] = parseSuccessEnvelope(detail, RewardResponseSchema).data.images;
		expect(picture?.fileId).toBe(first);
		// Its published renditions, as an upload's: the REWARD_IMAGE sizes up to the picture's own width.
		const rules = ImageRulesSchema.parse(getFileCategoryPolicy("REWARD_IMAGE").imageRules);
		const renditionWidths: number[] = rules.variants.map((variant) => variant.width).filter((width) => width <= rules.minWidth);
		expect(picture?.sources.map((source) => source.width)).toEqual(renditionWidths);
		const staff = await login(app, "staff-0006@loadtest.invalid", credentials.password, "merchant");
		const list = await app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}/tenants/${LOAD_TEST_TENANT_SLUG}/rewards`,
			headers: { cookie: `merchantAccessToken=${staff.accessToken}; merchantRefreshToken=${staff.refreshToken}`, "x-client-type": "merchant" },
		});
		expect(list.statusCode).toBe(200);
		expect(parseSuccessEnvelope(list, z.array(RewardResponseSchema)).data).toHaveLength(LOAD_TEST_REWARD_COUNT);
	});

	it("purges every other reward of the tenant and keeps the provisioned ones showing their picture", async () => {
		const before = await rewards();
		await transactions.withSystemOperation({ operation: LOAD_TEST_WRITE_OPERATION, reason: "e2e: a reward a scenario made", actorUserId: operatorId }, async (tx) => {
			const tenant = await tx.tenant.findFirstOrThrow({ where: { slug: LOAD_TEST_TENANT_SLUG } });
			const unmarked = {
				tenantId: tenant.id,
				description: "e2e",
				rewardType: "DISCOUNT",
				category: "cafe",
				quantityTotal: 1,
				quantityRemaining: 1,
				expiryDate: BigInt(Date.now()),
			} satisfies Omit<Prisma.RewardUncheckedCreateInput, "title">;
			// A reward a scenario made, and one the old provisioner published with no image and no mark.
			await tx.reward.create({ data: { ...unmarked, title: "Made by a scenario" } });
			await tx.reward.create({ data: { ...unmarked, title: "Load-test reward 1", status: "PUBLISHED" } });
		});

		await purge();

		expect(await rewards()).toEqual(before);
	});
});
