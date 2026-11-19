import { Inject, Injectable } from "@nestjs/common";
import type { TenantLifecycleResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { TenantLifecycleReadPort } from "../ports/tenant-lifecycle-read.port";
import { TENANT_LIFECYCLE_READ } from "../ports/tenants.tokens";
import { notFound, requireUserActor } from "../tenant-actor";
import { readLifecycleOrNotFound } from "../tenant-lifecycle-view";

/** A tenant's lifecycle state and appeals (ADR 096). A tenant the caller may not see is the uniform 404. */
@Injectable()
export class TenantLifecycleApplicationService {
	public constructor(@Inject(TENANT_LIFECYCLE_READ) private readonly reads: TenantLifecycleReadPort) {}

	/** For a member of the tenant the route names. */
	public async getForMember(actor: ActorContext, input: { readonly tenantSlug: string }): Promise<TenantLifecycleResponse> {
		const user = requireUserActor(actor);
		const tenantId = await this.reads.findMemberTenantId(input.tenantSlug, user.userId);
		if (tenantId === null) {
			throw notFound();
		}
		return readLifecycleOrNotFound(this.reads, tenantId);
	}

	/** For the platform (the route checked the permission). */
	public getForPlatform(input: { readonly tenantId: string }): Promise<TenantLifecycleResponse> {
		return readLifecycleOrNotFound(this.reads, input.tenantId);
	}
}
