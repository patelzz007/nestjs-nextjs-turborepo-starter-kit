import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
	apiPath,
	BulkCreateSampleCategorySchema,
	BulkDeleteIdsSchema,
	CreateSampleCategorySchema,
	SampleCategoryIdParamSchema,
	SampleCategoryListQuerySchema,
	UpdateSampleCategorySchema,
} from "@workspace/shared";

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
	@ApiOkResponse({ description: "Paginated list of samplecategories" })
	public list(@Query(new ZodValidationPipe(SampleCategoryListQuerySchema)) query: Parameters<SampleCategoryService["list"]>[0]): ReturnType<SampleCategoryService["list"]> {
		return this.service.list(query);
	}

	@RequirePermission("CREATE", "SAMPLE_CATEGORY")
	@Post("bulk")
	@ApiOperation({ summary: "Bulk create samplecategories" })
	@ApiOkResponse({ description: "Created samplecategories" })
	public bulkCreate(
		@Body(new ZodValidationPipe(BulkCreateSampleCategorySchema)) body: { items: Parameters<SampleCategoryService["createMany"]>[0] },
	): ReturnType<SampleCategoryService["createMany"]> {
		return this.service.createMany(body.items);
	}

	@RequirePermission("DELETE", "SAMPLE_CATEGORY")
	@Post("bulk-delete")
	@ApiOperation({ summary: "Bulk soft delete samplecategories" })
	@ApiOkResponse({ description: "Bulk delete result" })
	public bulkDelete(@Body(new ZodValidationPipe(BulkDeleteIdsSchema)) body: { ids: string[] }): ReturnType<SampleCategoryService["deleteMany"]> {
		return this.service.deleteMany(body.ids);
	}

	@RequirePermission("READ", "SAMPLE_CATEGORY")
	@Get(":id")
	@ApiOperation({ summary: "Get SampleCategory by id" })
	@ApiOkResponse({ description: "SampleCategory detail" })
	public get(@Param(new ZodValidationPipe(SampleCategoryIdParamSchema)) params: { id: string }): ReturnType<SampleCategoryService["getById"]> {
		return this.service.getById(params.id);
	}

	@RequirePermission("CREATE", "SAMPLE_CATEGORY")
	@Post()
	@ApiOperation({ summary: "Create SampleCategory" })
	@ApiOkResponse({ description: "Created samplecategory" })
	public create(@Body(new ZodValidationPipe(CreateSampleCategorySchema)) body: Parameters<SampleCategoryService["create"]>[0]): ReturnType<SampleCategoryService["create"]> {
		return this.service.create(body);
	}

	@RequirePermission("UPDATE", "SAMPLE_CATEGORY")
	@Patch(":id")
	@ApiOperation({ summary: "Update SampleCategory" })
	@ApiOkResponse({ description: "Updated samplecategory" })
	public update(
		@Param(new ZodValidationPipe(SampleCategoryIdParamSchema)) params: { id: string },
		@Body(new ZodValidationPipe(UpdateSampleCategorySchema)) body: Parameters<SampleCategoryService["update"]>[1],
	): ReturnType<SampleCategoryService["update"]> {
		return this.service.update(params.id, body);
	}

	@RequirePermission("DELETE", "SAMPLE_CATEGORY")
	@Delete(":id")
	@ApiOperation({ summary: "Soft delete SampleCategory" })
	@ApiOkResponse({ description: "SampleCategory deleted" })
	public async delete(@Param(new ZodValidationPipe(SampleCategoryIdParamSchema)) params: { id: string }): Promise<{ success: true }> {
		await this.service.delete(params.id);
		return { success: true };
	}

	@RequirePermission("UPDATE", "SAMPLE_CATEGORY")
	@Post(":id/restore")
	@ApiOperation({ summary: "Restore SampleCategory" })
	@ApiOkResponse({ description: "Restored samplecategory" })
	public restore(@Param(new ZodValidationPipe(SampleCategoryIdParamSchema)) params: { id: string }): ReturnType<SampleCategoryService["restore"]> {
		return this.service.restore(params.id);
	}
}
