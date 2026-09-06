import { Module } from "@nestjs/common";

import { PlatformResourceModule } from "../../platform/platform-resource.module";

import { SampleCategoryController } from "./sample-category.controller";
import { GeneratedSampleCategoryRepository } from "./sample-category.repository.generated";
import { SampleCategoryService } from "./sample-category.service";

@Module({
	imports: [PlatformResourceModule],
	controllers: [SampleCategoryController],
	providers: [GeneratedSampleCategoryRepository, SampleCategoryService],
	exports: [SampleCategoryService],
})
export class SampleCategoryModule {}
