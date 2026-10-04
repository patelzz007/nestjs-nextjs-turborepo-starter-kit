import { Module } from "@nestjs/common";

import { SampleCategoryController } from "./sample-category.controller";
import { SampleCategoryRepository } from "./sample-category.repository";
import { SampleCategoryService } from "./sample-category.service";

@Module({
	controllers: [SampleCategoryController],
	providers: [SampleCategoryRepository, SampleCategoryService],
	exports: [SampleCategoryService],
})
export class SampleCategoryModule {}
