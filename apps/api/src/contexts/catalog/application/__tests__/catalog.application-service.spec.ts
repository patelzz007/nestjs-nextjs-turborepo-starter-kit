import { ProductListQuerySchema, type CreateProductInput, type Product, type ProductListQuery, type SampleCategory, type UpdateProductInput } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { ActorContextSchema, type ActorContext } from "../../../../platform/application/actor-context";
import { NotFoundError } from "../../../../platform/application/errors/app-error";
import { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import { InMemoryUnitOfWork } from "../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import type { CatalogList, ProductRepository } from "../../domain/repositories/product.repository";
import type { SampleCategoryRepository } from "../../domain/repositories/sample-category.repository";
import type { CatalogScope } from "../catalog-scope";
import { CATALOG_READ_OPERATION, CATALOG_WRITE_OPERATION } from "../catalog.tokens";
import { ProductApplicationService } from "../services/product.application-service";
import { SampleCategoryApplicationService } from "../services/sample-category.application-service";

const ACTOR: ActorContext = ActorContextSchema.parse({
	kind: "user",
	userId: "user-1",
	sessionId: "session-1",
	tenantId: "org-1",
	isSuperAdmin: true,
	accessScope: "tenant",
	impersonatorUserId: null,
	request: { requestId: "corr-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
});

const PRODUCT: Product = {
	id: "0b6f8f5e-6d3b-4a59-9d55-4c3b1f2a7e10",
	brand: null,
	categoryId: "5f2d1c4b-8a7e-4b6f-9c3d-2e1f0a9b8c7d",
	compareAtPrice: null,
	description: null,
	imageUrl: null,
	isActive: true,
	isFeatured: false,
	name: "Mug",
	price: 10,
	shortDescription: null,
	sku: "mug-1",
	slug: "mug",
	stockQuantity: 1,
	weightGrams: null,
	version: 1,
	deletedAt: null,
	createdAt: 1_792_195_200_000,
	updatedAt: 1_792_195_200_000,
};

const EMPTY_PAGE: CatalogList<Product> = {
	items: [],
	total: 0,
	page: 1,
	totalPages: 0,
	nextCursor: null,
	hasNext: false,
	hasPrevious: false,
};

class FakeProducts implements ProductRepository {
	public deletedInTransaction = false;
	public constructor(private readonly row: Product | null) {}
	public list(): Promise<CatalogList<Product>> {
		return Promise.resolve(this.row === null ? EMPTY_PAGE : { ...EMPTY_PAGE, items: [this.row], total: 1, totalPages: 1 });
	}
	public findById(): Promise<Product | null> {
		return Promise.resolve(this.row);
	}
	public create(input: CreateProductInput): Promise<Product> {
		return Promise.resolve({ ...PRODUCT, name: input.name, sku: input.sku, slug: input.slug });
	}
	public update(_id: string, input: UpdateProductInput): Promise<Product> {
		return Promise.resolve({ ...PRODUCT, name: input.name ?? PRODUCT.name, version: PRODUCT.version + 1 });
	}
	public delete(): Promise<void> {
		this.deletedInTransaction = true;
		return Promise.resolve();
	}
	public createMany(): Promise<readonly Product[]> {
		return Promise.resolve([PRODUCT]);
	}
	public deleteMany(ids: readonly string[]): Promise<number> {
		return Promise.resolve(ids.length);
	}
	public restore(): Promise<Product> {
		return Promise.resolve(PRODUCT);
	}
}

class FakeCategories implements SampleCategoryRepository {
	public deleteCalls = 0;
	public list(): Promise<CatalogList<SampleCategory>> {
		return Promise.resolve({ items: [], total: 0, page: 1, totalPages: 0, nextCursor: null, hasNext: false, hasPrevious: false });
	}
	public findById(): Promise<SampleCategory | null> {
		return Promise.resolve(null);
	}
	public create(): Promise<SampleCategory> {
		return Promise.reject(new Error("unused"));
	}
	public update(): Promise<SampleCategory> {
		return Promise.reject(new Error("unused"));
	}
	public delete(): Promise<void> {
		this.deleteCalls += 1;
		return Promise.resolve();
	}
	public createMany(): Promise<readonly SampleCategory[]> {
		return Promise.resolve([]);
	}
	public deleteMany(): Promise<number> {
		return Promise.resolve(0);
	}
	public restore(): Promise<SampleCategory> {
		return Promise.reject(new Error("unused"));
	}
}

function scope(products: FakeProducts, sampleCategories: FakeCategories): CatalogScope {
	return { products, sampleCategories, events: new TransactionalEventCollector() };
}

const QUERY: ProductListQuery = ProductListQuerySchema.parse({});

describe("ProductApplicationService", () => {
	it("reads through the catalog read operation and returns the rehydrated record", async () => {
		const products = new FakeProducts(PRODUCT);
		const unitOfWork = new InMemoryUnitOfWork(scope(products, new FakeCategories()));
		const service = new ProductApplicationService(unitOfWork);

		await expect(service.getById(ACTOR, PRODUCT.id)).resolves.toBe(PRODUCT);
		expect(unitOfWork.committed).toEqual([{ actor: ACTOR, operation: CATALOG_READ_OPERATION }]);
	});

	it("rolls the unit of work back when the product is missing", async () => {
		const unitOfWork = new InMemoryUnitOfWork(scope(new FakeProducts(null), new FakeCategories()));
		const service = new ProductApplicationService(unitOfWork);

		await expect(service.getById(ACTOR, PRODUCT.id)).rejects.toBeInstanceOf(NotFoundError);
		expect(unitOfWork.rolledBack).toEqual([ACTOR]);
		expect(unitOfWork.committed).toEqual([]);
	});

	it("writes through the catalog write operation", async () => {
		const unitOfWork = new InMemoryUnitOfWork(scope(new FakeProducts(PRODUCT), new FakeCategories()));
		const service = new ProductApplicationService(unitOfWork);

		await service.list(ACTOR, QUERY);
		await service.delete(ACTOR, PRODUCT.id);

		const [read, write] = unitOfWork.committed;
		expect(read?.operation).toBe(CATALOG_READ_OPERATION);
		expect(write?.operation).toBe(CATALOG_WRITE_OPERATION);
	});
});

describe("SampleCategoryApplicationService", () => {
	it("soft-deletes inside one unit-of-work transaction", async () => {
		const categories = new FakeCategories();
		const unitOfWork = new InMemoryUnitOfWork(scope(new FakeProducts(null), categories));
		const service = new SampleCategoryApplicationService(unitOfWork);

		await service.delete(ACTOR, "5f2d1c4b-8a7e-4b6f-9c3d-2e1f0a9b8c7d");

		expect(categories.deleteCalls).toBe(1);
		expect(unitOfWork.committed).toEqual([{ actor: ACTOR, operation: CATALOG_WRITE_OPERATION }]);
	});
});
