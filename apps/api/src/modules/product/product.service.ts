import { Injectable } from "@nestjs/common";
import type { CreateProductInput, Product, ProductListQuery, UpdateProductInput } from "@workspace/shared";

import { BaseService } from "../../platform/persistence/base.service";

import { ProductRepository } from "./product.repository";

@Injectable()
export class ProductService extends BaseService<Product, CreateProductInput, UpdateProductInput, ProductListQuery, ProductRepository> {
	public constructor(repository: ProductRepository) {
		super(repository);
	}
}
