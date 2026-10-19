import { Inject, Injectable } from "@nestjs/common";
import type { BulkDeleteResult, CreateProductInput, PaginatedServiceResult, Product, ProductListQuery, UpdateProductInput } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { ProductEntity } from "../../domain/entities/product.entity";
import { toBulkDeleteResult, toCatalogPage } from "../../domain/repositories/product.repository";
import type { CatalogScope } from "../catalog-scope";
import { CATALOG_READ_OPERATION, CATALOG_UNIT_OF_WORK, CATALOG_WRITE_OPERATION } from "../catalog.tokens";
import { missingCatalogResource } from "./missing-catalog-resource";

@Injectable()
export class ProductApplicationService {
	public constructor(@Inject(CATALOG_UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork<CatalogScope>) {}

	public async list(actor: ActorContext, query: ProductListQuery): Promise<PaginatedServiceResult<Product>> {
		return this.unitOfWork.runSystemOperation(CATALOG_READ_OPERATION, actor, async (scope: CatalogScope): Promise<PaginatedServiceResult<Product>> => {
			const result = await scope.products.list(query);
			return toCatalogPage(result, query);
		});
	}

	public async getById(actor: ActorContext, id: string): Promise<Product> {
		return this.unitOfWork.runSystemOperation(CATALOG_READ_OPERATION, actor, async (scope: CatalogScope): Promise<Product> => {
			const row = await scope.products.findById(id);
			if (row === null) {
				throw missingCatalogResource(id);
			}
			return ProductEntity.rehydrate(row).toRecord();
		});
	}

	public async create(actor: ActorContext, input: CreateProductInput): Promise<Product> {
		return this.unitOfWork.runSystemOperation(CATALOG_WRITE_OPERATION, actor, (scope: CatalogScope): Promise<Product> => scope.products.create(input));
	}

	public async update(actor: ActorContext, id: string, input: UpdateProductInput): Promise<Product> {
		return this.unitOfWork.runSystemOperation(CATALOG_WRITE_OPERATION, actor, async (scope: CatalogScope): Promise<Product> => {
			const current = await scope.products.findById(id);
			if (current === null) {
				throw missingCatalogResource(id);
			}
			const entity = ProductEntity.rehydrate(current);
			return scope.products.update(entity.id, input);
		});
	}

	public async delete(actor: ActorContext, id: string): Promise<void> {
		await this.unitOfWork.runSystemOperation(CATALOG_WRITE_OPERATION, actor, (scope: CatalogScope): Promise<void> => scope.products.delete(id));
	}

	public async createMany(actor: ActorContext, inputs: readonly CreateProductInput[]): Promise<readonly Product[]> {
		return this.unitOfWork.runSystemOperation(CATALOG_WRITE_OPERATION, actor, (scope: CatalogScope): Promise<readonly Product[]> => scope.products.createMany(inputs));
	}

	public async deleteMany(actor: ActorContext, ids: readonly string[]): Promise<BulkDeleteResult> {
		return this.unitOfWork.runSystemOperation(CATALOG_WRITE_OPERATION, actor, async (scope: CatalogScope): Promise<BulkDeleteResult> => {
			const deletedCount = await scope.products.deleteMany(ids);
			return toBulkDeleteResult(deletedCount);
		});
	}

	public async restore(actor: ActorContext, id: string): Promise<Product> {
		return this.unitOfWork.runSystemOperation(CATALOG_WRITE_OPERATION, actor, (scope: CatalogScope): Promise<Product> => scope.products.restore(id));
	}
}
