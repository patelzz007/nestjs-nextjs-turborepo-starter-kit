import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { apiPath, CreateSampleCategorySchema, SampleCategoryIdParamSchema, SampleCategoryListQuerySchema, UpdateSampleCategorySchema } from "@workspace/shared";

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";

import { SampleCategoryService } from "./sample-category.service";

@ApiTags("SampleCategory")
@Controller(apiPath("/sample-category"))
export class GeneratedSampleCategoryController {
	public constructor(protected readonly service: SampleCategoryService) {}

	@RequirePermission("LIST", "SAMPLE_CATEGORY")
	@Get()
	@ApiOperation({ summary: "List SampleCategories" })
	public list(@Query(new ZodValidationPipe(SampleCategoryListQuerySchema)) query: Parameters<SampleCategoryService["list"]>[0]): ReturnType<SampleCategoryService["list"]> {
		return this.service.list(query);
	}

	@RequirePermission("READ", "SAMPLE_CATEGORY")
	@Get(":id")
	@ApiOperation({ summary: "Get SampleCategory by id" })
	public get(@Param(new ZodValidationPipe(SampleCategoryIdParamSchema)) params: { id: string }): ReturnType<SampleCategoryService["getById"]> {
		return this.service.getById(params.id);
	}

	@RequirePermission("CREATE", "SAMPLE_CATEGORY")
	@Post()
	@ApiOperation({ summary: "Create SampleCategory" })
	public create(@Body(new ZodValidationPipe(CreateSampleCategorySchema)) body: Parameters<SampleCategoryService["create"]>[0]): ReturnType<SampleCategoryService["create"]> {
		return this.service.create(body);
	}

	@RequirePermission("UPDATE", "SAMPLE_CATEGORY")
	@Patch(":id")
	@ApiOperation({ summary: "Update SampleCategory" })
	public update(
		@Param(new ZodValidationPipe(SampleCategoryIdParamSchema)) params: { id: string },
		@Body(new ZodValidationPipe(UpdateSampleCategorySchema)) body: Parameters<SampleCategoryService["update"]>[1],
	): ReturnType<SampleCategoryService["update"]> {
		return this.service.update(params.id, body);
	}

	@RequirePermission("DELETE", "SAMPLE_CATEGORY")
	@Delete(":id")
	@ApiOperation({ summary: "Soft delete SampleCategory" })
	public async delete(@Param(new ZodValidationPipe(SampleCategoryIdParamSchema)) params: { id: string }): Promise<{ success: true }> {
		await this.service.delete(params.id);
		return { success: true };
	}

	@RequirePermission("UPDATE", "SAMPLE_CATEGORY")
	@Post(":id/restore")
	@ApiOperation({ summary: "Restore SampleCategory" })
	public restore(@Param(new ZodValidationPipe(SampleCategoryIdParamSchema)) params: { id: string }): ReturnType<SampleCategoryService["restore"]> {
		return this.service.restore(params.id);
	}
}
