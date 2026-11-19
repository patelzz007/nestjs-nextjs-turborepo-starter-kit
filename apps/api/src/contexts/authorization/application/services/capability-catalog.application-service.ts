import { Inject, Injectable } from "@nestjs/common";
import type { CapabilityCatalogResponse, CapabilityScope } from "@workspace/shared";

import { CAPABILITY_CATALOG_READ } from "../ports/authorization.tokens";
import type { CapabilityCatalogReadPort } from "../ports/rbac-read.port";

/** The capability catalog the apps build their menus and gates from (ADR 096). */
@Injectable()
export class CapabilityCatalogApplicationService {
	public constructor(@Inject(CAPABILITY_CATALOG_READ) private readonly catalog: CapabilityCatalogReadPort) {}

	/** Every capability, or those of one scope. */
	public getCatalog(scope: CapabilityScope | undefined): Promise<CapabilityCatalogResponse> {
		return this.catalog.listCatalog(scope);
	}
}
