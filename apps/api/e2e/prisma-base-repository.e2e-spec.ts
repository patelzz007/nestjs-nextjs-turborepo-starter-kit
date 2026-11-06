import { randomUUID } from "node:crypto";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getApiConfig } from "../src/config/api-config";
import { TypedConfigService } from "../src/config/typed-config.service";
import { systemActor } from "../src/platform/application/actor-context";
import { RequestContextService } from "../src/platform/infrastructure/context/request-context";
import { CATALOG_WRITE_OPERATION } from "../src/contexts/catalog/application/catalog.tokens";
import { transactionRepositoryDb } from "../src/platform/infrastructure/persistence/types";
import { toRlsTransactionScope, type RlsTransactionScope } from "../src/platform/infrastructure/unit-of-work/actor-to-rls-context";
import { PrismaSampleCategoryRepository } from "../src/contexts/catalog/infrastructure/persistence/prisma-sample-category.repository";
import { PrismaService } from "../src/prisma/prisma.service";
import { TenantTransactionService } from "../src/prisma/tenant-transaction.service";

class BatchRejected extends Error {}

describe("PrismaBaseRepository (e2e)", () => {
	let prisma: PrismaService;
	let transactions: TenantTransactionService;
	let verifier: Pool;
	const slugs: string[] = [];

	beforeAll(async () => {
		prisma = new PrismaService(new TypedConfigService(getApiConfig()));
		prisma.onModuleInit();
		await prisma.ensureConnected();
		transactions = new TenantTransactionService(prisma, new RequestContextService());
		verifier = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo" });
	});

	afterAll(async () => {
		if (slugs.length > 0) {
			await verifier.query('DELETE FROM public."SampleCategory" WHERE slug = ANY($1::text[])', [slugs]);
		}
		await verifier.end();
		await prisma.onModuleDestroy();
	});

	async function countSlugs(slug: string): Promise<number> {
		const result = await verifier.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM public."SampleCategory" WHERE slug = $1', [slug]);
		return result.rows[LIST_SLOT_INDEX.first]?.count ?? 0;
	}

	function actor(): RlsTransactionScope {
		return toRlsTransactionScope(systemActor(CATALOG_WRITE_OPERATION, "job", null, "e2e base repository", null));
	}

	it("createMany inside an outer transaction does not nest, and commits both rows", async () => {
		const first = `base-repo-${randomUUID()}`;
		const second = `base-repo-${randomUUID()}`;
		slugs.push(first, second);

		const created = await transactions.withRlsContext(actor(), async (tx) => {
			const repository = new PrismaSampleCategoryRepository(transactionRepositoryDb(tx));
			return repository.createMany([
				{ name: "First", slug: first },
				{ name: "Second", slug: second },
			]);
		});

		expect(created).toHaveLength(2);
		expect(await countSlugs(first)).toBe(1);
		expect(await countSlugs(second)).toBe(1);
	});

	it("rolls the outer transaction back, undoing createMany", async () => {
		const slug = `base-repo-${randomUUID()}`;
		slugs.push(slug);

		await expect(
			transactions.withRlsContext(actor(), async (tx) => {
				const repository = new PrismaSampleCategoryRepository(transactionRepositoryDb(tx));
				await repository.createMany([{ name: "Rolled back", slug }]);
				throw new BatchRejected("outer transaction failed");
			}),
		).rejects.toBeInstanceOf(BatchRejected);

		expect(await countSlugs(slug)).toBe(0);
	});
});
