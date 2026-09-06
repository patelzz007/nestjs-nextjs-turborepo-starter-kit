import { Module } from "@nestjs/common";

import { PlatformResourceModule } from "../../platform/platform-resource.module";

import { ProductController } from "./product.controller";
import { GeneratedProductRepository } from "./product.repository.generated";
import { ProductService } from "./product.service";

@Module({
	imports: [PlatformResourceModule],
	controllers: [ProductController],
	providers: [GeneratedProductRepository, ProductService],
	exports: [ProductService],
})
export class ProductModule {}
