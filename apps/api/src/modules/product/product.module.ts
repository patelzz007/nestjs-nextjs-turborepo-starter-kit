import { Module } from "@nestjs/common";

import { PlatformResourceModule } from "../../platform/platform-resource.module";

import { ProductController } from "./product.controller";
import { ProductRepository } from "./product.repository";
import { ProductService } from "./product.service";

@Module({
	imports: [PlatformResourceModule],
	controllers: [ProductController],
	providers: [ProductRepository, ProductService],
	exports: [ProductService],
})
export class ProductModule {}
