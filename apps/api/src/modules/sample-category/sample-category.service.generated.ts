import type { CreateSampleCategoryInput, SampleCategory, SampleCategoryListQuery, UpdateSampleCategoryInput } from "@workspace/shared";

import { BaseService } from "../../platform/persistence/base.service";

import { GeneratedSampleCategoryRepository } from "./sample-category.repository.generated";

export abstract class GeneratedSampleCategoryService extends BaseService<
	SampleCategory,
	CreateSampleCategoryInput,
	UpdateSampleCategoryInput,
	SampleCategoryListQuery,
	GeneratedSampleCategoryRepository
> {
	public constructor(repository: GeneratedSampleCategoryRepository) {
		super(repository);
	}
}
