import { Injectable } from "@nestjs/common";

import { GeneratedSampleCategoryRepository } from "./sample-category.repository.generated";
import { GeneratedSampleCategoryService } from "./sample-category.service.generated";

/** Developer-owned service extension point. */
@Injectable()
export class SampleCategoryService extends GeneratedSampleCategoryService {
	public constructor(repository: GeneratedSampleCategoryRepository) {
		super(repository);
	}
}
