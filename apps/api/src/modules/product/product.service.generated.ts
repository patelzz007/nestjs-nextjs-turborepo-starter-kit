import type { CreateProductInput, Product, ProductListQuery, UpdateProductInput } from "@workspace/shared";

import { BaseService } from "../../platform/persistence/base.service";

import { GeneratedProductRepository } from "./product.repository.generated";

export abstract class GeneratedProductService extends BaseService<Product, CreateProductInput, UpdateProductInput, ProductListQuery, GeneratedProductRepository> {
	public constructor(repository: GeneratedProductRepository) {
		super(repository);
	}
}
