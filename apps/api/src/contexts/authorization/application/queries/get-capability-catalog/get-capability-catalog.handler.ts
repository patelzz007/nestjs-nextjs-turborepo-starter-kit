import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { CapabilityCatalogResponse } from "@workspace/shared";

import { CAPABILITY_CATALOG_READ } from "../../ports/authorization.tokens";
import type { CapabilityCatalogReadPort } from "../../ports/rbac-read.port";
import { GetCapabilityCatalogQuery } from "./get-capability-catalog.query";

@QueryHandler(GetCapabilityCatalogQuery)
export class GetCapabilityCatalogHandler implements IQueryHandler<GetCapabilityCatalogQuery, CapabilityCatalogResponse> {
	public constructor(@Inject(CAPABILITY_CATALOG_READ) private readonly catalog: CapabilityCatalogReadPort) {}

	public async execute(query: GetCapabilityCatalogQuery): Promise<CapabilityCatalogResponse> {
		return this.catalog.listCatalog(query.scope);
	}
}
