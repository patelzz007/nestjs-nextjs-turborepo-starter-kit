import { Inject, Injectable } from "@nestjs/common";
import type { PaginatedServiceResult, SupportAccessGrantDetail, SupportAccessGrantListQuery } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { NotFoundError } from "../../../../platform/application/errors/app-error";
import { SUPPORT_ACCESS_READ } from "../ports/authorization.tokens";
import type { SupportAccessReadPort } from "../ports/support-access-read.port";
import { requireUserActor } from "./rbac-actor";

/** The reads of support-access grants (ADR 096): the platform's list, and one tenant owner's view of its own grants. */
@Injectable()
export class SupportAccessApplicationService {
	public constructor(@Inject(SUPPORT_ACCESS_READ) private readonly reads: SupportAccessReadPort) {}

	/** Every grant, for the platform. Authorization: the route's SuperAdmin + READ USER checks. */
	public listGrants(actor: ActorContext, input: SupportAccessGrantListQuery): Promise<PaginatedServiceResult<SupportAccessGrantDetail>> {
		return this.reads.listForAdmin(actor, input);
	}

	/** Only an active OWNER of the tenant (approval's own rule) sees its grants; anyone else gets the uniform 404. */
	public async listTenantGrants(actor: ActorContext, input: { readonly tenantSlug: string }): Promise<readonly SupportAccessGrantDetail[]> {
		const user = requireUserActor(actor);
		const grants = await this.reads.listForTenantOwner(user, input.tenantSlug, user.userId);
		if (grants === null) {
			throw new NotFoundError({ message: "Not Found" });
		}
		return grants;
	}
}
