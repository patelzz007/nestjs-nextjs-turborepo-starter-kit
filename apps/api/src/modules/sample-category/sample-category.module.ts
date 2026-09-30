import { Module } from "@nestjs/common";

import { PlatformResourceModule } from "../../platform/platform-resource.module";

import { SampleCategoryController } from "./sample-category.controller";
import { SampleCategoryRepository } from "./sample-category.repository";
import { SampleCategoryService } from "./sample-category.service";

@Module({
	imports: [PlatformResourceModule],
	controllers: [SampleCategoryController],
	providers: [SampleCategoryRepository, SampleCategoryService],
	exports: [SampleCategoryService],
})
export class SampleCategoryModule {}
