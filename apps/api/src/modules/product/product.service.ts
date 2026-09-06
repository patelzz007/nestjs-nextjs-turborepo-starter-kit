import { Injectable } from "@nestjs/common";

import { GeneratedProductRepository } from "./product.repository.generated";
import { GeneratedProductService } from "./product.service.generated";

/** Developer-owned service extension point. */
@Injectable()
export class ProductService extends GeneratedProductService {
	public constructor(repository: GeneratedProductRepository) {
		super(repository);
	}
}
