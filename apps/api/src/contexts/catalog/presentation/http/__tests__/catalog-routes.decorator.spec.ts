import { Reflector } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { PLATFORM_OPERATION_KEY } from "../../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { ProductController } from "../product.controller";
import { SampleCategoryController } from "../sample-category.controller";
import { handlerOf } from "../../../../../../test/support/route-metadata";

describe("catalog routes", () => {
	const reflector = new Reflector();

	it("names the product and sample-category operation for each route", () => {
		const read = ["list", "get"];
		const write = ["bulkCreate", "bulkDelete", "create", "update", "delete", "restore"];
		for (const target of [ProductController.prototype, SampleCategoryController.prototype]) {
			for (const name of read) {
				expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(target, name))).toBe("catalog.product_catalog.read");
			}
			for (const name of write) {
				expect(reflector.get(PLATFORM_OPERATION_KEY, handlerOf(target, name))).toBe("catalog.product_catalog.write");
			}
		}
	});
});
