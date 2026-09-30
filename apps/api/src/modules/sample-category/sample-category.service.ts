import { Injectable } from "@nestjs/common";
import type { CreateSampleCategoryInput, SampleCategory, SampleCategoryListQuery, UpdateSampleCategoryInput } from "@workspace/shared";

import { BaseService } from "../../platform/persistence/base.service";

import { SampleCategoryRepository } from "./sample-category.repository";

@Injectable()
export class SampleCategoryService extends BaseService<
	SampleCategory,
	CreateSampleCategoryInput,
	UpdateSampleCategoryInput,
	SampleCategoryListQuery,
	SampleCategoryRepository
> {
	public constructor(repository: SampleCategoryRepository) {
		super(repository);
	}
}
