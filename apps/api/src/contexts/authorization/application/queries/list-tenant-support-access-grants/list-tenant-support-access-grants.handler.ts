import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { SupportAccessGrantDetail } from "@workspace/shared";

import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import { SUPPORT_ACCESS_READ } from "../../ports/authorization.tokens";
import type { SupportAccessReadPort } from "../../ports/support-access-read.port";
import { requireUserActor } from "../../services/rbac-actor";
import { ListTenantSupportAccessGrantsQuery } from "./list-tenant-support-access-grants.query";

/** Only an active OWNER of the tenant (approval's own rule) sees its grants; anyone else gets the uniform 404. */
@QueryHandler(ListTenantSupportAccessGrantsQuery)
export class ListTenantSupportAccessGrantsHandler implements IQueryHandler<ListTenantSupportAccessGrantsQuery, readonly SupportAccessGrantDetail[]> {
	public constructor(@Inject(SUPPORT_ACCESS_READ) private readonly reads: SupportAccessReadPort) {}

	public async execute(query: ListTenantSupportAccessGrantsQuery): Promise<readonly SupportAccessGrantDetail[]> {
		const actor = requireUserActor(query.actor);
		const grants = await this.reads.listForTenantOwner(actor, query.input.tenantSlug, actor.userId);
		if (grants === null) {
			throw new NotFoundError({ message: "Not Found" });
		}
		return grants;
	}
}
