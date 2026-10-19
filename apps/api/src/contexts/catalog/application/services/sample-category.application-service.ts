import { Inject, Injectable } from "@nestjs/common";
import type {
	BulkDeleteResult,
	CreateSampleCategoryInput,
	PaginatedServiceResult,
	SampleCategory,
	SampleCategoryListQuery,
	UpdateSampleCategoryInput,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { SampleCategoryEntity } from "../../domain/entities/sample-category.entity";
import { toBulkDeleteResult, toCatalogPage } from "../../domain/repositories/product.repository";
import type { CatalogScope } from "../catalog-scope";
import { CATALOG_READ_OPERATION, CATALOG_UNIT_OF_WORK, CATALOG_WRITE_OPERATION } from "../catalog.tokens";
import { missingCatalogResource } from "./missing-catalog-resource";

@Injectable()
export class SampleCategoryApplicationService {
	public constructor(@Inject(CATALOG_UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork<CatalogScope>) {}

	public async list(actor: ActorContext, query: SampleCategoryListQuery): Promise<PaginatedServiceResult<SampleCategory>> {
		return this.unitOfWork.runSystemOperation(CATALOG_READ_OPERATION, actor, async (scope: CatalogScope): Promise<PaginatedServiceResult<SampleCategory>> => {
			const result = await scope.sampleCategories.list(query);
			return toCatalogPage(result, query);
		});
	}

	public async getById(actor: ActorContext, id: string): Promise<SampleCategory> {
		return this.unitOfWork.runSystemOperation(CATALOG_READ_OPERATION, actor, async (scope: CatalogScope): Promise<SampleCategory> => {
			const row = await scope.sampleCategories.findById(id);
			if (row === null) {
				throw missingCatalogResource(id);
			}
			return SampleCategoryEntity.rehydrate(row).toRecord();
		});
	}

	public async create(actor: ActorContext, input: CreateSampleCategoryInput): Promise<SampleCategory> {
		return this.unitOfWork.runSystemOperation(CATALOG_WRITE_OPERATION, actor, (scope: CatalogScope): Promise<SampleCategory> => scope.sampleCategories.create(input));
	}

	public async update(actor: ActorContext, id: string, input: UpdateSampleCategoryInput): Promise<SampleCategory> {
		return this.unitOfWork.runSystemOperation(CATALOG_WRITE_OPERATION, actor, async (scope: CatalogScope): Promise<SampleCategory> => {
			const current = await scope.sampleCategories.findById(id);
			if (current === null) {
				throw missingCatalogResource(id);
			}
			const entity = SampleCategoryEntity.rehydrate(current);
			return scope.sampleCategories.update(entity.id, input);
		});
	}

	/** Soft-deletes the category and its products inside the one unit-of-work transaction. */
	public async delete(actor: ActorContext, id: string): Promise<void> {
		await this.unitOfWork.runSystemOperation(CATALOG_WRITE_OPERATION, actor, (scope: CatalogScope): Promise<void> => scope.sampleCategories.delete(id));
	}

	public async createMany(actor: ActorContext, inputs: readonly CreateSampleCategoryInput[]): Promise<readonly SampleCategory[]> {
		return this.unitOfWork.runSystemOperation(CATALOG_WRITE_OPERATION, actor, (scope: CatalogScope): Promise<readonly SampleCategory[]> =>
			scope.sampleCategories.createMany(inputs),
		);
	}

	public async deleteMany(actor: ActorContext, ids: readonly string[]): Promise<BulkDeleteResult> {
		return this.unitOfWork.runSystemOperation(CATALOG_WRITE_OPERATION, actor, async (scope: CatalogScope): Promise<BulkDeleteResult> => {
			const deletedCount = await scope.sampleCategories.deleteMany(ids);
			return toBulkDeleteResult(deletedCount);
		});
	}

	public async restore(actor: ActorContext, id: string): Promise<SampleCategory> {
		return this.unitOfWork.runSystemOperation(CATALOG_WRITE_OPERATION, actor, (scope: CatalogScope): Promise<SampleCategory> => scope.sampleCategories.restore(id));
	}
}
