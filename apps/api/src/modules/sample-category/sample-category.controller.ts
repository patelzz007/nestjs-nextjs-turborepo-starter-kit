import { Injectable } from "@nestjs/common";

import { GeneratedSampleCategoryController } from "./sample-category.controller.generated";

/**
 * Developer-owned controller extension point with Authorization Kernel integration.
 *
 * This controller demonstrates how to integrate the Authorization Kernel into
 * generated controllers. All CRUD operations are protected by the kernel's
 * multi-layer authorization (RBAC + ACL + Policies + Ownership + RLS).
 *
 * Routes inherit from the generated base and can be extended with custom logic.
 */
@Injectable()
export class SampleCategoryController extends GeneratedSampleCategoryController {
	public constructor(
		...baseParams: ConstructorParameters<typeof GeneratedSampleCategoryController>,
		
	) {
		super(...baseParams);
	}

	// Override generated methods here to add kernel authorization checks
	// Example patterns are documented in /docs/authorization-kernel-integration-guide.md
}
