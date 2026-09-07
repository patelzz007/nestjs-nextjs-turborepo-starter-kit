import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
	apiPath,
	BulkCreateProductSchema,
	BulkDeleteIdsSchema,
	CreateProductSchema,
	ProductIdParamSchema,
	ProductListQuerySchema,
	UpdateProductSchema,
} from "@workspace/shared";

import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";

import { ProductService } from "./product.service";

@ApiTags("Product")
@Controller(apiPath("/product"))
export class GeneratedProductController {
	public constructor(protected readonly service: ProductService) {}

	@RequirePermission("LIST", "PRODUCT")
	@Get()
	@ApiOperation({ summary: "List Products" })
	@ApiOkResponse({ description: "Paginated list of products" })
	public list(@Query(new ZodValidationPipe(ProductListQuerySchema)) query: Parameters<ProductService["list"]>[0]): ReturnType<ProductService["list"]> {
		return this.service.list(query);
	}

	@RequirePermission("CREATE", "PRODUCT")
	@Post("bulk")
	@ApiOperation({ summary: "Bulk create products" })
	@ApiOkResponse({ description: "Created products" })
	public bulkCreate(
		@Body(new ZodValidationPipe(BulkCreateProductSchema)) body: { items: Parameters<ProductService["createMany"]>[0] },
	): ReturnType<ProductService["createMany"]> {
		return this.service.createMany(body.items);
	}

	@RequirePermission("DELETE", "PRODUCT")
	@Post("bulk-delete")
	@ApiOperation({ summary: "Bulk soft delete products" })
	@ApiOkResponse({ description: "Bulk delete result" })
	public bulkDelete(@Body(new ZodValidationPipe(BulkDeleteIdsSchema)) body: { ids: string[] }): ReturnType<ProductService["deleteMany"]> {
		return this.service.deleteMany(body.ids);
	}

	@RequirePermission("READ", "PRODUCT")
	@Get(":id")
	@ApiOperation({ summary: "Get Product by id" })
	@ApiOkResponse({ description: "Product detail" })
	public get(@Param(new ZodValidationPipe(ProductIdParamSchema)) params: { id: string }): ReturnType<ProductService["getById"]> {
		return this.service.getById(params.id);
	}

	@RequirePermission("CREATE", "PRODUCT")
	@Post()
	@ApiOperation({ summary: "Create Product" })
	@ApiOkResponse({ description: "Created product" })
	public create(@Body(new ZodValidationPipe(CreateProductSchema)) body: Parameters<ProductService["create"]>[0]): ReturnType<ProductService["create"]> {
		return this.service.create(body);
	}

	@RequirePermission("UPDATE", "PRODUCT")
	@Patch(":id")
	@ApiOperation({ summary: "Update Product" })
	@ApiOkResponse({ description: "Updated product" })
	public update(
		@Param(new ZodValidationPipe(ProductIdParamSchema)) params: { id: string },
		@Body(new ZodValidationPipe(UpdateProductSchema)) body: Parameters<ProductService["update"]>[1],
	): ReturnType<ProductService["update"]> {
		return this.service.update(params.id, body);
	}

	@RequirePermission("DELETE", "PRODUCT")
	@Delete(":id")
	@ApiOperation({ summary: "Soft delete Product" })
	@ApiOkResponse({ description: "Product deleted" })
	public async delete(@Param(new ZodValidationPipe(ProductIdParamSchema)) params: { id: string }): Promise<{ success: true }> {
		await this.service.delete(params.id);
		return { success: true };
	}

	@RequirePermission("UPDATE", "PRODUCT")
	@Post(":id/restore")
	@ApiOperation({ summary: "Restore Product" })
	@ApiOkResponse({ description: "Restored product" })
	public restore(@Param(new ZodValidationPipe(ProductIdParamSchema)) params: { id: string }): ReturnType<ProductService["restore"]> {
		return this.service.restore(params.id);
	}
}
