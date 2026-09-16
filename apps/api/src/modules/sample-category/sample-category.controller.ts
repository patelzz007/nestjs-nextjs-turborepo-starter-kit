import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { GeneratedSampleCategoryController } from "./sample-category.controller.generated";
import { SampleCategoryService } from "./sample-category.service";

/**
 * Developer-owned controller extension point with Authorization Kernel integration.
 *
 * This controller demonstrates how to integrate the Authorization Kernel into
 * generated controllers. All CRUD operations are protected by the kernel's
 * multi-layer authorization (RBAC + ACL + Policies + Ownership + RLS).
 *
 * Routes inherit from the generated base and can be extended with custom logic.
 */
@ApiTags("Sample Category")
@Controller()
export class SampleCategoryController extends GeneratedSampleCategoryController {
	public constructor(protected readonly service: SampleCategoryService) {
		super(service);
	}

	// Override generated methods here to add kernel authorization checks
	// Example patterns are documented in /docs/authorization-kernel-integration-guide.md
}
