import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { OrganizationContextResponse } from "@workspace/shared";

import { requireUserActor } from "../../organization-actor";
import type { OrganizationContextReadPort } from "../../ports/organization-context-read.port";
import { ORGANIZATION_CONTEXT_READ } from "../../ports/organizations.tokens";
import { GetOrganizationContextQuery } from "./get-organization-context.query";

/** Membership is the authorization: a non-member gets the same 404 as a missing organization. */
@QueryHandler(GetOrganizationContextQuery)
export class GetOrganizationContextHandler implements IQueryHandler<GetOrganizationContextQuery, OrganizationContextResponse> {
	public constructor(@Inject(ORGANIZATION_CONTEXT_READ) private readonly reads: OrganizationContextReadPort) {}

	public async execute(query: GetOrganizationContextQuery): Promise<OrganizationContextResponse> {
		return this.reads.getContext(requireUserActor(query.actor), query.input.orgSlug);
	}
}
